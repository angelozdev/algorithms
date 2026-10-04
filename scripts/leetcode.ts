import { readFileSync } from "node:fs";
import { parseMarkdown } from "../lib/frontmatter.ts";
import {
  buildDraft,
  buildList,
  copiedRuns,
  htmlToText,
  type LeetCodeQuestion,
  type ListQuestion,
  listSlugFrom,
  slugFrom,
  statementSection,
} from "./lib/leetcode.ts";

const QUESTION_QUERY = `query question($titleSlug: String!) {
  question(titleSlug: $titleSlug) {
    questionFrontendId title titleSlug difficulty content exampleTestcases metaData
  }
}`;

const LIST_QUERY = `query list($slug: String!) {
  favoriteDetailV2(favoriteSlug: $slug) { name }
  favoriteQuestionList(favoriteSlug: $slug, limit: 200, skip: 0) {
    totalLength
    questions { questionFrontendId title titleSlug difficulty paidOnly }
  }
}`;

const USAGE = "Usage: pnpm -s leetcode <slug | url> | --list <slug | url> | --check-paraphrase <README path>";

async function graphql<T>(query: string, variables: Record<string, unknown>): Promise<T | undefined> {
  const response = await fetch("https://leetcode.com/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json", Referer: "https://leetcode.com", "User-Agent": "Mozilla/5.0" },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) throw new Error(`LeetCode answered HTTP ${response.status}`);
  return ((await response.json()) as { data?: T }).data;
}

async function question(slug: string): Promise<LeetCodeQuestion | null> {
  const data = await graphql<{ question: LeetCodeQuestion | null }>(QUESTION_QUERY, { titleSlug: slug });
  return data?.question?.content ? data.question : null;
}

async function printList(arg: string): Promise<void> {
  const slug = listSlugFrom(arg);
  const data = await graphql<{
    favoriteDetailV2: { name: string } | null;
    favoriteQuestionList: { totalLength: number; questions: ListQuestion[] } | null;
  }>(LIST_QUERY, { slug });
  const list = data?.favoriteQuestionList;
  if (!list) {
    console.error(`No public problem list found for "${slug}".`);
    process.exitCode = 1;
    return;
  }
  if (list.totalLength > list.questions.length) {
    console.error(`Warning: the list has ${list.totalLength} questions; only the first ${list.questions.length} were fetched.`);
  }
  console.log(JSON.stringify(buildList(data.favoriteDetailV2?.name ?? slug, list.questions), null, 2));
}

async function checkParaphrase(readmePath: string): Promise<void> {
  const readme = readFileSync(readmePath, "utf8");
  const url = parseMarkdown(readme).data.url;
  if (typeof url !== "string") throw new Error(`${readmePath} has no url in its frontmatter`);
  const original = await question(slugFrom(url));
  if (!original) throw new Error(`No public problem found for ${url}`);
  const copied = copiedRuns(htmlToText(original.content), statementSection(readme));
  console.log(JSON.stringify({ readme: readmePath, copied }, null, 2));
  if (copied.length > 0) process.exitCode = 1;
}

async function printDraft(arg: string): Promise<void> {
  const slug = slugFrom(arg);
  const found = await question(slug);
  if (!found) {
    console.error(`No public problem found for "${slug}" (premium, or a wrong slug?).`);
    process.exitCode = 1;
    return;
  }
  console.log(JSON.stringify(buildDraft(found), null, 2));
}

async function main(): Promise<void> {
  const [first, second] = process.argv.slice(2);
  if (!first || ((first === "--list" || first === "--check-paraphrase") && !second)) {
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }
  if (first === "--list") return printList(second);
  if (first === "--check-paraphrase") return checkParaphrase(second);
  return printDraft(first);
}

main().catch((error: unknown) => {
  console.error(`Could not fetch from LeetCode: ${(error as Error).message}`);
  process.exitCode = 1;
});
