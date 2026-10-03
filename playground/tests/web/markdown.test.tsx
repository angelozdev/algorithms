import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Markdown } from "../../web/components/Markdown.tsx";
import { renderWithRouter } from "./render.tsx";

const SOURCE = [
  "# Two Sum",
  "",
  "<!-- auto:concepts -->",
  "- [Hash map](../../concepts/hash-map/README.md) · learning",
  "<!-- /auto -->",
  "",
  "| n | answer |",
  "|---|---|",
  "| 1 | 2 |",
  "",
  "```python",
  "seen = {}",
  "```",
  "",
  "<b>raw html</b> stays text",
  "",
  "[LeetCode](https://leetcode.com/problems/two-sum/) and [your file](solution.py)",
].join("\n");
const README = "problems/lc-0001-two-sum/README.md";

describe("Markdown", () => {
  it("renders GFM with colored code, app links, external links, and drops raw HTML", async () => {
    const { container } = await renderWithRouter(<Markdown source={SOURCE} readmePath={README} />);
    expect(screen.getByRole("heading", { name: "Two Sum" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Hash map" })).toHaveAttribute("href", "/c/hash-map");
    const external = screen.getByRole("link", { name: "LeetCode" });
    expect(external).toHaveAttribute("target", "_blank");
    expect(screen.queryByRole("link", { name: "your file" })).not.toBeInTheDocument();
    expect(screen.getByText("your file")).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "2" })).toBeInTheDocument();
    expect(container.querySelector("pre.shiki")).not.toBeNull();
    expect(container.innerHTML).not.toContain("<b>");
    expect(container.innerHTML).not.toContain("auto:concepts");
  });

  it("turns concept links into buttons when the page opens concepts itself", async () => {
    const onConcept = vi.fn();
    await renderWithRouter(<Markdown source={SOURCE} readmePath={README} onConcept={onConcept} />);
    await userEvent.click(screen.getByRole("button", { name: "Hash map" }));
    expect(onConcept).toHaveBeenCalledWith("hash-map");
  });
});
