import { type CatalogProblem, easyToHard } from "./catalog.ts";
import { seedFrom, shuffled } from "./random.ts";

/** What the phase-1 cycle reads (spec §6.2): content, the engine's pattern intros, and what the user has done. */
export interface LearnInput {
  /** Local date: it seeds the mix. */
  date: string;
  now: Date;
  /** Pattern order (patternOrder()). */
  order: readonly string[];
  /** The list's problems. */
  members: readonly CatalogProblem[];
  /** Problems per block, and mix items after each block (the preset's `block` and `mix_after_block`). */
  block: number;
  mixAfterBlock: number;
  /** pattern_intros, oldest first. */
  intros: readonly { pattern: string; at: Date }[];
  /** Items with any attempt, open or closed. */
  attempted: ReadonlySet<string>;
  /** When each item's first attempt closed. */
  firstClosed: ReadonlyMap<string, Date>;
  conceptOf(pattern: string): string | null;
  conceptLearned(slug: string): boolean;
}

export type LearnStep =
  /** The concept that opens the pattern, while it is not learned: nothing new comes after it today. */
  | { kind: "concept"; slug: string; pattern: string }
  | { kind: "block"; itemId: string; pattern: string; index: number; size: number }
  | { kind: "mix"; itemId: string; pattern: string | null };

export interface Planned {
  step: LearnStep;
  /** A pattern this step introduces: store it in pattern_intros only when the step is planned. */
  introduces: string | null;
}

/**
 * Phase 1's new items, in order (spec §6.2). For the current pattern (the last one introduced):
 * 1. its concept, while not learned, and the block is not done yet (then the cycle stops for today);
 * 2. the block: the first `block` problems of the pattern, easy to hard, among those not done when it was introduced;
 * 3. `mixAfterBlock` items drawn in an order seeded by the local date, from unattempted problems of introduced patterns;
 * 4. the next pattern with something left to do. Once every pattern is introduced, everything comes from the mix.
 * The caller pulls as many items as the day's budget allows; pulled items count as done for what follows.
 */
export function* learnSequence(input: LearnInput): Generator<Planned> {
  const intros = [...input.intros];
  const planned = new Set<string>();
  const plannedMix = new Map<string, number>();
  let pendingIntro: string | null = null;
  const takeIntro = (): string | null => {
    const pattern = pendingIntro;
    pendingIntro = null;
    return pattern;
  };
  const taken = (id: string): boolean => input.attempted.has(id) || planned.has(id);
  const membersOf = (pattern: string) => input.members.filter((member) => member.pattern === pattern);
  const blockOf = (intro: { pattern: string; at: Date }): string[] =>
    membersOf(intro.pattern)
      .filter((member) => {
        const closed = input.firstClosed.get(member.id);
        return closed === undefined || closed.getTime() >= intro.at.getTime();
      })
      .sort(easyToHard)
      .slice(0, input.block)
      .map((member) => member.id);
  const mixOrder = shuffled(
    input.members.map((member) => member.id).sort(),
    seedFrom(input.date),
  );
  const patternOf = new Map(input.members.map((member) => [member.id, member.pattern]));
  const mixPick = (): string | undefined => {
    const introduced = new Set(intros.map((intro) => intro.pattern));
    return mixOrder.find((id) => !taken(id) && introduced.has(patternOf.get(id) ?? ""));
  };
  const introduceNext = (): boolean => {
    const introduced = new Set(intros.map((intro) => intro.pattern));
    const next = input.order.find((pattern) => !introduced.has(pattern) && membersOf(pattern).some((member) => !taken(member.id)));
    if (!next) return false;
    intros.push({ pattern: next, at: input.now });
    pendingIntro = next;
    return true;
  };

  for (;;) {
    const current = intros.at(-1);
    if (!current) {
      if (!introduceNext()) break;
      continue;
    }
    const block = blockOf(current);
    const blockDone = block.every(taken);
    const concept = input.conceptOf(current.pattern);
    if (!blockDone && concept && !input.conceptLearned(concept)) {
      yield { step: { kind: "concept", slug: concept, pattern: current.pattern }, introduces: takeIntro() };
      return;
    }
    if (!blockDone) {
      const itemId = block.find((id) => !taken(id))!;
      planned.add(itemId);
      yield { step: { kind: "block", itemId, pattern: current.pattern, index: block.indexOf(itemId) + 1, size: block.length }, introduces: takeIntro() };
      continue;
    }
    if (block.length > 0) {
      const doneAt = Math.max(...block.map((id) => input.firstClosed.get(id)?.getTime() ?? input.now.getTime()));
      const mixedSince = input.members.filter((m) => !block.includes(m.id) && (input.firstClosed.get(m.id)?.getTime() ?? -1) >= doneAt).length;
      if (mixedSince + (plannedMix.get(current.pattern) ?? 0) < input.mixAfterBlock) {
        const itemId = mixPick();
        if (itemId) {
          planned.add(itemId);
          plannedMix.set(current.pattern, (plannedMix.get(current.pattern) ?? 0) + 1);
          yield { step: { kind: "mix", itemId, pattern: patternOf.get(itemId) ?? null }, introduces: takeIntro() };
          continue;
        }
      }
    }
    if (!introduceNext()) break;
  }
  // Every pattern is introduced: the mix is all that is left.
  for (let itemId = mixPick(); itemId; itemId = mixPick()) {
    planned.add(itemId);
    yield { step: { kind: "mix", itemId, pattern: patternOf.get(itemId) ?? null }, introduces: null };
  }
}
