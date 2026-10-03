import { readFileSync, writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { EXPLANATION_NOTE, repoFile, resetRepo, TWO_SUM_PY } from "./fixture.ts";
import { replaceCode } from "./helpers.ts";

const SOLUTION = repoFile("problems/lc-0001-two-sum/solution.py");
const readSolution = () => readFileSync(SOLUTION, "utf8");

test.beforeEach(() => resetRepo());

test("autosave writes the file on disk without pressing anything", async ({ page }) => {
  await page.goto("/p/lc-0001");
  await replaceCode(page, TWO_SUM_PY);
  await expect.poll(readSolution).toBe(TWO_SUM_PY);
  await expect(page.getByRole("status", { name: "Save status" })).toHaveText("✓ saved");
});

test("a change made outside the browser reloads the editor", async ({ page }) => {
  await page.goto("/p/lc-0001");
  const editor = page.getByRole("textbox", { name: "solution.py" });
  await expect(editor).toContainText("def twoSum");
  // Written again until the page has picked it up: the live connection may still be opening.
  await expect(async () => {
    writeFileSync(SOLUTION, "# written in VS Code\n");
    await expect(editor).toContainText("# written in VS Code", { timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  await expect(page.getByText("Reloaded from disk")).toBeVisible();
});

test("a conflict keeps both versions until the user picks one", async ({ page }) => {
  await page.goto("/p/lc-0001");
  const editor = page.getByRole("textbox", { name: "solution.py" });
  await expect(editor).toContainText("def twoSum");
  await editor.click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.insertText("\n# mine\n");
  writeFileSync(SOLUTION, "# theirs\n"); // lands before the 500 ms autosave
  await expect(page.getByText("solution.py changed on disk.")).toBeVisible();
  await expect(editor).toContainText("# mine");
  expect(readSolution()).toBe("# theirs\n");
  await page.getByRole("button", { name: "Keep mine" }).click();
  await expect.poll(readSolution).toContain("# mine");
});

test("a concept link opens next to the editor, and Back returns to the statement", async ({ page }) => {
  await page.goto("/p/lc-0001");
  await page.getByRole("button", { name: "Hash map" }).click();
  await expect(page.getByRole("heading", { name: "Intuition" })).toBeVisible();
  await expect(page.getByText("Statement › hash-map")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "solution.py" })).toBeVisible();
  await page.getByRole("button", { name: "← Back" }).click();
  await expect(page.getByRole("heading", { name: "1. Two Sum" })).toBeVisible();
});

test("My explanation is saved into the README and nothing else changes", async ({ page }) => {
  const before = readFileSync(repoFile("concepts/hash-map/README.md"), "utf8");
  const text = "Un mapa hash convierte la clave en una posición. 🎟️";
  await page.goto("/c/hash-map");
  await page.getByRole("button", { name: "✎ Edit" }).click();
  await page.getByRole("textbox", { name: "My explanation" }).click();
  await page.keyboard.insertText(text);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: "✎ Edit" })).toBeVisible();
  await expect(page.getByText(text)).toBeVisible();
  expect(readFileSync(repoFile("concepts/hash-map/README.md"), "utf8")).toBe(
    before.replace(`${EXPLANATION_NOTE}\n\n## Problems`, `${EXPLANATION_NOTE}\n\n${text}\n\n## Problems`),
  );
});
