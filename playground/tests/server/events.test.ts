import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { writeStateFile } from "../../../study/state-file.ts";
import { createApp } from "../../server/app.ts";
import { classify, ignoredPath } from "../../server/events.ts";
import { contentVersion } from "../../server/solutions.ts";
import { type App, call, makeRepo, PY_SUM, removeRepos } from "./helpers.ts";

// EventHub polls every 300ms in production (cheap for a large content root); chokidar reads this env var
// at watch() time and lets it override that, so tests do not wait 300ms per step.
process.env.CHOKIDAR_INTERVAL = "50";

afterEach(removeRepos);

/** Reads Server-Sent Events from a response body, skipping comments. */
async function openEvents(app: App) {
  const res = await call(app, "/api/events");
  expect(res.headers.get("content-type")).toContain("text/event-stream");
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  const next = async (): Promise<{ event: string; data: string }> => {
    for (;;) {
      const end = buffer.indexOf("\n\n");
      if (end >= 0) {
        const block = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        if (block.startsWith(":")) continue;
        return { event: /^event: (.*)$/m.exec(block)?.[1] ?? "message", data: /^data: (.*)$/m.exec(block)?.[1] ?? "" };
      }
      const { value, done } = await reader.read();
      if (done) throw new Error("the event stream ended");
      buffer += value;
    }
  };
  return { next, close: () => reader.cancel() };
}

describe("classify", () => {
  const root = "/repo";
  it("maps files the app cares about to events", () => {
    expect(classify(root, "/repo/problems/lc-0001-two-sum/README.md")).toEqual({ kind: "readme", target: "lc-0001" });
    expect(classify(root, "/repo/concepts/hash-map/README.md")).toEqual({ kind: "readme", concept: "hash-map" });
    expect(classify(root, "/repo/concepts/hash-map/exercises/01-first-repeat/cases.json")).toEqual({ kind: "cases", target: "hash-map/01" });
    expect(classify(root, "/repo/problems/lc-0001-two-sum/stress.ts")).toEqual({ kind: "stress", target: "lc-0001" });
  });

  it("ignores everything else", () => {
    for (const file of [
      "/repo/problems/lc-0001-two-sum/notes.txt",
      "/repo/problems/lc-0001-two-sum/__pycache__/solution.cpython-313.pyc",
      "/repo/concepts/hash-map/cases.json",
      "/repo/INDEX.md",
      "/repo/runner/src/run.ts",
    ]) {
      expect(classify(root, file), file).toBeNull();
    }
  });

  it("maps the user's solutions under the study root to solution events, and ignores the rest of it", () => {
    expect(classify(root, "/repo/.study/solutions/problems/lc-0001/solution.py")).toEqual({
      kind: "solution",
      target: "lc-0001",
      lang: "py",
      version: contentVersion(""),
    });
    expect(classify(root, "/repo/.study/solutions/exercises/hash-map/01/solution.ts")).toMatchObject({ kind: "solution", target: "hash-map/01", lang: "ts" });
    expect(classify(root, "/progress/solutions/problems/lc-0001/solution.py", "/progress")).toMatchObject({ kind: "solution", target: "lc-0001" });
    for (const file of ["/repo/.study/solutions/problems/lc-0001/history/2026-10-04T10-00-00-000Z.py", "/repo/.study/study.db", "/repo/.study/tsconfig.json"]) {
      expect(classify(root, file), file).toBeNull();
    }
  });

  it("turns state.json into a progress event carrying its version", () => {
    expect(classify(root, "/repo/.study/state.json")).toEqual({ kind: "progress", version: "missing" });
    expect(ignoredPath("/repo", "/repo/.study", "/repo/.study/state.json")).toBe(false);
    expect(ignoredPath("/repo", "/repo/.study", "/repo/.study/.state.json.123.tmp")).toBe(true);
  });
});

describe("ignoredPath", () => {
  it("lets chokidar into problems/, concepts/ and the solutions under the study root, and nowhere else", () => {
    const kept = ["/repo", "/repo/problems/lc-0001-two-sum/README.md", "/repo/.study", "/repo/.study/solutions", "/repo/.study/solutions/problems/lc-0001/solution.py"];
    const skipped = [
      "/repo/runner/src/run.ts",
      "/repo/.study/study.db",
      "/repo/.study/study.db-wal",
      "/repo/.study/solutions/problems/lc-0001/history",
      "/repo/.study/exports/progress.json",
      "/repo/problems/lc-0001-two-sum/__pycache__",
    ];
    for (const file of kept) expect(ignoredPath("/repo", "/repo/.study", file), file).toBe(false);
    for (const file of skipped) expect(ignoredPath("/repo", "/repo/.study", file), file).toBe(true);
  });
});

describe("GET /api/events", () => {
  it("says when it is ready, then reports README, solution and case changes", async () => {
    const root = makeRepo();
    const events = await openEvents(createApp({ root }));
    try {
      expect((await events.next()).event).toBe("ready");
      writeFileSync(path.join(root, "problems/lc-0001-two-sum/README.md"), "changed\n");
      expect(JSON.parse((await events.next()).data)).toEqual({ kind: "readme", target: "lc-0001" });
      writeFileSync(path.join(root, "concepts/hash-map/exercises/01-first-repeat/solution.py"), PY_SUM);
      expect(JSON.parse((await events.next()).data)).toEqual({
        kind: "solution",
        target: "hash-map/01",
        lang: "py",
        version: contentVersion(PY_SUM),
      });
      writeFileSync(path.join(root, "problems/lc-0020-valid-parentheses/cases.json"), "{}\n");
      expect(JSON.parse((await events.next()).data)).toEqual({ kind: "cases", target: "lc-0020" });
      writeFileSync(path.join(root, "concepts/hash-map/README.md"), "changed\n");
      expect(JSON.parse((await events.next()).data)).toEqual({ kind: "readme", concept: "hash-map" });
    } finally {
      await events.close();
    }
  });

  it("works on a repo that has no problems or concepts yet", async () => {
    const root = makeRepo();
    const empty = path.join(root, "empty");
    mkdirSync(empty);
    const events = await openEvents(createApp({ root: empty }));
    try {
      expect((await events.next()).event).toBe("ready");
    } finally {
      await events.close();
    }
  });

  it("reports the user's solutions under .study, even when .study appears after the page opened", async () => {
    const root = makeRepo();
    const events = await openEvents(createApp({ root }));
    try {
      expect((await events.next()).event).toBe("ready");
      mkdirSync(path.join(root, ".study/solutions/problems/lc-0001"), { recursive: true });
      writeFileSync(path.join(root, ".study/solutions/problems/lc-0001/solution.py"), PY_SUM);
      expect(JSON.parse((await events.next()).data)).toEqual({ kind: "solution", target: "lc-0001", lang: "py", version: contentVersion(PY_SUM) });
    } finally {
      await events.close();
    }
  });

  it("sends one progress event per new state.json snapshot", async () => {
    const root = makeRepo();
    const events = await openEvents(createApp({ root }));
    try {
      expect((await events.next()).event).toBe("ready");
      // Phases a fresh or seeded store never has, so both writes are real changes.
      const first = writeStateFile(path.join(root, ".study"), { phase: "expand", inProgress: [], today: null }).state;
      expect(JSON.parse((await events.next()).data)).toEqual({ kind: "progress", version: first.version });
      const second = writeStateFile(path.join(root, ".study"), { phase: "pro", inProgress: [], today: null }).state;
      expect(JSON.parse((await events.next()).data)).toEqual({ kind: "progress", version: second.version });
    } finally {
      await events.close();
    }
  });
});
