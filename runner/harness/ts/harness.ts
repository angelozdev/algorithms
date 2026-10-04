/**
 * Runs a user's TypeScript solution against test inputs.
 *
 * Protocol: one JSON request on stdin, JSON lines on fd 3 (never stdout, so user
 * prints cannot corrupt it). Expected values are never sent here: this process
 * only executes and reports what the solution returned.
 */
import { readFileSync, writeSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { _Node, ListNode, TreeNode } from "./lc.ts";

interface Param {
  name: string;
  type: string;
  cycle?: string;
  ref?: string;
  api?: string;
}

interface Request {
  solutionPath: string;
  mode: "function" | "class" | "codec";
  entry: string;
  params: Param[];
  returns: string | null;
  inPlace: { param: string; prefix?: "return" } | null;
  discardOutput: boolean;
  cases: { id: string; input: unknown }[];
}

type Linked = { val: unknown; next: Linked | null };
type Tree = { val: unknown; left: Tree | null; right: Tree | null };
type GraphLike = { val: unknown; neighbors: (GraphLike | null)[] };
type Callable = (...args: unknown[]) => unknown;
type Constructor = new (...args: unknown[]) => Record<string, unknown>;

const MAX_NODES = 1_000_000;
const CAPTURE_LIMIT = 64 * 1024;

class SerializationError extends Error {}

/** The module does not provide what the mode needs (reported as a missing-entry error). */
class EntryError extends Error {}

/** Judge-provided functions, built from an `api` param's value (Grind 75 spec §3.4). */
const APIS: Record<string, (value: unknown) => Callable> = {
  isBadVersion: (bad) => (version) => (version as number) >= (bad as number),
};

function emit(message: unknown): void {
  const buffer = Buffer.from(`${JSON.stringify(message)}\n`);
  let offset = 0;
  while (offset < buffer.length) {
    try {
      offset += writeSync(3, buffer, offset);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EAGAIN") throw error;
    }
  }
}

/** Redirects stdout/stderr writes (console.* included) into a capped buffer. */
function capture(): () => string {
  let text = "";
  let truncated = false;
  const push = (chunk: unknown): void => {
    const piece =
      typeof chunk === "string" ? chunk : Buffer.from(chunk as Uint8Array).toString("utf8");
    const room = CAPTURE_LIMIT - text.length;
    if (piece.length > room) truncated = true;
    if (room > 0) text += piece.slice(0, room);
  };
  const stdoutWrite = process.stdout.write;
  const stderrWrite = process.stderr.write;
  process.stdout.write = ((chunk: unknown) => {
    push(chunk);
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: unknown) => {
    push(chunk);
    return true;
  }) as typeof process.stderr.write;
  return () => {
    process.stdout.write = stdoutWrite;
    process.stderr.write = stderrWrite;
    return truncated ? `${text}\n… output truncated\n` : text;
  };
}

function toListNode(values: unknown): ListNode | null {
  const dummy = new ListNode();
  let tail = dummy;
  for (const value of (values as number[] | null) ?? []) {
    tail.next = new ListNode(value);
    tail = tail.next;
  }
  return dummy.next;
}

function toTreeNode(values: unknown): TreeNode | null {
  const list = (values as (number | null)[] | null) ?? [];
  if (list.length === 0 || list[0] === null) return null;
  const root = new TreeNode(list[0]);
  const queue: TreeNode[] = [root];
  let head = 0;
  let i = 1;
  while (i < list.length && head < queue.length) {
    const node = queue[head++];
    const left = list[i++];
    if (left !== null && left !== undefined) {
      node.left = new TreeNode(left);
      queue.push(node.left);
    }
    if (i < list.length) {
      const right = list[i++];
      if (right !== null && right !== undefined) {
        node.right = new TreeNode(right);
        queue.push(node.right);
      }
    }
  }
  return root;
}

/** LeetCode's adjacency list: entry i holds the neighbors of the node whose val is i + 1. [] is no graph. */
function toGraphNode(value: unknown): _Node | null {
  const lists = (value as unknown[][] | null) ?? [];
  if (lists.length === 0) return null;
  const nodes = lists.map((_, i) => new _Node(i + 1));
  lists.forEach((neighbors, i) => {
    nodes[i].neighbors = neighbors.map((neighbor) => {
      const node = Number.isInteger(neighbor) ? nodes[(neighbor as number) - 1] : undefined;
      if (!node) {
        throw new SerializationError(`node ${i + 1} lists neighbor ${JSON.stringify(neighbor)}, but the graph has nodes 1..${lists.length}`);
      }
      return node;
    });
  });
  return nodes[0];
}

/** Every node reachable from `start`, in breadth-first order. */
function reachable(start: GraphLike | null | undefined): GraphLike[] {
  if (!start) return [];
  const seen = new Set<GraphLike>([start]);
  const order: GraphLike[] = [start];
  for (let head = 0; head < order.length; head++) {
    for (const next of order[head].neighbors ?? []) {
      if (next && !seen.has(next)) {
        seen.add(next);
        order.push(next);
        if (order.length > MAX_NODES) throw new SerializationError("graph has more than 10^6 nodes");
      }
    }
  }
  return order;
}

/** Reads a returned graph back as an adjacency list; `inputGraph` holds the input's nodes, which a copy must not reuse. */
function fromGraphNode(start: GraphLike | null | undefined, inputGraph: ReadonlySet<unknown>): unknown[] {
  const nodes = reachable(start);
  if (nodes.some((node) => inputGraph.has(node))) {
    throw new SerializationError("returned a node of the input graph: return a copy");
  }
  const byVal = new Map<unknown, GraphLike>(nodes.map((node) => [node.val, node]));
  const numbered = byVal.size === nodes.length && nodes.every((node) => Number.isInteger(node.val) && (node.val as number) >= 1 && (node.val as number) <= nodes.length);
  if (!numbered) throw new SerializationError(`graph node values must be 1..${nodes.length}, each used once`);
  return nodes.map((_, i) => (byVal.get(i + 1) as GraphLike).neighbors.map((neighbor) => neighbor?.val ?? null));
}

function deserialize(value: unknown, type: string): unknown {
  if (type.endsWith("[]")) return (value as unknown[]).map((item) => deserialize(item, type.slice(0, -2)));
  if (type === "ListNode") return toListNode(value);
  if (type === "TreeNode") return toTreeNode(value);
  if (type === "GraphNode") return toGraphNode(value);
  return value;
}

function fromListNode(node: Linked | null | undefined): unknown[] {
  const values: unknown[] = [];
  let current = node;
  while (current) {
    values.push(plain(current.val));
    current = current.next;
    if (values.length > MAX_NODES) {
      throw new SerializationError("linked list has a cycle or more than 10^6 nodes");
    }
  }
  return values;
}

function fromTreeNode(root: Tree | null | undefined): unknown[] {
  if (!root) return [];
  const values: unknown[] = [];
  const queue: (Tree | null)[] = [root];
  for (let head = 0; head < queue.length; head++) {
    const node = queue[head];
    if (!node) {
      values.push(null);
      continue;
    }
    values.push(plain(node.val));
    queue.push(node.left ?? null, node.right ?? null);
    if (queue.length > 2 * MAX_NODES + 1) {
      throw new SerializationError("tree has a cycle or more than 10^6 nodes");
    }
  }
  while (values.length > 0 && values[values.length - 1] === null) values.pop();
  return values;
}

/** Converts a returned value to JSON-friendly data (duck-typed nodes included). */
function plain(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new SerializationError(`return value contains ${value}`);
    return value;
  }
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map(plain);
  if (value instanceof Map || value instanceof Set) {
    throw new SerializationError(`return value is a ${value.constructor.name}; return an array`);
  }
  if (typeof value === "object") {
    if ("val" in value && "left" in value && "right" in value) return fromTreeNode(value as Tree);
    if ("val" in value && "next" in value) return fromListNode(value as Linked);
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, plain(item)]));
  }
  throw new SerializationError(`return value of type ${typeof value} is not supported`);
}

function serialize(value: unknown, type: string | null, inputGraph: ReadonlySet<unknown> = new Set()): unknown {
  if (type === "ListNode") return fromListNode(value as Linked | null);
  if (type === "TreeNode") return fromTreeNode(value as Tree | null);
  if (type === "TreeNode.val") {
    if (value === null || value === undefined) return null;
    if (typeof value !== "object" || !("val" in value)) throw new SerializationError(`expected a TreeNode, got ${typeof value}`);
    return plain((value as Tree).val);
  }
  if (type === "GraphNode") return fromGraphNode(value as GraphLike | null, inputGraph);
  if (type?.endsWith("[]") && Array.isArray(value)) {
    return value.map((item) => serialize(item, type.slice(0, -2), inputGraph));
  }
  return plain(value);
}

function describe(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

function userTrace(error: unknown, solutionPath: string): string {
  const stack = error instanceof Error && error.stack ? error.stack : "";
  const url = pathToFileURL(solutionPath).href;
  const base = path.basename(solutionPath);
  return stack
    .split("\n")
    .filter((line) => line.includes(solutionPath) || line.includes(url))
    .map((line) => `  ${line.trim().replace(url, base).replace(solutionPath, base)}`)
    .join("\n");
}

interface Built {
  /** One built value per param, in param order. */
  values: unknown[];
  /** The values the solution receives as arguments. */
  args: unknown[];
  /** Judge-provided functions, in param order. */
  apis: Callable[];
  /** Nodes of the input graphs, which a returned graph must not reuse (Grind 75 spec §3.3). */
  inputGraph: Set<unknown>;
}

/** Links the tail of `head` back to node `pos` (Grind 75 spec §3.1); -1 leaves the list as it is. */
function linkCycle(head: Linked | null, pos: unknown, param: Param): void {
  const nodes: Linked[] = [];
  for (let node = head; node && nodes.length <= MAX_NODES; node = node.next) nodes.push(node);
  if (!Number.isInteger(pos) || (pos as number) < -1 || (pos as number) >= nodes.length) {
    throw new SerializationError(`${param.name} = ${JSON.stringify(pos)} is out of range for ${param.cycle} (${nodes.length} nodes)`);
  }
  if ((pos as number) >= 0) nodes[nodes.length - 1].next = nodes[pos as number];
}

/** The first node holding `value`, in level order (Grind 75 spec §3.2). */
function findNode(root: Tree | null, value: unknown): Tree | null {
  const queue: (Tree | null)[] = [root];
  for (let head = 0; head < queue.length; head++) {
    const node = queue[head];
    if (!node) continue;
    if (node.val === value) return node;
    queue.push(node.left, node.right);
  }
  return null;
}

function buildInput(request: Request, input: unknown): Built {
  const raw = input as unknown[];
  const marked = (param: Param) => param.cycle !== undefined || param.ref !== undefined || param.api !== undefined;
  const values = request.params.map((param, i) => (marked(param) ? raw[i] : deserialize(raw[i], param.type)));
  const valueOf = (name: string | undefined) => values[request.params.findIndex((param) => param.name === name)];
  const apis: Callable[] = [];
  request.params.forEach((param, i) => {
    if (param.cycle !== undefined) linkCycle(valueOf(param.cycle) as Linked | null, raw[i], param);
    if (param.ref !== undefined && raw[i] !== null) {
      const node = findNode(valueOf(param.ref) as Tree | null, raw[i]);
      if (!node) throw new SerializationError(`${param.name} = ${JSON.stringify(raw[i])} is not a value in ${param.ref}`);
      values[i] = node;
    }
    if (param.api !== undefined) apis.push(APIS[param.api](raw[i]));
  });
  const inputGraph = new Set<unknown>();
  request.params.forEach((param, i) => {
    if (param.type === "GraphNode") for (const node of reachable(values[i] as GraphLike | null)) inputGraph.add(node);
  });
  const args = request.params.flatMap((param, i) => (param.cycle === undefined && param.api === undefined ? [values[i]] : []));
  return { values, args, apis, inputGraph };
}

/** The node objects of a built tree or list, for telling a rebuilt value from the input one. */
function nodesOf(value: unknown): unknown[] {
  const nodes: unknown[] = [];
  const queue: unknown[] = [value];
  for (let head = 0; head < queue.length && nodes.length <= MAX_NODES; head++) {
    const node = queue[head] as Partial<Tree & Linked> | null;
    if (!node || typeof node !== "object") continue;
    nodes.push(node);
    if ("left" in node || "right" in node) queue.push(node.left, node.right);
    else if ("next" in node) queue.push(node.next);
  }
  return nodes;
}

type Codec = { serialize: Callable; deserialize: Callable };

/** deserialize(serialize(value)), judged by the param's type (Grind 75 spec §3.5). */
function runCodec(codec: Codec, request: Request, input: unknown): { output: unknown; ms: number } {
  const param = request.params[0];
  const value = deserialize((input as unknown[])[0], param.type);
  const inputNodes = new Set(nodesOf(value));
  const started = performance.now();
  const data = codec.serialize(value);
  if (typeof data !== "string") {
    throw new SerializationError(`serialize must return a string, got ${data === null ? "null" : typeof data}`);
  }
  const rebuilt = codec.deserialize(data);
  const ms = performance.now() - started;
  if (request.discardOutput) return { output: null, ms };
  if (nodesOf(rebuilt).some((node) => inputNodes.has(node))) {
    throw new SerializationError("deserialize returned nodes of the input: build new ones from the string");
  }
  return { output: serialize(rebuilt, param.type), ms };
}

/** Why the module lacks what the mode needs, or null. */
function missingEntry(request: Request, loaded: Record<string, unknown>): string | null {
  if (request.mode === "codec") {
    return typeof loaded.serialize === "function" && typeof loaded.deserialize === "function"
      ? null
      : 'expected exported functions "serialize" and "deserialize"';
  }
  if (typeof loaded.default === "function") return null;
  return `expected default export ${request.mode === "function" ? "function" : "class"} "${request.entry}"`;
}

function runFunction(fn: Callable, request: Request, input: unknown): { output: unknown; ms: number } {
  const { values, args, apis, inputGraph } = buildInput(request, input);
  let solve = fn;
  if (apis.length > 0) {
    const made = fn(...apis);
    if (typeof made !== "function") {
      const names = request.params.flatMap((param) => (param.api ? [param.api] : [])).join(", ");
      throw new EntryError(`the default export must return the solution function when called with ${names}`);
    }
    solve = made as Callable;
  }
  const started = performance.now();
  const returned = solve(...args);
  const ms = performance.now() - started;
  if (request.discardOutput) return { output: null, ms };
  const inPlace = request.inPlace;
  if (inPlace) {
    const index = request.params.findIndex((param) => param.name === inPlace.param);
    return {
      output: { ret: plain(returned), param: serialize(values[index], request.params[index].type, inputGraph) },
      ms,
    };
  }
  return { output: serialize(returned, request.returns, inputGraph), ms };
}

function runClass(Cls: Constructor, request: Request, input: unknown): { output: unknown; ms: number } {
  const { ops, args } = input as { ops: string[]; args: unknown[][] };
  const started = performance.now();
  const instance = new Cls(...args[0]);
  const results: unknown[] = [null];
  for (let i = 1; i < ops.length; i++) {
    const method = instance[ops[i]];
    if (typeof method !== "function") throw new Error(`method "${ops[i]}" not found on ${request.entry}`);
    results.push((method as Callable).apply(instance, args[i]));
  }
  const ms = performance.now() - started;
  return { output: request.discardOutput ? null : results.map(plain), ms };
}

async function main(): Promise<void> {
  const request = JSON.parse(readFileSync(0, "utf8")) as Request;
  const solutionPath = path.resolve(request.solutionPath);

  let loaded: Record<string, unknown>;
  const stopLoadCapture = capture();
  try {
    loaded = (await import(pathToFileURL(solutionPath).href)) as Record<string, unknown>;
  } catch (error) {
    stopLoadCapture();
    emit({ type: "fatal", error: { kind: "load", message: describe(error), trace: userTrace(error, solutionPath) } });
    return;
  }
  stopLoadCapture();

  const missing = missingEntry(request, loaded);
  if (missing) {
    emit({ type: "fatal", error: { kind: "missing-entry", message: missing, trace: "" } });
    return;
  }

  emit({ type: "ready" });
  for (const testCase of request.cases) {
    emit({ type: "start", id: testCase.id });
    const stop = capture();
    const started = performance.now();
    try {
      const { output, ms } =
        request.mode === "function"
          ? runFunction(loaded.default as Callable, request, testCase.input)
          : request.mode === "class"
            ? runClass(loaded.default as Constructor, request, testCase.input)
            : runCodec(loaded as unknown as Codec, request, testCase.input);
      const stdout = stop();
      emit({ type: "case", id: testCase.id, ok: true, output, ms: Number(ms.toFixed(3)), stdout });
    } catch (error) {
      const stdout = stop();
      const kind = error instanceof SerializationError ? "serialization" : error instanceof EntryError ? "missing-entry" : "exception";
      emit({
        type: "case",
        id: testCase.id,
        ok: false,
        error: {
          kind,
          message: kind === "exception" ? describe(error) : (error as Error).message,
          trace: kind === "exception" ? userTrace(error, solutionPath) : "",
        },
        ms: Number((performance.now() - started).toFixed(3)),
        stdout,
      });
    }
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`harness failure: ${describe(error)}\n`);
  process.exitCode = 1;
});
