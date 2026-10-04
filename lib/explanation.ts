import type { RootContent } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { toString } from "mdast-util-to-string";

export const EXPLANATION_HEADING = "My explanation";

/** A README body cut around its "## My explanation" section. joinExplanation(split, split.text) gives the body back. */
export interface ExplanationSplit {
  /** Everything before the heading. */
  before: string;
  /** The heading line as written. */
  heading: string;
  /** HTML comments at the start of the section (the "write it yourself" note). */
  comments: string[];
  /** The user's text, trimmed. */
  text: string;
  /** From the next heading of depth ≤ 2 to the end ("" when the section is last). */
  after: string;
}

const startOf = (node: RootContent): number => node.position!.start.offset!;
const endOf = (node: RootContent): number => node.position!.end.offset!;
const isComment = (node: RootContent): boolean => node.type === "html" && /^<!--[\s\S]*-->$/.test(node.value.trim());
const endsSection = (node: RootContent): boolean => node.type === "heading" && node.depth <= 2;

/** Finds the section from the real Markdown structure, so a "## " line inside a code block is not a heading. */
export function splitExplanation(body: string): ExplanationSplit | null {
  const nodes = fromMarkdown(body).children;
  const index = nodes.findIndex(
    (node) => node.type === "heading" && node.depth === 2 && toString(node, { includeHtml: false }).trim() === EXPLANATION_HEADING,
  );
  if (index < 0) return null;
  const next = nodes.findIndex((node, i) => i > index && endsSection(node));
  const sectionEnd = next < 0 ? body.length : startOf(nodes[next]);
  const inner = nodes.slice(index + 1, next < 0 ? undefined : next);
  let first = 0;
  while (first < inner.length && isComment(inner[first])) first++;
  const textStart = first < inner.length ? startOf(inner[first]) : sectionEnd;
  return {
    before: body.slice(0, startOf(nodes[index])),
    heading: body.slice(startOf(nodes[index]), endOf(nodes[index])),
    comments: inner.slice(0, first).map((node) => body.slice(startOf(node), endOf(node))),
    text: body.slice(textStart, sectionEnd).trim(),
    after: body.slice(sectionEnd),
  };
}

/** The body with the section's text replaced. The heading, the leading comments and everything else are kept. */
export function joinExplanation(split: ExplanationSplit, text: string): string {
  const blocks = [split.heading, ...split.comments, ...(text.trim() ? [text.trim()] : [])];
  return `${split.before}${blocks.join("\n\n")}${split.after ? "\n\n" : "\n"}${split.after}`;
}

/** Why `text` cannot be saved into the section, or [] when it can. */
export function explanationIssues(split: ExplanationSplit, text: string): string[] {
  const issues: string[] = [];
  if (fromMarkdown(text).children.some(endsSection)) {
    issues.push("Use ### or deeper for headings: a # or ## heading (or a line of --- under text) would end the section.");
  }
  if (/<!--\s*\/?auto/.test(text)) issues.push("Remove the <!-- auto --> markers: those blocks belong to pnpm sync.");
  if (issues.length === 0) {
    const again = splitExplanation(joinExplanation(split, text));
    if (!again || again.before !== split.before || again.after !== split.after) {
      issues.push("The text would change the rest of the README. Is a code block left open (``` without its closing ```)?");
    }
  }
  return issues;
}
