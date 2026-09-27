import { parse } from "yaml";

export interface ParsedMarkdown {
  /** Frontmatter block including both `---` fences and the trailing newline ("" if none). */
  head: string;
  data: Record<string, unknown>;
  body: string;
}

const FENCE = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

export function parseMarkdown(text: string): ParsedMarkdown {
  const match = FENCE.exec(text);
  if (!match) return { head: "", data: {}, body: text };
  const data: unknown = parse(match[1]) ?? {};
  if (typeof data !== "object" || Array.isArray(data)) {
    throw new Error("frontmatter must be a YAML mapping");
  }
  return { head: match[0], data: data as Record<string, unknown>, body: text.slice(match[0].length) };
}
