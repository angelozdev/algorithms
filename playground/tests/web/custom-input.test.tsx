import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CustomResult } from "../../../runner/src/types.ts";
import type { Signature } from "../../server/types.ts";
import { ApiError } from "../../web/api.ts";
import { CustomInputPanel } from "../../web/components/CustomInputPanel.tsx";

const SIG: Signature = {
  mode: "function",
  entry: "twoSum",
  params: [
    { name: "nums", type: "int[]" },
    { name: "target", type: "int" },
  ],
  returns: "int[]",
};
const EXAMPLE = [[2, 7, 11, 15], 9];
const ok = (output: unknown, stdout = ""): CustomResult => ({ fatal: null, output, ms: 0.4, stdout });

async function replace(field: HTMLElement, text: string) {
  const user = userEvent.setup();
  await user.clear(field);
  await user.click(field);
  await user.paste(text);
}

beforeEach(() => localStorage.clear());

describe("CustomInputPanel", () => {
  it("starts from Example 1 and runs the parsed JSON", async () => {
    const run = vi.fn(async () => ok([0, 1], "seen={3: 0}\n"));
    render(<CustomInputPanel targetId="lc-0001" signature={SIG} exampleInput={EXAMPLE} run={run} />);
    expect(screen.getByRole("textbox", { name: "nums" })).toHaveValue("[2,7,11,15]");
    expect(screen.getByRole("textbox", { name: "target" })).toHaveValue("9");
    await replace(screen.getByRole("textbox", { name: "nums" }), "[3,3]");
    await replace(screen.getByRole("textbox", { name: "target" }), "6");
    await userEvent.click(screen.getByRole("button", { name: /Run custom input/ }));
    expect(run).toHaveBeenCalledWith([[3, 3], 6]);
    expect(await screen.findByText("[0,1]")).toBeInTheDocument();
    expect(screen.getByText("seen={3: 0}")).toBeInTheDocument();
  });

  it("shows Python-style literals as invalid JSON and sends nothing", async () => {
    const run = vi.fn(async () => ok(null));
    render(<CustomInputPanel targetId="lc-0001" signature={SIG} exampleInput={EXAMPLE} run={run} />);
    await replace(screen.getByRole("textbox", { name: "nums" }), "['a', True]");
    await replace(screen.getByRole("textbox", { name: "target" }), "None");
    await userEvent.click(screen.getByRole("button", { name: /Run custom input/ }));
    expect(run).not.toHaveBeenCalled();
    expect(screen.getAllByText(/Not valid JSON/)).toHaveLength(2);
    expect(screen.getByRole("textbox", { name: "nums" })).toHaveAttribute("aria-invalid", "true");
  });

  it("remembers edits per problem, and Reset brings back Example 1", async () => {
    const run = vi.fn(async () => ok(null));
    const first = render(<CustomInputPanel targetId="lc-0001" signature={SIG} exampleInput={EXAMPLE} run={run} />);
    await replace(screen.getByRole("textbox", { name: "nums" }), "[5]");
    first.unmount();

    const again = render(<CustomInputPanel targetId="lc-0001" signature={SIG} exampleInput={EXAMPLE} run={run} />);
    expect(screen.getByRole("textbox", { name: "nums" })).toHaveValue("[5]");
    await userEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByRole("textbox", { name: "nums" })).toHaveValue("[2,7,11,15]");
    expect(run).not.toHaveBeenCalled(); // Reset never runs the code
    again.unmount();

    render(<CustomInputPanel targetId="lc-0002" signature={SIG} exampleInput={EXAMPLE} run={run} />);
    expect(screen.getByRole("textbox", { name: "nums" })).toHaveValue("[2,7,11,15]");
  });

  it("uses ops and args for class problems", async () => {
    const run = vi.fn(async () => ok([null, null, 3]));
    const signature: Signature = { mode: "class", entry: "MinStack", params: [], returns: null };
    render(
      <CustomInputPanel targetId="lc-0155" signature={signature} exampleInput={{ ops: ["MinStack", "push", "getMin"], args: [[], [3], []] }} run={run} />,
    );
    expect(screen.getByRole("textbox", { name: "ops" })).toHaveValue('["MinStack","push","getMin"]');
    await userEvent.click(screen.getByRole("button", { name: /Run custom input/ }));
    expect(run).toHaveBeenCalledWith({ ops: ["MinStack", "push", "getMin"], args: [[], [3], []] });
  });

  it("lists the issues the server found, and shows errors raised by the code", async () => {
    const run = vi
      .fn<(input: unknown) => Promise<CustomResult>>()
      .mockRejectedValueOnce(new ApiError(422, "the input does not match the signature", ["custom.input: expected 2 params, got 1"]))
      .mockResolvedValueOnce({ fatal: null, error: { kind: "exception", message: "IndexError: list index out of range", trace: "line 3, in twoSum" }, ms: 1, stdout: "" });
    render(<CustomInputPanel targetId="lc-0001" signature={SIG} exampleInput={EXAMPLE} run={run} />);
    await userEvent.click(screen.getByRole("button", { name: /Run custom input/ }));
    expect(await screen.findByText("custom.input: expected 2 params, got 1")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Run custom input/ }));
    expect(await screen.findByText("exception: IndexError: list index out of range")).toBeInTheDocument();
    expect(screen.getByText("line 3, in twoSum")).toBeInTheDocument();
  });

  it("explains that it needs a valid cases.json", () => {
    render(<CustomInputPanel targetId="lc-0001" signature={null} exampleInput={null} run={vi.fn()} />);
    expect(screen.getByText(/needs a valid cases\.json/)).toBeInTheDocument();
  });
});
