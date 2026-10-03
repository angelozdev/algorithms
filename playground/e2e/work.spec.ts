import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { repoFile, resetRepo, TWO_SUM_PY } from "./fixture.ts";
import { replaceCode } from "./helpers.ts";

test.beforeEach(() => resetRepo());

test("goes from the home page to a green run with ⌘↵", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "lc-0001 Two Sum" }).click();
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
  await page.getByRole("button", { name: /^▶ Run/ }).click();
  await expect(page.getByText("nums=[3,2,4], target=6")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Hidden · skipped until the examples pass/)).toBeVisible();
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
  await page.getByRole("tab", { name: "ts", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "solution.ts" })).toContainText("export default function twoSum");
});
