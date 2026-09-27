import { buildDraft, type LeetCodeQuestion, slugFrom } from "./lib/leetcode.ts";

const QUERY = `query question($titleSlug: String!) {
  question(titleSlug: $titleSlug) {
    questionFrontendId title titleSlug difficulty content exampleTestcases metaData
  }
}`;

async function main(): Promise<void> {
  const arg = process.argv[2];
  if (!arg) {
    console.error("Usage: pnpm -s leetcode <slug | url>");
    process.exitCode = 1;
    return;
  }
  const slug = slugFrom(arg);
  const response = await fetch("https://leetcode.com/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json", Referer: "https://leetcode.com", "User-Agent": "Mozilla/5.0" },
    body: JSON.stringify({ query: QUERY, variables: { titleSlug: slug } }),
  });
  if (!response.ok) throw new Error(`LeetCode answered HTTP ${response.status}`);
  const body = (await response.json()) as { data?: { question: LeetCodeQuestion | null } };
  const question = body.data?.question;
  if (!question?.content) {
    console.error(`No public problem found for "${slug}" (premium, or a wrong slug?).`);
    process.exitCode = 1;
    return;
  }
  console.log(JSON.stringify(buildDraft(question), null, 2));
}

main().catch((error: unknown) => {
  console.error(`Could not fetch from LeetCode: ${(error as Error).message}`);
  process.exitCode = 1;
});
