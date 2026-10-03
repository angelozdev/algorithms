import type { Page } from "@playwright/test";

/** Replaces the editor's content the way a paste would (no auto-indent or bracket closing on the way in). */
export async function replaceCode(page: Page, code: string, label = "solution.py"): Promise<void> {
  await page.getByRole("textbox", { name: label }).click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.insertText(code);
}
