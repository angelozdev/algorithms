import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { put } from "../../../scripts/tests/fixture.ts";
import { fixedClock } from "../../../study/clock.ts";
import { recordWork } from "../../../study/record.ts";
import { openStudy } from "../../../study/store.ts";
import { setCurriculum } from "../../../study/switch.ts";
import { pendingAnnouncements } from "../../../study/today.ts";
import { createApp } from "../../server/app.ts";
import { call, makeRepo, PY_SUM, removeRepos } from "./helpers.ts";

afterEach(() => {
  removeRepos();
  vi.unstubAllEnvs();
});

// See targets.test.ts: Response.json() is Promise<unknown> under the root tsconfig.
const json = async (res: Response) => ({ status: res.status, body: (await res.json()) as any });

const NOW = "2026-11-04T14:00:00.000Z";
const PRESET = [
  "id: server-list",
  "phases:",
  "  bases: { concepts: [hash-map] }",
  "  learn: { list: server-list, size: 2, block: 3, mix_after_block: 3 }",
  "  master: { list: server-list, first_try_success: 0.8 }",
  "  expand: { choose_from: [server-list], window: 20, unseen_medium_success: 0.65, medium_minutes: 35 }",
  "  pro: { tracks: [interview] }",
  "patterns:",
  "  - { pattern: arrays-hashing, concept: hash-map }",
  "  - { pattern: stack, concept: stack }",
  "timebox_minutes: { easy: 15, medium: 35, hard: 50 }",
  "",
].join("\n");

/** makeRepo's two problems in a list with a preset; the coach started 30 days before NOW, when lc-0020 was solved. */
function coachRepo(): string {
  const root = makeRepo();
  for (const rel of ["problems/lc-0001-two-sum/README.md", "problems/lc-0020-valid-parentheses/README.md"]) {
    put(root, rel, readFileSync(path.join(root, rel), "utf8").replace(/^concepts: (.*)$/m, "concepts: $1\nlists: [server-list]"));
  }
  put(root, "curriculum/server-list.yaml", PRESET);
  const study = openStudy(root, { clock: fixedClock("2026-10-05T14:00:00.000Z") });
  setCurriculum(study, root, "server-list", study.clock.now());
  put(root, ".study/solutions/problems/lc-0020/solution.py", PY_SUM);
  recordWork(study, "lc-0020", { type: "run", lang: "py", green: true }, "cli");
  study.close();
  vi.stubEnv("ALGO_STUDY_NOW", NOW);
  return root;
}

describe("GET /api/study/today", () => {
  it("says what to run before the study database exists", async () => {
    const { status, body } = await json(await call(createApp({ root: makeRepo({ study: false }) }), "/api/study/today"));
    expect(status).toBe(200);
    expect(body).toEqual({ initialized: false, next: "init" });
  });

  it("returns the plan and the announcements the playground has not acknowledged", async () => {
    const root = coachRepo();
    const app = createApp({ root });
    const { body } = await json(await call(app, "/api/study/today"));
    expect(body).toMatchObject({
      started: true,
      date: "2026-11-04",
      phase: { id: "bases", preset: "server-list" },
      // Nothing was recorded for 30 days: return mode, with its welcome.
      mode: "return",
      announcements: [
        { id: 1, key: "coach-started", payload: { preset: "server-list", phase: "bases" } },
        { id: 2, key: "welcome-back", payload: { date: "2026-11-04", daysAway: 30 } },
      ],
      items: [
        { kind: "review", id: "lc-0020", title: "Valid Parentheses" },
        { kind: "concept", id: "hash-map", title: "Hash map" },
      ],
    });
  });
});

describe("POST /api/study/ack/:id", () => {
  it("acknowledges an announcement for the playground only", async () => {
    const root = coachRepo();
    const app = createApp({ root });
    expect(await json(await call(app, "/api/study/ack/1", { json: {} }))).toEqual({ status: 200, body: { acked: true } });
    expect(await json(await call(app, "/api/study/ack/1", { json: {} }))).toEqual({ status: 200, body: { acked: false } });
    expect((await call(app, "/api/study/ack/9", { json: {} })).status).toBe(404);
    expect((await json(await call(app, "/api/study/today"))).body.announcements.map((a: { key: string }) => a.key)).toEqual(["welcome-back"]);
    const study = openStudy(root);
    expect(pendingAnnouncements(study.db, "chat").map((a) => a.key)).toEqual(["coach-started", "welcome-back"]);
    study.close();
  });
});

describe("POST /api/study/pause and /resume", () => {
  it("pauses and resumes, and the plan waits meanwhile", async () => {
    const app = createApp({ root: coachRepo() });
    expect(await json(await call(app, "/api/study/pause", { json: {} }))).toEqual({ status: 200, body: { since: NOW } });
    expect((await json(await call(app, "/api/study/today"))).body).toMatchObject({ paused: { since: NOW }, items: [] });
    expect(await json(await call(app, "/api/study/resume", { json: {} }))).toEqual({ status: 200, body: { resumed: true } });
    expect((await json(await call(app, "/api/study/today"))).body.paused).toBeNull();
  });

  it("answer 409 before the study database exists", async () => {
    const app = createApp({ root: makeRepo({ study: false }) });
    expect((await call(app, "/api/study/pause", { json: {} })).status).toBe(409);
  });
});

describe("POST /api/study/start/:id", () => {
  it("shows the gate for a due review, archives the solution, writes a stub, and opens the attempt", async () => {
    const root = coachRepo();
    const app = createApp({ root });
    expect((await json(await call(app, "/api/target?id=lc-0020"))).body).toMatchObject({ gate: { kind: "review", minutes: 9 }, freshStart: false });
    const started = await json(await call(app, "/api/study/start/lc-0020", { json: { lang: "py" } }));
    expect(started).toEqual({ status: 200, body: { kind: "review" } });
    const history = path.join(root, ".study/solutions/problems/lc-0020/history");
    expect(readdirSync(history)).toEqual(["2026-11-04T14-00-00-000Z.py"]);
    expect(readFileSync(path.join(history, "2026-11-04T14-00-00-000Z.py"), "utf8")).toBe(PY_SUM);
    expect(readFileSync(path.join(root, ".study/solutions/problems/lc-0020/solution.py"), "utf8")).toContain("def solve(self, nums: list[int]) -> int:");
    expect((await json(await call(app, "/api/target?id=lc-0020"))).body).toMatchObject({ gate: null, freshStart: true, status: "solving" });
    expect(await json(await call(app, "/api/study/start/lc-0020", { json: { lang: "py" } }))).toMatchObject({ status: 409 });
  });

  it("refuses an exercise that was never tried (ids with a slash work), and an unknown id", async () => {
    const app = createApp({ root: coachRepo() });
    expect(await json(await call(app, "/api/study/start/hash-map/01", { json: { lang: "py" } }))).toEqual({
      status: 409,
      body: { error: "hash-map/01 was never tried: its first attempt starts with your first edit or run." },
    });
    expect((await call(app, "/api/study/start/lc-9999", { json: { lang: "py" } })).status).toBe(404);
    expect(existsSync(path.join(makeRepo({ study: false }), ".study"))).toBe(false);
  });
});
