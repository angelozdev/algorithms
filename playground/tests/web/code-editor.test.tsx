import { render } from "@testing-library/react";
import { indentUnit } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { beforeAll, describe, expect, it } from "vitest";
import { CodeEditor } from "../../web/components/CodeEditor.tsx";

// jsdom has no matchMedia; CodeEditor reads it (via usePrefersDark) on every render.
beforeAll(() => {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
});

// spec §4.3: auto-indent (and Tab) use 4 spaces in Python, 2 in TypeScript. CodeMirror's indentation
// commands and services all read the `indentUnit` facet, so asserting its value here is equivalent to
// asserting the width of the indent that pressing Enter or Tab would insert.
describe("CodeEditor indentation", () => {
  it("sets indentUnit to 4 spaces for Python", () => {
    const { container } = render(<CodeEditor lang="py" value="def f():" onChange={() => {}} ariaLabel="Code" />);
    const view = EditorView.findFromDOM(container.querySelector(".cm-editor")!)!;
    expect(view.state.facet(indentUnit)).toBe("    ");
  });

  it("sets indentUnit to 2 spaces for TypeScript", () => {
    const { container } = render(<CodeEditor lang="ts" value="function f() {}" onChange={() => {}} ariaLabel="Code" />);
    const view = EditorView.findFromDOM(container.querySelector(".cm-editor")!)!;
    expect(view.state.facet(indentUnit)).toBe("  ");
  });
});
