import { readdirSync, readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { pauseFromTerminal, repoFile, resetRepo, seedDueReview, startCoach, TWO_SUM_PY } from "./fixture.ts";

test.beforeEach(() => resetRepo());

const today = (page: import("@playwright/test").Page) => page.getByRole("region", { name: "Today" });

test("the Today section lists today's plan, and a review leads to the Start review gate", async ({ page }) => {
  startCoach();
  seedDueReview();
  await page.goto("/");
  const plan = today(page).getByRole("list", { name: "Today's plan" });
  await expect(plan.getByRole("listitem")).toHaveCount(2);
  await expect(plan.getByRole("listitem").first()).toContainText("Review");
  await expect(plan.getByRole("link", { name: "hash-map Hash map" })).toHaveAttribute("href", "/c/hash-map");
  await plan.getByRole("link", { name: "lc-0001 Two Sum" }).click();
  await expect(page).toHaveURL(/\/p\/lc-0001$/);
  await expect(page.getByRole("heading", { name: "Time to review" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "solution.py" })).toHaveCount(0);
});

test("Start review archives the old solution to history/ and opens a blank editor with no undo history", async ({ page }) => {
  startCoach();
  seedDueReview();
  await page.goto("/");
  await today(page).getByRole("link", { name: "lc-0001 Two Sum" }).click();
  await page.getByRole("button", { name: "Start review" }).click();
  const editor = page.getByRole("textbox", { name: "solution.py" });
  await expect(editor).toContainText("def twoSum");
  await expect(editor).not.toContainText("seen = {}");
  await editor.click();
  await page.keyboard.press("ControlOrMeta+Z");
  await page.keyboard.press("ControlOrMeta+Z");
  await expect(editor).not.toContainText("seen = {}");
  const history = repoFile(".study/solutions/problems/lc-0001/history");
  const archived = readdirSync(history);
  expect(archived).toHaveLength(1);
  expect(readFileSync(`${history}/${archived[0]}`, "utf8")).toBe(TWO_SUM_PY);
  // The plan is stored for the day: the review is still listed, not done until it is green.
  await page.goto("/");
  const review = today(page).getByRole("listitem").first();
  await expect(review).toContainText("Review");
  await expect(review.getByRole("img", { name: "To do" })).toBeVisible();
});

test("the announcement banner is acknowledged once", async ({ page }) => {
  startCoach();
  await page.goto("/");
  const banner = today(page).getByRole("status");
  await expect(banner).toContainText("The coach started you on Grind 75, at phase 0 · Bases.");
  await banner.getByRole("button", { name: "Got it" }).click();
  await expect(today(page).getByRole("status")).toHaveCount(0);
  await page.reload();
  await expect(today(page).getByRole("list", { name: "Today's plan" })).toBeVisible();
  await expect(today(page).getByRole("status")).toHaveCount(0);
});

test("the pause button pauses the plan, Resume brings it back, and a pause from the terminal shows up live", async ({ page }) => {
  startCoach();
  await page.goto("/");
  await today(page).getByRole("button", { name: "Pause" }).click();
  await expect(today(page).getByText(/^Paused since/)).toBeVisible();
  await today(page).getByRole("button", { name: "Resume" }).click();
  await expect(today(page).getByRole("list", { name: "Today's plan" })).toBeVisible();
  pauseFromTerminal(); // .study/state.json changes: the progress event refreshes the section
  await expect(today(page).getByText(/^Paused since/)).toBeVisible();
});
