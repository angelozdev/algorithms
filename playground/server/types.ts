import type { CaseMode, Lang, Param } from "../../runner/src/types.ts";

export type ItemStatus = "todo" | "solving" | "solved" | "revealed";
export type ConceptStatus = "new" | "learning" | "mastered";

export interface HomeProblem {
  id: string;
  title: string;
  difficulty: string | null;
  patterns: string[];
  /** Concept slugs from the frontmatter; [] when the field is missing or not a list. */
  concepts: string[];
  /** List slugs from the frontmatter (e.g. "grind-75"); [] when the field is missing or not a list. */
  lists: string[];
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
  mode: CaseMode;
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
  /**
   * "Start review" (study coach spec §7): the editor stays closed until the user starts the attempt from scratch;
   * null when it opens as usual.
   */
  gate: { kind: "review" | "exam" | "retry"; minutes: number } | null;
  /** An attempt started from scratch is open (a review, an exam, a retry): "Keep mine" would bring the old code back. */
  freshStart: boolean;
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
  /** The user's text: .study/explanations/<slug>.md, or (until pnpm study migrate) the README section's text; "" when there is none; null only when the README is broken. */
  explanation: string | null;
  /** From the next heading to the end ("" when the section is last or missing). */
  after: string;
  /** Version of the README and of .study/explanations/<slug>.md together. */
  version: string;
  readmeError: string | null;
}

export type { AnnouncementJson, NotInitializedJson, TodayItem, TodayJson } from "../../study/today.ts";

export type RepoEvent =
  | { kind: "solution"; target: string; lang: Lang; version: string }
  | { kind: "readme"; target?: string; concept?: string }
  | { kind: "cases" | "stress"; target: string }
  /** .study/state.json has a new version (study coach spec §10): recorded progress changed. */
  | { kind: "progress"; version: string };

export interface ApiErrorBody {
  error: string;
  issues?: string[];
}
