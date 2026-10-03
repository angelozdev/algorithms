import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ConceptData } from "../../server/types.ts";
import { ApiError } from "../../web/api.ts";
import { ConceptView } from "../../web/components/ConceptView.tsx";
import { renderWithRouter } from "./render.tsx";

// CodeMirror needs layout APIs that jsdom lacks; a textarea stands in for it here. The end-to-end tests use the real editor.
vi.mock("../../web/components/CodeEditor.tsx", async () => {
  const { createElement } = await import("react");
  return {
    CodeEditor: ({ value, onChange, ariaLabel }: { value: string; onChange(value: string): void; ariaLabel: string }) =>
      createElement("textarea", { "aria-label": ariaLabel, value, onChange: (event: { target: { value: string } }) => onChange(event.target.value) }),
  };
});

const CONCEPT: ConceptData = {
  slug: "hash-map",
  title: "Hash map",
  status: "learning",
  readme: "concepts/hash-map/README.md",
  before: "# Hash map\n\n## Intuition\n\nA coat check.\n\n",
  explanation: "",
  after: "## Problems\n\n- ✓ [lc-0001 · Two Sum](../../problems/lc-0001-two-sum/README.md)\n",
  version: "v1",
  readmeError: null,
};

describe("ConceptView", () => {
  it("shows the note around the section; read-only in the side pane", async () => {
    await renderWithRouter(<ConceptView concept={CONCEPT} editable={false} />);
    expect(screen.getByRole("heading", { name: "Intuition" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "My explanation" })).toBeInTheDocument();
    expect(screen.getByText("Not written yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "lc-0001 · Two Sum" })).toHaveAttribute("href", "/p/lc-0001");
    expect(screen.queryByRole("button", { name: "✎ Edit" })).not.toBeInTheDocument();
  });

  it("edits the explanation with a live preview and saves it", async () => {
    const save = vi.fn(async () => {});
    await renderWithRouter(<ConceptView concept={{ ...CONCEPT, explanation: "Old text." }} editable save={save} />);
    await userEvent.click(screen.getByRole("button", { name: "✎ Edit" }));
    const editor = screen.getByRole("textbox", { name: "My explanation" });
    expect(editor).toHaveValue("Old text.");
    await userEvent.clear(editor);
    await userEvent.type(editor, "Keys become **positions**.");
    expect(screen.getByRole("region", { name: "Preview" })).toHaveTextContent("Keys become positions.");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(save).toHaveBeenCalledWith("Keys become **positions**.");
    expect(screen.queryByRole("textbox", { name: "My explanation" })).not.toBeInTheDocument();
  });

  it("keeps the draft and shows why the server refused it", async () => {
    const save = vi.fn(async () => {
      throw new ApiError(422, "Use ### or deeper for headings.", ["Use ### or deeper for headings."]);
    });
    await renderWithRouter(<ConceptView concept={CONCEPT} editable save={save} />);
    await userEvent.click(screen.getByRole("button", { name: "✎ Edit" }));
    await userEvent.type(screen.getByRole("textbox", { name: "My explanation" }), "## Mine");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Use ### or deeper for headings.");
    expect(screen.getByRole("textbox", { name: "My explanation" })).toHaveValue("## Mine");
  });

  it("explains a missing section and a broken README", async () => {
    const view = await renderWithRouter(<ConceptView concept={{ ...CONCEPT, explanation: null }} editable />);
    expect(screen.getByText(/has no "My explanation" section/)).toBeInTheDocument();
    view.unmount();
    await renderWithRouter(<ConceptView concept={{ ...CONCEPT, readmeError: "frontmatter: bad" }} editable />);
    expect(screen.getByRole("alert")).toHaveTextContent("frontmatter: bad");
  });
});
