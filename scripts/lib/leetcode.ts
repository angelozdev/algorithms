import { NodeHtmlMarkdown } from "node-html-markdown";

export interface LeetCodeQuestion {
  questionFrontendId: string;
  title: string;
  titleSlug: string;
  difficulty: string;
  content: string;
  exampleTestcases: string;
  metaData: string;
}

interface LeetCodeMeta {
  name?: string;
  params?: { name: string; type: string }[];
  return?: { type: string };
  output?: { paramindex: number; size?: string };
  classname?: string;
}

type Example = { input: unknown; expected?: unknown };

export interface CasesDraft {
  mode: "function" | "class";
  entry: string;
  params?: { name: string; type: string }[];
  returns?: string;
  compare: "exact" | "unordered";
  inPlace?: { param: string; prefix?: "return" };
  examples: Example[];
  hidden: never[];
}

export interface Draft {
  id: string;
  folder: string;
  title: string;
  slug: string;
  difficulty: string;
  url: string;
  statement: string;
  cases: CasesDraft;
  warnings: string[];
}

const TYPE_MAP: Record<string, string> = {
  integer: "int",
  long: "int",
  double: "float",
  float: "float",
  boolean: "bool",
  string: "string",
  character: "string",
  ListNode: "ListNode",
  TreeNode: "TreeNode",
  void: "void",
};

export function mapLeetCodeType(type: string): string | null {
  let base = type.trim();
  let depth = 0;
  for (;;) {
    const list = /^list<(.+)>$/.exec(base);
    if (list) {
      base = list[1].trim();
      depth++;
    } else if (base.endsWith("[]")) {
      base = base.slice(0, -2);
      depth++;
    } else {
      break;
    }
  }
  const mapped = TYPE_MAP[base];
  return mapped ? mapped + "[]".repeat(depth) : null;
}

/** Exponents and subscripts stay readable: 10<sup>4</sup> → 10^4, x<sub>i</sub> → x_i. */
const markdown = new NodeHtmlMarkdown({ bulletMarker: "-" }, { sup: { prefix: "^" }, sub: { prefix: "_" } });

/** Converts a LeetCode statement (HTML) to Markdown. */
export function htmlToText(html: string): string {
  return markdown.translate(html);
}

/**
 * Values after "Output:" (function problems) or on the line after "Output" (design problems),
 * with or without Markdown bold, and with Markdown escapes (\[, \_, …) removed.
 */
export function parseOutputs(text: string): string[] {
  return [...text.matchAll(/Output:?(?:\*\*)?[ \t]*\n?[ \t]*(\S.*)/g)].map((match) =>
    match[1].replace(/\\([\\`*_~[\]])/g, "$1").trim(),
  );
}

export function slugFrom(arg: string): string {
  const match = /leetcode\.com\/problems\/([^/?#]+)/.exec(arg);
  return (match ? match[1] : arg).trim().toLowerCase();
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** "2, nums = [2,2,_,_]" → [2, 2] */
function prefixFromOutput(raw: string): unknown {
  const match = /\[([^\]]*)\]\s*$/.exec(raw);
  if (!match) return undefined;
  const items = match[1].split(",").map((item) => item.trim()).filter((item) => item !== "" && item !== "_");
  return parseJson(`[${items.join(",")}]`);
}

function withExpected(input: unknown, expected: unknown): Example {
  return expected === undefined ? { input } : { input, expected };
}

function functionDraft(meta: LeetCodeMeta, lines: unknown[], outputs: string[], statement: string, warnings: string[]): CasesDraft {
  const params = (meta.params ?? []).map((param) => {
    const type = mapLeetCodeType(param.type);
    if (!type) warnings.push(`unknown LeetCode type "${param.type}" for param "${param.name}"`);
    return { name: param.name, type: type ?? param.type };
  });
  const rawReturn = meta.return?.type ?? "void";
  const returns = mapLeetCodeType(rawReturn);
  if (!returns) warnings.push(`unknown LeetCode return type "${rawReturn}"`);
  const prefix = meta.output?.size === "ret";
  const inPlace = meta.output
    ? prefix
      ? { param: params[meta.output.paramindex].name, prefix: "return" as const }
      : { param: params[meta.output.paramindex].name }
    : undefined;
  const examples: Example[] = [];
  const n = params.length;
  for (let i = 0; n > 0 && i + n <= lines.length; i += n) {
    const raw = outputs[i / n];
    const expected = raw === undefined ? undefined : prefix ? prefixFromOutput(raw) : parseJson(raw);
    examples.push(withExpected(lines.slice(i, i + n), expected));
  }
  const unordered = /any order/i.test(statement);
  if (unordered) warnings.push('the statement says "any order": compare is set to unordered — double-check it');
  return {
    mode: "function",
    entry: meta.name ?? "",
    params,
    returns: returns ?? rawReturn,
    compare: unordered ? "unordered" : "exact",
    ...(inPlace ? { inPlace } : {}),
    examples,
    hidden: [],
  };
}

function classDraft(meta: LeetCodeMeta, lines: unknown[], outputs: string[]): CasesDraft {
  const examples: Example[] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const raw = outputs[i / 2];
    examples.push(withExpected({ ops: lines[i], args: lines[i + 1] }, raw === undefined ? undefined : parseJson(raw)));
  }
  return { mode: "class", entry: meta.classname ?? "", compare: "exact", examples, hidden: [] };
}

export function buildDraft(question: LeetCodeQuestion): Draft {
  const meta = JSON.parse(question.metaData) as LeetCodeMeta;
  const statement = htmlToText(question.content);
  const outputs = parseOutputs(statement);
  const lines = question.exampleTestcases
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseJson);
  const warnings: string[] = [];
  const cases = meta.classname ? classDraft(meta, lines, outputs) : functionDraft(meta, lines, outputs, statement, warnings);
  cases.examples.forEach((example, i) => {
    if (!("expected" in example)) warnings.push(`could not parse the expected output of example ${i + 1} — fill it from the statement`);
  });
  const number = question.questionFrontendId.padStart(4, "0");
  return {
    id: `lc-${number}`,
    folder: `lc-${number}-${question.titleSlug}`,
    title: question.title,
    slug: question.titleSlug,
    difficulty: question.difficulty.toLowerCase(),
    url: `https://leetcode.com/problems/${question.titleSlug}/`,
    statement,
    cases,
    warnings,
  };
}
