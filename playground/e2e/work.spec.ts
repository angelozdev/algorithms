import { readFileSync, writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { repoFile, resetRepo, TWO_SUM_PY } from "./fixture.ts";
import { replaceCode } from "./helpers.ts";

test.beforeEach(() => resetRepo());

test("goes from the home page to a green run with ⌘↵", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Two Sum" }).click();
  await expect(page).toHaveURL(/\/p\/lc-0001$/);
  await expect(page.getByRole("heading", { name: "1. Two Sum" })).toBeVisible();
  await replaceCode(page, TWO_SUM_PY);
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(page.getByText(/Green in py/)).toBeVisible({ timeout: 20_000 });
  expect(readFileSync(repoFile("problems/lc-0001-two-sum/solution.py"), "utf8")).toBe(TWO_SUM_PY);
});

test("shows what a failing example expected and what the code returned", async ({ page }) => {
  await page.goto("/p/lc-0001");
  await replaceCode(page, "class Solution:\n    def twoSum(self, nums: list[int], target: int) -> list[int]:\n        return [0, 0]\n");
  await page.getByRole("button", { name: "Run", exact: true }).click();
  const failures = page.getByRole("table", { name: "Failures" });
  await expect(failures).toContainText("nums=[3,2,4], target=6", { timeout: 20_000 });
  await expect(failures).toContainText("[1,2]");
  await expect(page.getByRole("button", { name: /^Example 2: failed/ })).toBeVisible();
  await expect(page.getByRole("img", { name: "Hidden: skipped until the examples pass" })).toBeVisible();
});

test("the editor never suggests anything", async ({ page }) => {
  await page.goto("/p/lc-0001");
  const editor = page.getByRole("textbox", { name: "solution.py" });
  await expect(editor).toHaveAttribute("spellcheck", "false");
  await expect(editor).toHaveAttribute("autocorrect", "off");
  await expect(editor).toHaveAttribute("autocapitalize", "off");
  await expect(editor).toHaveAttribute("writingsuggestions", "false");
  await editor.click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type("\nnums.");
  await page.waitForTimeout(1000);
  await expect(page.locator(".cm-tooltip")).toHaveCount(0);
});

test("switching to TypeScript opens solution.ts with its stub", async ({ page }) => {
  await page.goto("/p/lc-0001");
  await page.getByRole("radio", { name: "ts" }).click();
  await expect(page.getByRole("textbox", { name: "solution.ts" })).toContainText("export default function twoSum");
});

test("keeps the previous result visible while a second run is in flight", async ({ page }) => {
  await page.goto("/p/lc-0001");
  await replaceCode(page, TWO_SUM_PY);
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(page.getByText(/Green in py/)).toBeVisible({ timeout: 20_000 });
  const firstExample = page.getByRole("img", { name: /^Example 1: passed/ });
  await expect(firstExample).toBeVisible();
  // A local run is too fast for "Running…" to be reliably observable; delay the second one so the
  // in-flight state is a stable window instead of a race against the test's own polling.
  await page.route("**/api/run", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await route.continue();
  });
  await page.keyboard.press("ControlOrMeta+Enter");
  // The Run button's own label also reads "Running…"; the status line is the <p>, not the <button>.
  await expect(page.locator("p", { hasText: "Running" })).toBeVisible();
  // A snapshot, not an auto-retrying assertion: the delayed run would otherwise finish and repopulate
  // the panel before a polling `toBeVisible()` times out, masking a result that went blank in between.
  expect(await firstExample.count()).toBe(1); // the previous result stays, dimmed, while the new run is in flight
  await expect(page.getByText(/Green in py/)).toBeVisible({ timeout: 20_000 });
});

test("disables the language switch while a conflict is open", async ({ page }) => {
  await page.goto("/p/lc-0001");
  await replaceCode(page, TWO_SUM_PY);
  // Someone else changes the file on disk before the 500 ms autosave can send this edit.
  writeFileSync(repoFile("problems/lc-0001-two-sum/solution.py"), "class Solution:\n    pass\n");
  await expect(page.getByText(/changed on disk/)).toBeVisible({ timeout: 5_000 });
  await expect(page.getByRole("radio", { name: "ts" })).toBeDisabled();
  await page.getByRole("radiogroup", { name: "Language" }).hover();
  await expect(page.getByRole("tooltip")).toHaveText("Resolve the conflict first");
});

test("the editor shows code exactly as typed, in the app's mono font", async ({ page }) => {
  await page.goto("/p/lc-0001");
  const scroller = page.locator(".cm-scroller");
  await expect(scroller).toHaveCSS("font-family", /JetBrains Mono/);
  await expect(scroller).toHaveCSS("font-variant-ligatures", "none");
});

test("the custom input fields stay hidden until their tab is open", async ({ page }) => {
  await page.goto("/p/lc-0001");
  await expect(page.getByRole("textbox", { name: "solution.py" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "nums" })).toBeHidden();
  await page.getByRole("tab", { name: "Custom input" }).click();
  await expect(page.getByRole("textbox", { name: "nums" })).toBeVisible();
});

test("the status bar shows the connection, the file and the shortcuts", async ({ page }) => {
  await page.goto("/p/lc-0001");
  const bar = page.getByRole("contentinfo", { name: "Status bar" });
  await expect(bar).toContainText("Connected");
  await expect(bar).toContainText("Python · solution.py");
  await expect(bar).toContainText(/(⌘↵|Ctrl\+Enter)\s*Run/);
  await expect(page.getByRole("status", { name: "Save status" })).toHaveText("Saved");
});
