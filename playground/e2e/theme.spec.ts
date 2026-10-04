import { expect, test } from "@playwright/test";
import { resetRepo } from "./fixture.ts";

test.beforeEach(() => resetRepo());

test.describe("light mode", () => {
  test.use({ colorScheme: "light" });

  test("uses the slate colors", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("body")).toHaveCSS("background-color", "rgb(248, 250, 252)");
  });
});

test.describe("dark mode", () => {
  test.use({ colorScheme: "dark" });

  test("follows the system with the GitHub Dark colors, in the app and in the editor", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("body")).toHaveCSS("background-color", "rgb(13, 17, 23)");
    await page.goto("/p/lc-0001");
    await expect(page.getByRole("contentinfo", { name: "Status bar" })).toHaveCSS("background-color", "rgb(22, 27, 34)");
    await expect(page.locator(".cm-editor")).toHaveCSS("background-color", "rgb(13, 17, 23)");
  });
});
