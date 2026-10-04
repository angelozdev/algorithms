import { isDeepStrictEqual } from "node:util";
import { fromMarkdown } from "mdast-util-from-markdown";
import { toString } from "mdast-util-to-string";
import { parse } from "yaml";
import { joinExplanation, splitExplanation } from "../lib/explanation.ts";
import { parseMarkdown } from "../lib/frontmatter.ts";
import { LEGACY_PERSONAL_FIELDS } from "../lib/schemas.ts";

export type ReadmeKind = keyof typeof LEGACY_PERSONAL_FIELDS;

/** A README whose personal data cannot be removed safely by machine: the migration stops before changing anything. */
export class StripError extends Error {}

const FENCE = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
const TOP_LEVEL_KEY = /^([A-Za-z_][\w-]*)\s*:/;

function yamlMapping(block: string): Record<string, unknown> {
  try {
    return (parse(block) ?? {}) as Record<string, unknown>;
  } catch (error) {
    throw new StripError(`frontmatter does not parse after the strip: ${(error as Error).message}`);
  }
}

/**
 * `text` without the top-level frontmatter `keys`. The other lines stay byte for byte (no YAML
 * re-serialization). The result must parse to the same mapping minus those keys, or StripError.
 */
export function stripFrontmatter(text: string, keys: readonly string[]): { text: string; removed: string[] } {
  const match = FENCE.exec(text);
  if (!match) return { text, removed: [] };
  const kept: string[] = [];
  const removed: string[] = [];
  let dropping = false;
  for (const line of match[1].split("\n")) {
    const key = TOP_LEVEL_KEY.exec(line)?.[1];
    if (key !== undefined) {
      dropping = keys.includes(key);
      if (dropping) removed.push(key);
    }
    // Indented lines, list items, blank lines and comments belong to the key above them.
    if (!dropping) kept.push(line);
  }
  if (removed.length === 0) return { text, removed };
  const block = kept.join("\n");
  const before = yamlMapping(match[1]);
  const expected = Object.fromEntries(Object.entries(before).filter(([key]) => !keys.includes(key)));
  if (!isDeepStrictEqual(yamlMapping(block), expected)) {
    throw new StripError(`could not remove ${removed.join(", ")} without changing the other frontmatter fields`);
  }
  const start = match[0].indexOf(match[1]);
  const head = match[0].slice(0, start) + block + match[0].slice(start + match[1].length);
  return { text: head + text.slice(match[0].length), removed };
}

/** `body` without its `## <heading>` section: from that heading to the next heading of depth ≤ 2, or the end. */
export function removeSection(body: string, heading: string): { body: string; removed: boolean } {
  const nodes = fromMarkdown(body).children;
  const index = nodes.findIndex(
    (node) => node.type === "heading" && node.depth === 2 && toString(node, { includeHtml: false }).trim() === heading,
  );
  if (index < 0) return { body, removed: false };
  const next = nodes.findIndex((node, i) => i > index && node.type === "heading" && node.depth <= 2);
  const start = nodes[index].position!.start.offset!;
  const end = next < 0 ? body.length : nodes[next].position!.start.offset!;
  const before = body.slice(0, start).replace(/\s*$/, "");
  const after = body.slice(end);
  return { body: after ? `${before}\n\n${after}` : `${before}\n`, removed: true };
}

export interface StrippedReadme {
  /** The README as pure content. */
  text: string;
  /** The personal frontmatter keys that were there. */
  fields: string[];
  /** It had a `## Log` section. */
  log: boolean;
  /** Concepts: the "My explanation" text taken out (the heading and its comments stay); null when empty. */
  explanation: string | null;
}

/** A README as pure content (spec §9.4): no personal frontmatter fields, no `## Log`, no "My explanation" text. */
export function stripReadme(text: string, kind: ReadmeKind): StrippedReadme {
  const { text: withoutFields, removed } = stripFrontmatter(text, LEGACY_PERSONAL_FIELDS[kind]);
  const { head, body } = parseMarkdown(withoutFields);
  const log = removeSection(body, "Log");
  let next = log.body;
  let explanation: string | null = null;
  if (kind === "concept") {
    const split = splitExplanation(next);
    if (split?.text) {
      explanation = split.text;
      next = joinExplanation(split, "");
    }
  }
  return { text: head + next, fields: removed, log: log.removed, explanation };
}
