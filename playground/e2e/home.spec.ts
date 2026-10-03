import { expect, test } from "@playwright/test";
import { resetRepo } from "./fixture.ts";

test.beforeEach(() => resetRepo());

test("the home view lives in the URL: grouping and filters survive a reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("combobox", { name: "Group by" }).click();
  await page.getByRole("option", { name: "Status" }).click();
  await expect(page).toHaveURL(/group=status/);
  await expect(page.getByRole("button", { name: /^To do/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Solved/ })).toBeVisible();

  await page.getByRole("radio", { name: "Pending" }).click();
  await expect(page.getByRole("link", { name: "Valid Parentheses" })).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole("combobox", { name: "Group by" })).toHaveText("Status");
  await expect(page.getByRole("radio", { name: "Pending" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("link", { name: "Two Sum" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Valid Parentheses" })).toHaveCount(0);
});

test("the search box finds a problem by its LeetCode number", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("searchbox", { name: "Search" }).fill("20");
  await expect(page.getByRole("link", { name: "Valid Parentheses" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Two Sum" })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("searchbox", { name: "Search" })).toHaveValue("20");
});
