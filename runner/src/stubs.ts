import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { CaseFile, Lang } from "./types.ts";

const PY_BASE: Record<string, string> = {
  int: "int",
  float: "float",
  bool: "bool",
  string: "str",
  ListNode: "ListNode | None",
  TreeNode: "TreeNode | None",
  void: "None",
};

const TS_BASE: Record<string, string> = {
  int: "number",
  float: "number",
  bool: "boolean",
  string: "string",
  ListNode: "ListNode | null",
  TreeNode: "TreeNode | null",
  void: "void",
};

export function pyType(type: string): string {
  return type.endsWith("[]") ? `list[${pyType(type.slice(0, -2))}]` : PY_BASE[type];
}

export function tsType(type: string): string {
  if (!type.endsWith("[]")) return TS_BASE[type];
  const inner = tsType(type.slice(0, -2));
  return inner.includes("|") ? `(${inner})[]` : `${inner}[]`;
}

function nodeClassesUsed(cf: CaseFile): string[] {
  const bases = [...cf.params.map((param) => param.type), cf.returns ?? ""].map((type) =>
    type.replace(/(\[\])+$/, ""),
  );
  return ["ListNode", "TreeNode"].filter((name) => bases.includes(name));
}

export function renderStub(cf: CaseFile, lang: Lang): string {
  const nodes = nodeClassesUsed(cf);
  if (lang === "py") {
    const header = nodes.length
      ? `from lc import ${nodes.join(", ")}  # delete this line when pasting into LeetCode\n\n\n`
      : "";
    if (cf.mode === "class") return `${header}class ${cf.entry}:\n    def __init__(self) -> None:\n        pass\n`;
    const params = ["self", ...cf.params.map((param) => `${param.name}: ${pyType(param.type)}`)].join(", ");
    return `${header}class Solution:\n    def ${cf.entry}(${params}) -> ${pyType(cf.returns ?? "void")}:\n        raise NotImplementedError\n`;
  }
  const header = nodes.length
    ? `import { ${nodes.join(", ")} } from "lc"; // delete this line when pasting into LeetCode\n\n`
    : "";
  if (cf.mode === "class") return `${header}export default class ${cf.entry} {\n  constructor() {}\n}\n`;
  const params = cf.params.map((param) => `${param.name}: ${tsType(param.type)}`).join(", ");
  return `${header}export default function ${cf.entry}(${params}): ${tsType(cf.returns ?? "void")} {\n  throw new Error("Not implemented");\n}\n`;
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
