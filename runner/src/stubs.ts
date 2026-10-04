import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { NODE_VALUE_RETURN, passedParams } from "./schema.ts";
import type { CaseFile, Lang } from "./types.ts";

const PY_BASE: Record<string, string> = {
  int: "int",
  float: "float",
  bool: "bool",
  string: "str",
  ListNode: "ListNode | None",
  TreeNode: "TreeNode | None",
  GraphNode: "Node | None",
  [NODE_VALUE_RETURN]: "TreeNode | None",
  void: "None",
};

const TS_BASE: Record<string, string> = {
  int: "number",
  float: "number",
  bool: "boolean",
  string: "string",
  ListNode: "ListNode | null",
  TreeNode: "TreeNode | null",
  GraphNode: "_Node | null",
  [NODE_VALUE_RETURN]: "TreeNode | null",
  void: "void",
};

/** The class each node type is called in LeetCode's code, per language (Grind 75 spec §3.3). */
const NODE_CLASS: Record<string, Record<Lang, string>> = {
  ListNode: { py: "ListNode", ts: "ListNode" },
  TreeNode: { py: "TreeNode", ts: "TreeNode" },
  [NODE_VALUE_RETURN]: { py: "TreeNode", ts: "TreeNode" },
  GraphNode: { py: "Node", ts: "_Node" },
};

/** How each judge-provided function is typed in a TypeScript stub (Grind 75 spec §3.4). */
const API_TS: Record<string, string> = { isBadVersion: "(version: number) => boolean" };

const NOT_IMPLEMENTED_TS = 'throw new Error("Not implemented");';

export function pyType(type: string): string {
  return type.endsWith("[]") ? `list[${pyType(type.slice(0, -2))}]` : PY_BASE[type];
}

export function tsType(type: string): string {
  if (!type.endsWith("[]")) return TS_BASE[type];
  const inner = tsType(type.slice(0, -2));
  return inner.includes("|") ? `(${inner})[]` : `${inner}[]`;
}

function nodeClassesUsed(cf: CaseFile, lang: Lang): string[] {
  const bases = [...cf.params.map((param) => param.type), cf.returns ?? ""].map((type) => type.replace(/(\[\])+$/, ""));
  return [...new Set(bases.flatMap((base) => (NODE_CLASS[base] ? [NODE_CLASS[base][lang]] : [])))].sort();
}

export function renderStub(cf: CaseFile, lang: Lang): string {
  const params = passedParams(cf.params);
  const apis = cf.params.flatMap((param) => (param.api ? [param.api] : []));
  if (lang === "py") {
    const imports = [...nodeClassesUsed(cf, "py"), ...apis];
    const header = imports.length ? `from lc import ${imports.join(", ")}  # delete this line when pasting into LeetCode\n\n\n` : "";
    if (cf.mode === "class") return `${header}class ${cf.entry}:\n    def __init__(self) -> None:\n        pass\n`;
    if (cf.mode === "codec") {
      const [param] = cf.params;
      const type = pyType(param.type);
      return `${header}class ${cf.entry}:\n    def serialize(self, ${param.name}: ${type}) -> str:\n        raise NotImplementedError\n\n    def deserialize(self, data: str) -> ${type}:\n        raise NotImplementedError\n`;
    }
    const signature = ["self", ...params.map((param) => `${param.name}: ${pyType(param.type)}`)].join(", ");
    return `${header}class Solution:\n    def ${cf.entry}(${signature}) -> ${pyType(cf.returns ?? "void")}:\n        raise NotImplementedError\n`;
  }
  const nodes = nodeClassesUsed(cf, "ts");
  const header = nodes.length ? `import { ${nodes.join(", ")} } from "lc"; // delete this line when pasting into LeetCode\n\n` : "";
  if (cf.mode === "class") return `${header}export default class ${cf.entry} {\n  constructor() {}\n}\n`;
  if (cf.mode === "codec") {
    const [param] = cf.params;
    const type = tsType(param.type);
    return `${header}/** Encodes a value to a single string. */\nexport function serialize(${param.name}: ${type}): string {\n  ${NOT_IMPLEMENTED_TS}\n}\n\n/** Decodes your encoded data back to the value. */\nexport function deserialize(data: string): ${type} {\n  ${NOT_IMPLEMENTED_TS}\n}\n`;
  }
  const signature = params.map((param) => `${param.name}: ${tsType(param.type)}`).join(", ");
  const returns = tsType(cf.returns ?? "void");
  if (apis.length > 0) {
    const factory = apis.map((name) => `${name}: ${API_TS[name]}`).join(", ");
    return `${header}export default function solution(${factory}) {\n  return function ${cf.entry}(${signature}): ${returns} {\n    ${NOT_IMPLEMENTED_TS}\n  };\n}\n`;
  }
  return `${header}export default function ${cf.entry}(${signature}): ${returns} {\n  ${NOT_IMPLEMENTED_TS}\n}\n`;
}

export function solutionPath(dir: string, lang: Lang): string {
  return path.join(dir, `solution.${lang}`);
}

/** Creates solution.<lang> from the signature when it does not exist yet. Never overwrites. */
export function ensureSolution(dir: string, cf: CaseFile, lang: Lang): { path: string; created: boolean } {
  const file = solutionPath(dir, lang);
  if (existsSync(file)) return { path: file, created: false };
  writeFileSync(file, renderStub(cf, lang), { flag: "wx" });
  return { path: file, created: true };
}
