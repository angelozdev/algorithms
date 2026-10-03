import type { HomeConcept, HomeData, HomeExercise, HomeProblem, ItemStatus } from "../../server/types.ts";
import {
  conceptLabel,
  DIFFICULTIES,
  type Difficulty,
  difficultyLabel,
  difficultyOf,
  leetcodeNumber,
  patternLabel,
  STATUS_LABEL,
  type StatusKind,
  statusKind,
} from "../lib/labels.ts";
import type { GroupBy, HomeSearch, SortDir, SortKey } from "./search.ts";

export const NO_PATTERN_LABEL = "(no pattern yet)";
export const NO_CONCEPT_LABEL = "(no concept yet)";
export const NO_DIFFICULTY_LABEL = "No difficulty";
const STATUS_ORDER: readonly StatusKind[] = ["in-progress", "todo", "revealed", "solved"];

export interface ProblemGroup {
  /** Stable across renders, e.g. "pattern:two-pointers" or "status:solved". */
  key: string;
  label: string;
  /** The concept's slug when this is a concept group and the concept has a page in concepts/; otherwise null. */
  conceptSlug: string | null;
  problems: HomeProblem[];
}

/** True when the query is part of the id, the title, or the LeetCode number as text ("35" finds lc-0035). */
export function matchesQuery(item: { id: string; title: string }, q: string): boolean {
  const query = q.trim().toLowerCase();
  if (query === "") return true;
  const number = leetcodeNumber(item.id);
  return item.id.toLowerCase().includes(query) || item.title.toLowerCase().includes(query) || (number !== null && String(number).includes(query));
}

export type Facet = "difficulty" | "pattern" | "concept";

const FACET_VALUES: Record<Facet, (problem: HomeProblem) => readonly string[]> = {
  difficulty: (problem) => {
    const difficulty = difficultyOf(problem.difficulty);
    return difficulty ? [difficulty] : [];
  },
  pattern: (problem) => problem.patterns,
  concept: (problem) => problem.concepts,
};
const FACETS: readonly Facet[] = ["difficulty", "pattern", "concept"];

/** The problems that the search box, the status filter and the facet filters let through, in their given order. */
export function filterProblems(problems: readonly HomeProblem[], search: HomeSearch): HomeProblem[] {
  return problems.filter((problem) => {
    if (!matchesQuery(problem, search.q)) return false;
    if (search.status === "solved" && problem.status !== "solved") return false;
    if (search.status === "pending" && problem.status === "solved") return false;
    return FACETS.every((facet) => {
      const picked: readonly string[] = search[facet];
      return picked.length === 0 || FACET_VALUES[facet](problem).some((value) => picked.includes(value));
    });
  });
}

export interface FacetOption {
  value: string;
  label: string;
  count: number;
}

/**
 * The choices of one facet filter. A count is how many problems the other filters let through with that value, so
 * it says what picking the value would show. A value picked in the URL stays listed even when no problem has it,
 * so it can be unpicked.
 */
export function facetOptions(data: HomeData, search: HomeSearch, facet: Facet): FacetOption[] {
  const values = FACET_VALUES[facet];
  const withoutThisFacet: HomeSearch = {
    ...search,
    difficulty: facet === "difficulty" ? [] : search.difficulty,
    pattern: facet === "pattern" ? [] : search.pattern,
    concept: facet === "concept" ? [] : search.concept,
  };
  const others = filterProblems(data.problems, withoutThisFacet);
  const all = new Set<string>([...data.problems.flatMap((problem) => values(problem)), ...search[facet]]);
  const label = (value: string): string => {
    if (facet === "difficulty") return difficultyLabel(value as Difficulty);
    if (facet === "pattern") return patternLabel(value);
    return conceptLabel(value, data.concepts);
  };
  const options = [...all].map((value) => ({ value, label: label(value), count: others.filter((problem) => values(problem).includes(value)).length }));
  if (facet === "difficulty") {
    return options.sort((a, b) => DIFFICULTIES.indexOf(a.value as Difficulty) - DIFFICULTIES.indexOf(b.value as Difficulty));
  }
  return options.sort((a, b) => a.label.localeCompare(b.label));
}

/** Missing values (no LeetCode number, no difficulty) always come last, whatever the direction. */
function compareMissingLast(a: number | null, b: number | null, sign: number): number {
  if (a === null || b === null) {
    if (a === b) return 0;
    return a === null ? 1 : -1;
  }
  return sign * (a - b);
}

function difficultyRank(problem: HomeProblem): number | null {
  const difficulty = difficultyOf(problem.difficulty);
  return difficulty ? DIFFICULTIES.indexOf(difficulty) : null;
}

/** A sorted copy. Ties break by LeetCode number, ascending; ids without a number sort after the rest, by id. */
export function sortProblems(problems: readonly HomeProblem[], sort: SortKey, dir: SortDir): HomeProblem[] {
  const sign = dir === "asc" ? 1 : -1;
  const byNumber = (direction: number) => (a: HomeProblem, b: HomeProblem) =>
    compareMissingLast(leetcodeNumber(a.id), leetcodeNumber(b.id), direction) || a.id.localeCompare(b.id);
  const compare = (a: HomeProblem, b: HomeProblem): number => {
    if (sort === "title") return sign * a.title.localeCompare(b.title) || byNumber(1)(a, b);
    if (sort === "difficulty") return compareMissingLast(difficultyRank(a), difficultyRank(b), sign) || byNumber(1)(a, b);
    return byNumber(sign)(a, b);
  };
  return [...problems].sort(compare);
}

interface Bucket {
  key: string;
  label: string;
  conceptSlug: string | null;
  /** Orders groups before their labels do: special groups go last, statuses and difficulties keep their order. */
  rank: number;
}

function bucketsOf(problem: HomeProblem, by: GroupBy, concepts: readonly HomeConcept[]): Bucket[] {
  switch (by) {
    case "none":
      return [{ key: "all", label: "All problems", conceptSlug: null, rank: 0 }];
    case "pattern":
      if (problem.patterns.length === 0) return [{ key: "pattern:", label: NO_PATTERN_LABEL, conceptSlug: null, rank: 1 }];
      return problem.patterns.map((slug) => ({ key: `pattern:${slug}`, label: patternLabel(slug), conceptSlug: null, rank: 0 }));
    case "concept":
      if (problem.concepts.length === 0) return [{ key: "concept:", label: NO_CONCEPT_LABEL, conceptSlug: null, rank: 1 }];
      return problem.concepts.map((slug) => ({
        key: `concept:${slug}`,
        label: conceptLabel(slug, concepts),
        conceptSlug: concepts.some((concept) => concept.slug === slug) ? slug : null,
        rank: 0,
      }));
    case "difficulty": {
      const difficulty = difficultyOf(problem.difficulty);
      if (!difficulty) return [{ key: "difficulty:", label: NO_DIFFICULTY_LABEL, conceptSlug: null, rank: DIFFICULTIES.length }];
      return [{ key: `difficulty:${difficulty}`, label: difficultyLabel(difficulty), conceptSlug: null, rank: DIFFICULTIES.indexOf(difficulty) }];
    }
    case "status": {
      const kind = statusKind(problem.status, problem.inProgress);
      return [{ key: `status:${kind}`, label: STATUS_LABEL[kind], conceptSlug: null, rank: STATUS_ORDER.indexOf(kind) }];
    }
  }
}

/**
 * Splits problems (already filtered and sorted) into groups, keeping their order inside each group. A problem with
 * several patterns or concepts is in each of their groups. Only groups with problems are returned.
 */
export function groupProblems(problems: readonly HomeProblem[], by: GroupBy, concepts: readonly HomeConcept[]): ProblemGroup[] {
  const groups = new Map<string, ProblemGroup & { rank: number }>();
  for (const problem of problems) {
    for (const bucket of bucketsOf(problem, by, concepts)) {
      const group = groups.get(bucket.key) ?? { ...bucket, problems: [] };
      if (!group.problems.includes(problem)) group.problems.push(problem);
      groups.set(bucket.key, group);
    }
  }
  return [...groups.values()]
    .sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label))
    .map(({ key, label, conceptSlug, problems: members }) => ({ key, label, conceptSlug, problems: members }));
}

export interface ProblemList {
  groups: ProblemGroup[];
  /** Distinct problems that pass the filters (a problem in two groups counts once). */
  matching: number;
}

export function problemList(data: HomeData, search: HomeSearch): ProblemList {
  const shown = sortProblems(filterProblems(data.problems, search), search.sort, search.dir);
  return { groups: groupProblems(shown, search.group, data.concepts), matching: shown.length };
}

export interface ContinueItem {
  id: string;
  title: string;
  status: ItemStatus;
  inProgress: boolean;
  difficulty: string | null;
  /** The first pattern of a problem, or the concept of an exercise. */
  context: string | null;
}

/** Problems, then exercises, that are in progress and match the search box. */
export function continueItems(data: HomeData, q: string): ContinueItem[] {
  const problems = data.problems
    .filter((p) => p.inProgress)
    .map((p) => ({ id: p.id, title: p.title, status: p.status, inProgress: true, difficulty: p.difficulty, context: p.patterns[0] ? patternLabel(p.patterns[0]) : null }));
  const exercises = data.concepts.flatMap((concept) =>
    concept.exercises
      .filter((e) => e.inProgress)
      .map((e) => ({ id: e.id, title: e.title, status: e.status, inProgress: true, difficulty: null, context: concept.title })),
  );
  return [...problems, ...exercises].filter((item) => matchesQuery(item, q));
}

export interface ConceptRow {
  concept: HomeConcept;
  /** The exercises that match the search box. */
  exercises: HomeExercise[];
  /** Solved exercises of the concept, whatever the search. */
  solved: number;
}

/** A concept shows when its slug or title, or one of its exercises, matches the search box. */
export function conceptRows(data: HomeData, q: string): ConceptRow[] {
  return data.concepts.flatMap((concept) => {
    const exercises = concept.exercises.filter((e) => matchesQuery(e, q));
    const shown = matchesQuery({ id: concept.slug, title: concept.title }, q) || exercises.length > 0;
    return shown ? [{ concept, exercises, solved: concept.exercises.filter((e) => e.status === "solved").length }] : [];
  });
}
