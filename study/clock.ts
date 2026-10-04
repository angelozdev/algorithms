/** Where the engine reads the time (spec §6.3: tests fix the time zone and inject the clock). */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

export interface FixedClock extends Clock {
  set(at: Date | string): void;
  advance(ms: number): void;
}

/** A clock that only moves when a test moves it. */
export function fixedClock(start: Date | string): FixedClock {
  const parse = (value: Date | string): number => {
    const ms = new Date(value).getTime();
    if (Number.isNaN(ms)) throw new RangeError(`not a date: ${String(value)}`);
    return ms;
  };
  let current = parse(start);
  return {
    now: () => new Date(current),
    set: (at) => {
      current = parse(at);
    },
    advance: (ms) => {
      current += ms;
    },
  };
}

/** ALGO_STUDY_NOW=<ISO time> freezes the clock of the study CLI and the runner's recording (CLI tests, e2e). */
export function envClock(env: NodeJS.ProcessEnv = process.env): Clock {
  return env.ALGO_STUDY_NOW ? fixedClock(env.ALGO_STUDY_NOW) : systemClock;
}
