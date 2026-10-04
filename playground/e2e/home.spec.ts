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

test("a sort order and a pattern facet survive a reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Sort by title" }).click();
  await expect(page).toHaveURL(/sort=title/);
  await expect(page.getByRole("columnheader", { name: "Sort by title" })).toHaveAttribute("aria-sort", "ascending");

  await page.getByRole("button", { name: "Pattern" }).click();
  await page.getByRole("option", { name: /^Arrays & hashing/ }).click();
  await expect(page).toHaveURL(/arrays-hashing/);
  await expect(page.getByRole("link", { name: "Two Sum" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Valid Parentheses" })).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole("columnheader", { name: "Sort by title" })).toHaveAttribute("aria-sort", "ascending");
  await expect(page.getByRole("button", { name: /^Pattern/ })).toHaveText(/Arrays & hashing/);
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

test("the List facet and the List grouping live in the URL", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "List", exact: true }).click();
  await page.getByRole("option", { name: "Grind 75 1" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("link", { name: "Valid Parentheses" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Two Sum" })).toBeVisible();

  await page.getByRole("combobox", { name: "Group by" }).click();
  await page.getByRole("option", { name: "List" }).click();
  await expect(page.getByRole("button", { name: /^Grind 75/ })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("combobox", { name: "Group by" })).toHaveText("List");
  await expect(page.getByRole("button", { name: /^List/ })).toContainText("Grind 75");
  await expect(page.getByRole("link", { name: "Valid Parentheses" })).toHaveCount(0);
});

/** This file is also type-checked by the root tsconfig (no DOM lib), so `page.evaluate` callbacks reach
 * window/document through a cast `globalThis`, like `restart.spec.ts`'s `markTab` does. The cast type is
 * erased at runtime, but the cast itself must stay inside the callback: it runs in the page, not here, so
 * it cannot close over a Node-side helper. */
type BrowserGlobal = { innerHeight: number; scrollY: number; document: { scrollingElement: { scrollHeight: number } } };

test.describe("page scrolling", () => {
  // A short viewport, not the fixture's own content, forces the overflow: two problems and one concept
  // comfortably fit a normal window, so the test shrinks the window instead of growing the fixture.
  test.use({ viewport: { width: 1440, height: 250 } });

  test("the window scrolls, not an inner container", async ({ page }) => {
    await page.goto("/");
    const overflows = () =>
      page.evaluate(() => {
        const g = globalThis as unknown as BrowserGlobal;
        return g.document.scrollingElement.scrollHeight > g.innerHeight;
      });
    await expect.poll(overflows).toBe(true);
    // Over the margin, outside the centered `max-w-5xl` column: the bug report asked for the wheel to
    // scroll the page from anywhere, not just over the content.
    await page.mouse.move(50, 100);
    await page.mouse.wheel(0, 300);
    await expect.poll(() => page.evaluate(() => (globalThis as unknown as BrowserGlobal).scrollY)).toBeGreaterThan(0);
  });

  test("the problem page still does not scroll the document", async ({ page }) => {
    await page.goto("/p/lc-0001");
    await expect(page.getByRole("heading", { name: "1. Two Sum" })).toBeVisible();
    await page.mouse.wheel(0, 300);
    expect(await page.evaluate(() => (globalThis as unknown as BrowserGlobal).scrollY)).toBe(0);
  });
});
