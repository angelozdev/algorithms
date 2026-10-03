import { readFileSync, writeFileSync } from "node:fs";
import { expect, type Route, test } from "@playwright/test";
import { EXPLANATION_NOTE, repoFile, resetRepo, TWO_SUM_PY } from "./fixture.ts";
import { replaceCode } from "./helpers.ts";

const SOLUTION = repoFile("problems/lc-0001-two-sum/solution.py");
const readSolution = () => readFileSync(SOLUTION, "utf8");

test.beforeEach(() => resetRepo());

test("autosave writes the file on disk without pressing anything", async ({ page }) => {
  await page.goto("/p/lc-0001");
  await replaceCode(page, TWO_SUM_PY);
  await expect.poll(readSolution).toBe(TWO_SUM_PY);
  await expect(page.getByRole("status", { name: "Save status" })).toHaveText("Saved");
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

test("Use disk version replaces the buffer and closes the conflict without touching the file", async ({ page }) => {
  await page.goto("/p/lc-0001");
  const editor = page.getByRole("textbox", { name: "solution.py" });
  await expect(editor).toContainText("def twoSum");
  await editor.click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.insertText("\n# mine\n");
  writeFileSync(SOLUTION, "# theirs\n"); // lands before the 500 ms autosave
  await expect(page.getByText("solution.py changed on disk.")).toBeVisible();
  await page.getByRole("button", { name: "Use disk version" }).click();
  await expect(editor).toContainText("# theirs");
  await expect(page.getByText("solution.py changed on disk.")).toHaveCount(0);
  await expect(page.getByRole("status", { name: "Save status" })).toHaveText("Saved");
  expect(readSolution()).toBe("# theirs\n");
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

test("leaving with an edit the server could not save asks first, and the edit is saved on the way out", async ({ page }) => {
  const isSolution = (url: URL) => url.pathname === "/api/solution";
  const saveFails = (route: Route) =>
    route.request().method() === "PUT" ? route.fulfill({ status: 500, json: { error: "disk full" } }) : route.fallback();
  await page.route(isSolution, saveFails);
  const dialogs: { type: string; message: string }[] = [];
  let leave = false;
  page.on("dialog", (dialog) => {
    dialogs.push({ type: dialog.type(), message: dialog.message() });
    void (leave ? dialog.accept() : dialog.dismiss());
  });

  await page.goto("/p/lc-0001");
  const editor = page.getByRole("textbox", { name: "solution.py" });
  await expect(editor).toContainText("def twoSum");
  await editor.click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.insertText("\n# typed while saves fail\n");
  await expect(page.getByRole("status", { name: "Save status" })).toHaveText("Not saved");
  await expect(page.getByRole("radio", { name: "ts" })).toBeDisabled();
  await page.getByRole("radiogroup", { name: "Language" }).hover();
  await expect(page.getByRole("tooltip")).toHaveText("Not saved yet: press ⌘S to retry first");

  // A link inside the app: the user chooses to stay.
  await page.getByRole("link", { name: "Algorithms" }).click();
  await expect.poll(() => dialogs).toEqual([{ type: "confirm", message: "You have unsaved changes in solution.py. Leave anyway?" }]);
  await expect(page).toHaveURL(/\/p\/lc-0001$/);
  await expect(editor).toContainText("# typed while saves fail");

  // Closing the tab: the browser's own prompt, dismissed.
  await page.close({ runBeforeUnload: true });
  await expect.poll(() => dialogs.map((dialog) => dialog.type)).toEqual(["confirm", "beforeunload"]);
  expect(page.isClosed()).toBe(false);
  await expect(editor).toContainText("# typed while saves fail");

  // The server answers again and the user leaves anyway: leaving sends the edit once more.
  await page.unroute(isSolution, saveFails);
  leave = true;
  await page.getByRole("link", { name: "Algorithms" }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/");
  await expect.poll(readSolution).toContain("# typed while saves fail");
});

test("a failed refresh of the problem keeps the workspace and the editor's text", async ({ page }) => {
  await page.goto("/p/lc-0001");
  const editor = page.getByRole("textbox", { name: "solution.py" });
  await expect(editor).toContainText("def twoSum");
  await editor.click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.insertText("\n# still here\n");
  await page.route((url) => url.pathname === "/api/target", (route) => route.fulfill({ status: 500, json: { error: "README unreadable" } }));
  // A README change makes the page refresh the problem. Written again until the live connection reports it.
  const readme = repoFile("problems/lc-0001-two-sum/README.md");
  const original = readFileSync(readme, "utf8");
  let edits = 0;
  await expect(async () => {
    const failed = page.waitForResponse((res) => new URL(res.url()).pathname === "/api/target" && res.status() === 500, { timeout: 1000 });
    writeFileSync(readme, `${original}- edit ${++edits}\n`);
    await failed;
  }).toPass({ timeout: 15_000 });
  await page.waitForTimeout(1000); // the failed refresh has had time to render
  await expect(page.getByText("README unreadable")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "1. Two Sum" })).toBeVisible();
  await expect(editor).toContainText("# still here");
});
