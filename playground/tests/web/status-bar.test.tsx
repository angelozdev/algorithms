import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { solutionSaveLabel, StatusBar } from "../../web/components/StatusBar.tsx";

describe("status bar", () => {
  it("says whether the file is saved, and that text typed while the server is down is not", () => {
    expect(solutionSaveLabel("saved", true)).toEqual({ text: "Saved", tone: "ok" });
    expect(solutionSaveLabel("pending", true)).toEqual({ text: "Saving…", tone: "busy" });
    expect(solutionSaveLabel("saving", true)).toEqual({ text: "Saving…", tone: "busy" });
    expect(solutionSaveLabel("pending", false)).toEqual({ text: "Not saved", tone: "bad" });
    expect(solutionSaveLabel("error", true)).toEqual({ text: "Not saved", tone: "bad" });
    expect(solutionSaveLabel("conflict", true)).toEqual({ text: "Conflict", tone: "warn" });
    expect(solutionSaveLabel("loading", true)).toEqual({ text: "Loading…", tone: "busy" });
  });

  it("shows the connection, the file, the save state and the shortcuts", () => {
    render(<StatusBar subject="Python · solution.py" save={{ text: "Saved", tone: "ok" }} shortcuts={[{ keys: "Ctrl+Enter", label: "Run" }]} />);
    const bar = screen.getByRole("contentinfo", { name: "Status bar" });
    expect(bar).toHaveTextContent("Connected");
    expect(bar).toHaveTextContent("Python · solution.py");
    expect(screen.getByRole("status", { name: "Save status" })).toHaveTextContent("Saved");
    expect(screen.getByText("Ctrl+Enter")).toBeInTheDocument();
  });
});
