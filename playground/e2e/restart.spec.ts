import { type ChildProcess, spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, type Page, type Route, test } from "@playwright/test";
import { E2E_PORT, E2E_ROOT, repoFile, resetRepo } from "./fixture.ts";

// A server of its own, so these tests can stop it and start it again like a user restarting `pnpm play`.
const PORT = E2E_PORT + 1;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const SOLUTION = repoFile("problems/lc-0001-two-sum/solution.py");
const readSolution = () => readFileSync(SOLUTION, "utf8");

const health = async (): Promise<number> => {
  try {
    return (await fetch(`${ORIGIN}/api/health`)).status;
  } catch {
    return 0; // nothing is listening
  }
};

/** Every server these tests started and have not stopped yet, so none is left holding the port. */
const running = new Set<ChildProcess>();
const alive = (child: ChildProcess) => child.exitCode === null && child.signalCode === null;
// Detached servers do not die with the test worker by themselves.
process.on("exit", () => {
  for (const child of running) {
    if (alive(child)) process.kill(-(child.pid as number), "SIGKILL");
  }
});

/** `pnpm play --no-open` on the e2e repo: one node process, in its own process group so a kill takes all of it. */
async function startServer(): Promise<ChildProcess> {
  expect(await health(), `port ${PORT} is already taken`).toBe(0);
  const child = spawn(process.execPath, ["--import", "tsx", "playground/cli.ts", "--no-open", "--port", String(PORT)], {
    cwd: REPO_ROOT,
    env: { ...process.env, ALGO_ROOT: E2E_ROOT },
    detached: true,
    stdio: "ignore",
  });
  running.add(child);
  try {
    await expect.poll(health, { timeout: 30_000 }).toBe(200);
  } catch (error) {
    await killServer(child);
    throw error;
  }
  return child;
}

/** Stops the server the hard way (as a closed terminal would): no connection is closed cleanly. */
async function killServer(child: ChildProcess): Promise<void> {
  if (alive(child)) {
    const exited = new Promise((resolve) => child.once("exit", resolve));
    process.kill(-(child.pid as number), "SIGKILL");
    await exited;
  }
  running.delete(child);
  await expect.poll(health).toBe(0);
}

/** Marks the tab; the mark is gone if the page reloads. */
const markTab = (page: Page) =>
  page.evaluate(() => {
    (globalThis as { sameTab?: boolean }).sameTab = true;
  });
const isSameTab = (page: Page) => page.evaluate(() => (globalThis as { sameTab?: boolean }).sameTab === true);

// Each test starts the server two or three times; hooks share the test's timeout.
test.describe.configure({ timeout: 90_000 });

let server: ChildProcess | null = null;

test.beforeEach(async () => {
  resetRepo();
  server = await startServer();
});

test.afterEach(async () => {
  for (const child of running) await killServer(child);
  server = null;
});

test("after pnpm play restarts, the same tab reconnects, saves what was typed meanwhile, and follows the disk again", async ({ page }) => {
  await page.goto(`${ORIGIN}/p/lc-0001`);
  const editor = page.getByRole("textbox", { name: "solution.py" });
  const status = page.getByRole("status", { name: "Save status" });
  const banner = page.getByText("Disconnected — run pnpm play again.", { exact: false });
  await expect(editor).toContainText("def twoSum");
  await markTab(page);

  await killServer(server as ChildProcess);
  await expect(banner).toBeVisible();
  await editor.click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.insertText("\n# typed while the server was down\n");
  // Text that cannot be saved locks the language switch at once, not only after the 500 ms autosave fails.
  await expect(page.getByRole("radio", { name: "ts" })).toBeDisabled();
  await expect(status).toHaveText("Not saved");

  server = await startServer();
  await expect(banner).toBeHidden({ timeout: 20_000 });
  await expect.poll(readSolution).toContain("# typed while the server was down");
  await expect(status).toHaveText("Saved");

  // Live events work again: a change made outside the browser reloads the editor.
  await expect(async () => {
    writeFileSync(SOLUTION, "# written in VS Code after the restart\n");
    await expect(editor).toContainText("# written in VS Code after the restart", { timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  expect(await isSameTab(page)).toBe(true);
});

test("a file changed while pnpm play was stopped shows up in a clean editor once it is back", async ({ page }) => {
  await page.goto(`${ORIGIN}/p/lc-0001`);
  const editor = page.getByRole("textbox", { name: "solution.py" });
  await expect(editor).toContainText("def twoSum");
  await markTab(page);

  await killServer(server as ChildProcess);
  await expect(page.getByText("Disconnected — run pnpm play again.", { exact: false })).toBeVisible();
  writeFileSync(SOLUTION, "# written in VS Code while the server was down\n");

  server = await startServer();
  await expect(editor).toContainText("# written in VS Code while the server was down", { timeout: 20_000 });
  await expect(page.getByRole("status", { name: "Save status" })).toHaveText("Saved");
  expect(readSolution()).toBe("# written in VS Code while the server was down\n");
  expect(await isSameTab(page)).toBe(true);
});

test("a live connection the server answered with an error is opened again once the server is back", async ({ page }) => {
  await page.goto(`${ORIGIN}/p/lc-0001`);
  await expect(page.getByRole("textbox", { name: "solution.py" })).toContainText("def twoSum");
  await markTab(page);
  const banner = page.getByText("Disconnected — run pnpm play again.", { exact: false });

  await killServer(server as ChildProcess);
  await expect(banner).toBeVisible();
  // The browser's own retry gets an error instead of the stream (as when the API fails to load), so it gives up for good.
  const isEvents = (url: URL) => url.pathname === "/api/events";
  const refuse = (route: Route) => route.fulfill({ status: 503, body: "starting" });
  await page.route(isEvents, refuse);
  await page.waitForResponse((res) => isEvents(new URL(res.url())) && res.status() === 503, { timeout: 15_000 });
  await page.unroute(isEvents, refuse);

  server = await startServer();
  await expect(banner).toBeHidden({ timeout: 20_000 });
  expect(await isSameTab(page)).toBe(true);
});
