import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../../server/app.ts";
import { classify } from "../../server/events.ts";
import { contentVersion } from "../../server/solutions.ts";
import { type App, call, makeRepo, PY_SUM, removeRepos } from "./helpers.ts";

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
});
