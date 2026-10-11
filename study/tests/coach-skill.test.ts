import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { REPO_ROOT } from "../../runner/src/paths.ts";
import { cleanupTempDirs } from "../../scripts/tests/fixture.ts";
import { type FixedClock, fixedClock } from "../clock.ts";
import { runStudyCli } from "../commands.ts";
import { recordWork } from "../record.ts";
import { openStudy } from "../store.ts";
import { DAY, makeCoachRepo, MONDAY, TZ } from "./coach-fixture.ts";

// The coach skill is instructions for Claude, so it is checked where it touches code (study coach spec §11):
// every command it runs is one the hook allows and the CLI accepts, every command it leaves to the user is one
// the hook denies, and its examples and vocabulary match what `pnpm -s today --json` returns.

afterEach(cleanupTempDirs);

const SKILL_DIR = path.join(REPO_ROOT, ".claude", "skills", "coach");
const SKILL = readFileSync(path.join(SKILL_DIR, "SKILL.md"), "utf8");
const EXAMPLES = readFileSync(path.join(SKILL_DIR, "examples.md"), "utf8");

/** The commands the skill tells Claude to run, exactly as it writes them (placeholders in angle brackets). */
const CLAUDE_RUNS = [
  "pnpm -s today --json",
  "pnpm -s today --json --refresh",
  "pnpm -s study ack <id>",
  "pnpm -s study status --json",
  "pnpm -s study phase --json",
  "pnpm -s study curriculum --json",
  "pnpm -s study curriculum set <preset> --json",
  "pnpm -s study curriculum expand <list> --json",
  "pnpm -s study init --minutes <n> --lang <lang>",
  "pnpm -s study init --minutes <n>",
  "pnpm -s study init --lang <lang>",
];

/** The study commands only the user runs (spec §10, the guard), as the skill quotes them for the user. */
const USER_ONLY = [
  "pnpm study start <id>",
  "pnpm study pause",
  "pnpm study resume",
  "pnpm study phase set <phase>",
  "pnpm study migrate --dry-run",
  "pnpm study migrate",
];

/** Every `pnpm …` span in the skill and its examples. examples.md acknowledges real ids (`pnpm -s study ack 7`). */
function quoted(): string[] {
  const spans = [...`${SKILL}\n${EXAMPLES}`.matchAll(/`(pnpm [^`]+)`/g)].map((match) => match[1]);
  return [...new Set(spans.map((span) => span.replace(/^pnpm -s study ack \d+$/, "pnpm -s study ack <id>")))];
}

function fill(command: string, values: Record<string, string>): string {
  return command.replace(/<(\w+)>/g, (whole, name: string) => values[name] ?? whole);
}

/** What the PreToolUse guard decides for a Bash command (scripts/tests/hooks.test.ts runs the hook the same way). */
function guard(command: string): string {
  const run = spawnSync(process.execPath, [path.join(REPO_ROOT, ".claude", "hooks", "guard-solution.mjs")], {
    input: JSON.stringify({ tool_name: "Bash", tool_input: { command } }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: "/work/algorithms" },
    encoding: "utf8",
  });
  expect(run.status).toBe(0);
  return run.stdout ? (JSON.parse(run.stdout).hookSpecificOutput?.permissionDecision ?? "allow") : "allow";
}

/** Splits SKILL.md on its `## ` headings (ruling (a)'s pin reads the §3, §6, §7 and §9 sections). */
function skillSections(markdown: string): Record<string, string> {
  const sections: Record<string, string> = {};
  for (const part of markdown.split(/^## /m).slice(1)) {
    const end = part.indexOf("\n");
    sections[part.slice(0, end).trim()] = part.slice(end + 1);
  }
  return sections;
}

/** The body of the first `## ` heading that starts with `prefix` (e.g. "3. " for "## 3. Onboarding …", or "Never"). */
function section(markdown: string, prefix: string): string {
  const sections = skillSections(markdown);
  const heading = Object.keys(sections).find((key) => key.startsWith(prefix));
  if (!heading) throw new Error(`no "## ${prefix}…" heading in SKILL.md`);
  return sections[heading];
}

const SAMPLE = { id: "3", preset: "neetcode-150", list: "grind-169", n: "30", lang: "py", phase: "learn" };

// `pnpm -s today --json`, as Plan B's "Interfaces for Plan C" defines it. Strict: a field the CLI adds or renames
// fails here, so the skill and its examples are updated with it.
const phaseId = z.enum(["bases", "learn", "master", "expand", "pro"]);
const presetPhase = z.object({ preset: z.string(), phase: phaseId }).strict();
const fromTo = z.object({ from: phaseId, to: phaseId }).strict();
const announcement = z.discriminatedUnion("key", [
  z.object({ id: z.number().int(), key: z.literal("coach-started"), at: z.string(), payload: presetPhase }).strict(),
  z.object({ id: z.number().int(), key: z.literal("phase-advanced"), at: z.string(), payload: fromTo }).strict(),
  z.object({ id: z.number().int(), key: z.literal("phase-set"), at: z.string(), payload: fromTo }).strict(),
  z
    .object({ id: z.number().int(), key: z.literal("curriculum-switched"), at: z.string(), payload: z.object({ from: presetPhase, to: presetPhase }).strict() })
    .strict(),
  z
    .object({ id: z.number().int(), key: z.literal("welcome-back"), at: z.string(), payload: z.object({ date: z.string(), daysAway: z.number().int() }).strict() })
    .strict(),
]);
const todayJson = z
  .object({
    initialized: z.literal(true),
    started: z.boolean(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    paused: z.object({ since: z.string() }).strict().nullable(),
    phase: z
      .object({
        id: phaseId,
        since: z.string(),
        preset: z.string(),
        progress: z.object({ done: z.number().int(), total: z.number().int() }).strict(),
        list: z.object({ list: z.string(), imported: z.number().int(), size: z.number().int().nullable() }).strict().nullable(),
        expansion: z.object({ list: z.string().nullable(), choices: z.array(z.string()) }).strict().nullable(),
      })
      .strict()
      .nullable(),
    announcements: z.array(announcement),
    mode: z.enum(["normal", "return", "catch-up"]),
    items: z.array(
      z
        .object({
          kind: z.enum(["continue", "review", "new", "concept", "exam"]),
          id: z.string(),
          title: z.string(),
          minutes: z.number(),
          reason: z.string(),
          done: z.boolean(),
          missing: z.boolean(),
        })
        .strict(),
    ),
    backlog: z.object({ waiting: z.number().int(), days: z.number().int() }).strict(),
    budget: z.object({ minutes: z.number(), planned: z.number() }).strict(),
  })
  .strict();
const todayResponse = z.union([z.object({ initialized: z.literal(false), next: z.enum(["init", "migrate"]) }).strict(), todayJson]);

describe("the coach skill (study coach spec §11)", () => {
  it("runs exactly the study commands listed here, and quotes the user-only ones for the user", () => {
    const spans = quoted();
    expect(new Set(spans.filter((span) => span.startsWith("pnpm -s ")))).toEqual(new Set(CLAUDE_RUNS));
    for (const command of USER_ONLY) expect(spans, command).toContain(command);
  });

  it("only runs commands the hook allows, and leaves to the user exactly the ones the hook denies", () => {
    for (const command of CLAUDE_RUNS) expect(guard(fill(command, SAMPLE)), command).toBe("allow");
    for (const command of USER_ONLY) expect(guard(fill(command, SAMPLE)), command).toBe("deny");
  });

  it("names every announcement, kind, phase and reason that pnpm -s today --json returns", () => {
    const words = [
      ...["coach-started", "phase-advanced", "phase-set", "curriculum-switched", "welcome-back"],
      ...["continue", "review", "exam", "new", "concept"],
      ...["bases", "learn", "master", "expand", "pro"],
      ...["in progress", "in progress · <name>", "due today", "due yesterday", "due N days ago", "block i/n · <pattern>", "mix · <pattern>"],
      ...["opens <pattern>", "bases i/n", "exam i/n", "expand · <list>", "practice"],
    ];
    for (const word of words) expect(SKILL, word).toContain(`\`${word}\``);
  });

  it("shows only real shapes of pnpm -s today --json in its examples", () => {
    const blocks = [...EXAMPLES.matchAll(/```json\n([\s\S]*?)\n```/g)].map((match) => match[1]);
    expect(blocks).toHaveLength(6);
    for (const block of blocks) expect(() => todayResponse.parse(JSON.parse(block)), block.slice(0, 60)).not.toThrow();
  });

  it("refreshes the stored day plan right after a change of list or phase (ruling a)", () => {
    for (const prefix of ["3. ", "7. ", "9. "]) expect(section(SKILL, prefix), prefix).toContain("`pnpm -s today --json --refresh`");
    // §6's staleness sentence, not just anywhere in §6: `phase-set`/`curriculum-switched` are also the pre-existing
    // table's own `key` column, so a bare "appears somewhere in §6" check would pass even without this sentence.
    const announcements = section(SKILL, "6. ");
    const staleness = announcements.match(/^.*the stored plan may predate that change.*$/m)?.[0];
    expect(staleness, announcements).toBeTruthy();
    expect(staleness).toContain("`pnpm -s today --json --refresh`");
    expect(staleness).toContain("`phase-set`");
    expect(staleness).toContain("`curriculum-switched`");
  });

  it("stops cleanly when a study command exits non-zero with no JSON (ruling b)", async () => {
    const root = makeCoachRepo();
    const clock: FixedClock = fixedClock(MONDAY);
    const cli = async (argv: string[]) => {
      let out = "";
      let err = "";
      const code = await runStudyCli(argv, { root, clock, out: (text) => (out += text), err: (text) => (err += text) });
      return { code, out, err };
    };
    expect((await cli(["init", "--timezone", TZ])).code).toBe(0);
    expect((await cli(["curriculum", "set", "demo-list", "--json"])).code).toBe(0);
    writeFileSync(path.join(root, "curriculum", "demo-list.yaml"), "id: demo-list\n");
    const broken = await cli(["today", "--json"]);
    expect(broken.code).toBe(1);
    expect(broken.out).toBe("");
    expect(broken.err).toContain("is not a valid preset");
    expect(SKILL).toContain("is not a valid preset");
  });

  it("never passes --surface to the ack command (ruling c)", () => {
    for (const span of quoted()) expect(span, span).not.toContain("--surface");
    expect(section(SKILL, "Never")).toContain("--surface");
  });

  it("works against the CLI in a session from the first question to phase 1, with the shapes it reads", async () => {
    const root = makeCoachRepo();
    const clock: FixedClock = fixedClock(MONDAY);
    const ran = new Set<string>();
    const cli = async (argv: string[]) => {
      let out = "";
      let err = "";
      const code = await runStudyCli(argv, { root, clock, out: (text) => (out += text), err: (text) => (err += text) });
      return { code, out, err, json: () => JSON.parse(out) };
    };
    /** One of the skill's commands, as Claude types it, run in-process through the study CLI. */
    const run = (command: string, values: Record<string, string> = {}) => {
      ran.add(command);
      const words = fill(command, values).split(" ").slice(2); // drop "pnpm -s"
      expect(words.join(" "), command).not.toMatch(/[<>]/);
      return cli(words[0] === "study" ? words.slice(1) : words);
    };
    const today = async () => {
      const result = await run("pnpm -s today --json");
      expect(result.code, result.err).toBe(0);
      return todayResponse.parse(result.json());
    };
    /** The command the skill now runs right after a change of list or phase (ruling a). */
    const todayRefreshed = async () => {
      const result = await run("pnpm -s today --json --refresh");
      expect(result.code, result.err).toBe(0);
      return todayResponse.parse(result.json());
    };

    // No database: the skill sends the user to `pnpm study init` (SKILL.md §2).
    expect(await today()).toEqual({ initialized: false, next: "init" });
    expect((await run("pnpm -s study status --json")).json().coach).toEqual({ started: false, preset: null, phase: null, paused: false, expansionList: null });
    expect((await cli(["init", "--timezone", TZ])).code).toBe(0); // the user's `pnpm study init`

    // Onboarding (§3).
    expect(await today()).toMatchObject({ initialized: true, started: false, phase: null });
    expect((await run("pnpm -s study curriculum --json")).json().presets).toContainEqual({ id: "demo-list", list: "demo-list", imported: 8, size: 8 });
    expect((await run("pnpm -s study init --minutes <n> --lang <lang>", { n: "30", lang: "py" })).code).toBe(0);
    expect((await run("pnpm -s study curriculum set <preset> --json", { preset: "demo-list" })).json()).toMatchObject({ status: "started", phase: "bases" });

    // The plan, its announcement and the acknowledgment (§5, §6). Reads with --refresh (ruling a, §3 step 4).
    const first = (await todayRefreshed()) as z.infer<typeof todayJson>;
    expect(first).toMatchObject({ started: true, budget: { minutes: 30 }, announcements: [{ key: "coach-started" }] });
    const id = String(first.announcements[0].id);
    expect((await run("pnpm -s study ack <id>", { id })).out).toBe(`Acknowledged announcement ${id} (chat).\n`);
    expect(await today()).toMatchObject({ announcements: [] });
    expect((await run("pnpm -s today --json --refresh")).code).toBe(0);
    expect((await run("pnpm -s study status --json")).json().coach).toEqual({ started: true, preset: "demo-list", phase: "bases", paused: false, expansionList: null });
    expect((await run("pnpm -s study phase --json")).json()).toMatchObject({ started: true, phase: "bases", exitMet: false });

    // Lists (§7–§9): one that is not imported, the current one, and an expansion choice.
    const refused = await run("pnpm -s study curriculum set <preset> --json", { preset: "ghost-list" });
    expect(refused.code).toBe(1);
    expect(refused.json()).toMatchObject({ status: "refused", preset: "ghost-list", list: "ghost-list" });
    expect((await run("pnpm -s study curriculum set <preset> --json", { preset: "demo-list" })).json()).toEqual({ status: "unchanged", preset: "demo-list" });
    expect((await run("pnpm -s study curriculum expand <list> --json", { list: "wide-list" })).json()).toMatchObject({ status: "set", list: "wide-list", imported: 11, size: 12 });

    // Profile changes (§10).
    expect((await run("pnpm -s study init --minutes <n>", { n: "45" })).code).toBe(0);
    expect((await run("pnpm -s study init --lang <lang>", { lang: "ts" })).code).toBe(0);

    // Both base concepts learned: the next day is phase 1, with its list and an announcement (§5, §6).
    for (const slug of ["basics-a", "basics-b"]) {
      expect((await cli(["record", "explanation", slug])).code).toBe(0);
      const study = openStudy(root, { clock });
      try {
        recordWork(study, `${slug}/01`, { type: "run", lang: "py", green: true }, "cli");
      } finally {
        study.close();
      }
    }
    clock.advance(DAY);
    expect(await today()).toMatchObject({
      phase: { id: "learn", preset: "demo-list", list: { list: "demo-list", imported: 8, size: 8 } },
      announcements: [{ key: "phase-advanced", payload: { from: "bases", to: "learn" } }],
    });

    // An explicit switch (§9, ruling a): wide-list is also a preset of its own, not just an expansion choice.
    expect((await run("pnpm -s study curriculum set <preset> --json", { preset: "wide-list" })).json()).toMatchObject({ status: "switched" });
    const switched = (await todayRefreshed()) as z.infer<typeof todayJson>;
    expect(switched).toMatchObject({
      phase: { preset: "wide-list" },
      announcements: expect.arrayContaining([
        expect.objectContaining({ key: "curriculum-switched", payload: expect.objectContaining({ from: expect.objectContaining({ preset: "demo-list" }) }) }),
      ]),
    });

    expect([...ran].sort()).toEqual([...CLAUDE_RUNS].sort());
  });
});
