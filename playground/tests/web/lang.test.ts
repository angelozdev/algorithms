import { describe, expect, it } from "vitest";
import { pickLang } from "../../web/lang.ts";

describe("pickLang", () => {
  it("opens the only language that already has a file", () => {
    expect(pickLang({ py: false, ts: true }, "py")).toBe("ts");
    expect(pickLang({ py: true, ts: false }, "ts")).toBe("py");
  });

  it("otherwise uses the last language the user chose, then Python", () => {
    expect(pickLang({ py: true, ts: true }, "ts")).toBe("ts");
    expect(pickLang({ py: false, ts: false }, "ts")).toBe("ts");
    expect(pickLang({ py: false, ts: false }, null)).toBe("py");
  });
});
