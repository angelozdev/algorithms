import { describe, expect, it } from "vitest";
import {
  conceptLabel,
  difficultyLabel,
  difficultyOf,
  leetcodeNumber,
  patternLabel,
  prettifySlug,
  STATUS_LABEL,
  statusKind,
} from "../../web/lib/labels.ts";

describe("labels", () => {
  it("names every known pattern and makes unknown slugs readable", () => {
    expect(patternLabel("arrays-hashing")).toBe("Arrays & hashing");
    expect(patternLabel("dp-1d")).toBe("1-D DP");
    expect(patternLabel("heap")).toBe("Heap / priority queue");
    expect(patternLabel("union-find")).toBe("Union find");
    expect(prettifySlug("in-place-array-modification")).toBe("In place array modification");
  });

  it("uses a concept page's title when there is one", () => {
    const concepts = [{ slug: "hash-map", title: "Hash map" }];
    expect(conceptLabel("hash-map", concepts)).toBe("Hash map");
    expect(conceptLabel("two-pointers", concepts)).toBe("Two pointers");
  });

  it("reads LeetCode numbers from ids, and nothing from other ids", () => {
    expect(leetcodeNumber("lc-0001")).toBe(1);
    expect(leetcodeNumber("lc-2181")).toBe(2181);
    expect(leetcodeNumber("hash-map/01")).toBeNull();
    expect(leetcodeNumber("cf-0001")).toBeNull();
  });

  it("knows the three difficulties", () => {
    expect(difficultyOf("easy")).toBe("easy");
    expect(difficultyOf("Medium")).toBe("medium");
    expect(difficultyOf("insane")).toBeNull();
    expect(difficultyOf(null)).toBeNull();
    expect(difficultyLabel("hard")).toBe("Hard");
  });

  it("reads a started to-do item as in progress", () => {
    expect(STATUS_LABEL[statusKind("todo", true)]).toBe("In progress");
    expect(STATUS_LABEL[statusKind("solving", false)]).toBe("In progress");
    expect(STATUS_LABEL[statusKind("todo", false)]).toBe("To do");
    expect(STATUS_LABEL[statusKind("revealed", true)]).toBe("Revealed");
    expect(STATUS_LABEL[statusKind("solved", false)]).toBe("Solved");
  });
});
