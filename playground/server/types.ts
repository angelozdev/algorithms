import type { Lang, Param } from "../../runner/src/types.ts";

export type ItemStatus = "todo" | "solving" | "solved" | "revealed";
export type ConceptStatus = "new" | "learning" | "mastered";

export interface HomeProblem {
  id: string;
  title: string;
  difficulty: string | null;
  patterns: string[];
  status: ItemStatus;
  inProgress: boolean;
  /** README missing or its frontmatter unparsable. */
  error: string | null;
}

export interface HomeExercise {
  id: string;
  title: string;
  status: ItemStatus;
  inProgress: boolean;
  error: string | null;
}

export interface HomeConcept {
  slug: string;
  title: string;
  status: ConceptStatus;
  error: string | null;
  exercises: HomeExercise[];
}

export interface HomeData {
  problems: HomeProblem[];
  /** Same grouping as INDEX.md: patterns sorted, a problem under each of its patterns. */
  groups: { pattern: string; ids: string[] }[];
  concepts: HomeConcept[];
}

export interface Signature {
  mode: "function" | "class";
  entry: string;
  params: Param[];
  returns: string | null;
}

export interface TargetData {
  id: string;
  kind: "problem" | "exercise";
  title: string;
  /** Repo-relative README path, for resolving the links inside it. */
  readme: string;
  /** README body without the frontmatter ("" when readmeError is set). */
  markdown: string;
  readmeError: string | null;
  difficulty: string | null;
  url: string | null;
  status: ItemStatus;
  hints: number;
  /** null when cases.json is invalid. */
  signature: Signature | null;
  /** Input of Example 1, to fill the custom input (null when there is none). */
  exampleInput: unknown;
  /** Invalid cases.json, or hidden cases without expected values. */
  caseError: string | null;
  solutions: Record<Lang, boolean>;
}

export interface SolutionData {
  code: string;
  /** Content hash: equal versions mean equal bytes. */
  version: string;
}

export interface ConceptData {
  slug: string;
  title: string;
  status: ConceptStatus;
  readme: string;
  /** README body up to the "## My explanation" heading (the whole body when the section is missing). */
  before: string;
  /** The user's text without the section's leading HTML comments; null when the section is missing. */
  explanation: string | null;
  /** From the next heading to the end ("" when the section is last or missing). */
  after: string;
  /** Version of the whole README file. */
  version: string;
  readmeError: string | null;
}

export type RepoEvent =
  | { kind: "solution"; target: string; lang: Lang; version: string }
  | { kind: "readme"; target?: string; concept?: string }
  | { kind: "cases" | "stress"; target: string };

export interface ApiErrorBody {
  error: string;
  issues?: string[];
}
