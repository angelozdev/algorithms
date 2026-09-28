import { readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { CaseEntry, CaseFile } from "./types.ts";

export class CaseFileError extends Error {
  constructor(
    readonly issues: string[],
    file = "cases.json",
  ) {
    super(`${file} is invalid:\n${issues.map((issue) => `  - ${issue}`).join("\n")}`);
    this.name = "CaseFileError";
  }
}

const BASE_TYPES = new Set(["int", "float", "bool", "string", "ListNode", "TreeNode"]);
const TYPE_HINT = "int | float | bool | string | ListNode | TreeNode, with optional [] suffixes";

export function isValueType(type: string): boolean {
  let base = type;
  while (base.endsWith("[]")) base = base.slice(0, -2);
  return BASE_TYPES.has(base);
}

const valueType = z
  .string()
  .refine(isValueType, { message: `unknown type (expected ${TYPE_HINT})` });
const returnType = z
  .string()
  .refine((type) => type === "void" || isValueType(type), {
    message: `unknown type (expected void or ${TYPE_HINT})`,
  });
const required = z.custom<unknown>((value) => value !== undefined, { message: "required" });

const caseEntrySchema = z.object({ input: required, expected: z.unknown().optional() }).strict();

const caseFileSchema = z
  .object({
    mode: z.enum(["function", "class"]).optional(),
    entry: z.string().min(1),
    params: z.array(z.object({ name: z.string().min(1), type: valueType }).strict()).optional(),
    returns: returnType.optional(),
    compare: z.enum(["exact", "unordered", "float", "any-of"]).optional(),
    inPlace: z
      .object({ param: z.string().min(1), prefix: z.literal("return").optional() })
      .strict()
      .optional(),
    examples: z.array(caseEntrySchema).min(1),
    hidden: z.array(caseEntrySchema),
  })
  .strict();

/** ["hidden", 3, "input"] → "hidden[3].input" */
export function formatPath(segments: readonly PropertyKey[]): string {
  let out = "";
  for (const segment of segments) {
    if (typeof segment === "number") out += `[${segment}]`;
    else out += out ? `.${String(segment)}` : String(segment);
  }
  return out || "(root)";
}

type Signature = Pick<CaseFile, "mode" | "entry" | "params">;

function classInput(input: unknown): { ops: unknown[]; args: unknown[] } | null {
  const value = input as { ops?: unknown; args?: unknown } | null;
  if (typeof value !== "object" || value === null || !Array.isArray(value.ops) || !Array.isArray(value.args)) {
    return null;
  }
  return { ops: value.ops, args: value.args };
}

/**
 * Checks one case input against the signature: function mode takes one item per param,
 * class mode takes { ops, args }. `where` prefixes each issue (e.g. "hidden[3]").
 */
export function inputIssues(signature: Signature, input: unknown, where: string): string[] {
  if (signature.mode === "function") {
    const count = signature.params.length;
    if (!Array.isArray(input)) return [`${where}.input: expected an array of ${count} params`];
    return input.length === count ? [] : [`${where}.input: expected ${count} params, got ${input.length}`];
  }
  const call = classInput(input);
  if (!call) return [`${where}.input: expected { "ops": [...], "args": [...] }`];
  const issues: string[] = [];
  if (call.ops.length === 0 || call.ops.length !== call.args.length) {
    issues.push(`${where}.input: ops and args must be non-empty and the same length`);
  } else if (call.ops[0] !== signature.entry) {
    issues.push(`${where}.input.ops[0]: expected "${signature.entry}"`);
  }
  if (!call.args.every(Array.isArray)) issues.push(`${where}.input.args: every entry must be an array`);
  return issues;
}

export function parseCaseFile(raw: unknown): CaseFile {
  const parsed = caseFileSchema.safeParse(raw);
  if (!parsed.success) {
    throw new CaseFileError(
      parsed.error.issues.map((issue) => `${formatPath(issue.path)}: ${issue.message}`),
    );
  }
  const data = parsed.data;
  const mode = data.mode ?? "function";
  const examples = data.examples as CaseEntry[];
  const hidden = data.hidden as CaseEntry[];
  const lists: [string, CaseEntry[]][] = [
    ["examples", examples],
    ["hidden", hidden],
  ];
  const signature: Signature = { mode, entry: data.entry, params: data.params ?? [] };
  const issues: string[] = [];

  examples.forEach((entry, i) => {
    if (entry.expected === undefined) issues.push(`examples[${i}].expected: required`);
  });

  if (mode === "function") {
    if (!data.params) issues.push("params: required in function mode");
    if (!data.returns) issues.push("returns: required in function mode");
    for (const [key, list] of lists) {
      list.forEach((entry, i) => issues.push(...inputIssues(signature, entry.input, `${key}[${i}]`)));
    }
    const inPlace = data.inPlace;
    if (inPlace && !data.params?.some((param) => param.name === inPlace.param)) {
      issues.push(`inPlace.param: "${inPlace.param}" is not a param name`);
    }
  } else {
    if (data.params) issues.push("params: not allowed in class mode");
    if (data.returns) issues.push("returns: not allowed in class mode");
    if (data.inPlace) issues.push("inPlace: not allowed in class mode");
    for (const [key, list] of lists) {
      list.forEach((entry, i) => {
        const where = `${key}[${i}]`;
        issues.push(...inputIssues(signature, entry.input, where));
        const call = classInput(entry.input);
        if (
          call &&
          entry.expected !== undefined &&
          (!Array.isArray(entry.expected) || entry.expected.length !== call.ops.length)
        ) {
          issues.push(`${where}.expected: expected one value per op (${call.ops.length})`);
        }
      });
    }
  }

  if (data.compare === "any-of") {
    for (const [key, list] of lists) {
      list.forEach((entry, i) => {
        if (
          entry.expected !== undefined &&
          (!Array.isArray(entry.expected) || entry.expected.length === 0)
        ) {
          issues.push(`${key}[${i}].expected: any-of needs a non-empty list of acceptable answers`);
        }
      });
    }
  }

  if (issues.length > 0) throw new CaseFileError(issues);
  return {
    mode,
    entry: data.entry,
    params: data.params ?? [],
    returns: data.returns ?? null,
    compare: data.compare ?? "exact",
    inPlace: data.inPlace ?? null,
    examples,
    hidden,
  };
}

export function loadRawCaseFile(dir: string): Record<string, unknown> {
  const file = path.join(dir, "cases.json");
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    throw new CaseFileError(["file not found"], file);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    throw new CaseFileError([`invalid JSON: ${(error as Error).message}`]);
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new CaseFileError(["the top level must be a JSON object"]);
  }
  return raw as Record<string, unknown>;
}

export function loadCaseFile(dir: string): CaseFile {
  return parseCaseFile(loadRawCaseFile(dir));
}

export function assertHiddenFilled(cf: CaseFile): void {
  const missing = cf.hidden.flatMap((entry, i) =>
    entry.expected === undefined ? [`hidden[${i}].expected: missing (run pnpm fill-expected)`] : [],
  );
  if (missing.length > 0) throw new CaseFileError(missing);
}

const ONE_ITEM_PER_LINE = new Set(["params", "examples", "hidden"]);

/** Pretty JSON with one param/case per line (compact inside), keeping key order. */
export function formatCasesJson(obj: Record<string, unknown>): string {
  const keys = Object.keys(obj);
  const lines = ["{"];
  keys.forEach((key, i) => {
    const comma = i < keys.length - 1 ? "," : "";
    const value = obj[key];
    if (ONE_ITEM_PER_LINE.has(key) && Array.isArray(value) && value.length > 0) {
      lines.push(`  ${JSON.stringify(key)}: [`);
      value.forEach((item, j) => {
        lines.push(`    ${JSON.stringify(item)}${j < value.length - 1 ? "," : ""}`);
      });
      lines.push(`  ]${comma}`);
    } else {
      lines.push(`  ${JSON.stringify(key)}: ${JSON.stringify(value)}${comma}`);
    }
  });
  lines.push("}");
  return `${lines.join("\n")}\n`;
}
