import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DifficultyBadge } from "../../web/components/DifficultyBadge.tsx";
import { ErrorMark } from "../../web/components/ErrorMark.tsx";
import { StatusIcon } from "../../web/components/StatusIcon.tsx";

describe("status vocabulary", () => {
  it("names each status icon by its status, for screen readers and tests", () => {
    render(
      <>
        <StatusIcon status="todo" inProgress={false} />
        <StatusIcon status="todo" inProgress />
        <StatusIcon status="revealed" inProgress={false} />
        <StatusIcon status="solved" inProgress={false} />
      </>,
    );
    expect(screen.getAllByRole("img").map((icon) => icon.getAttribute("aria-label"))).toEqual(["To do", "In progress", "Revealed", "Solved"]);
  });

  it("shows a known difficulty and nothing for an unknown one", () => {
    render(<DifficultyBadge difficulty="medium" />);
    expect(screen.getByText("Medium")).toBeInTheDocument();
    const { container } = render(<DifficultyBadge difficulty={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("names a broken file by its error", () => {
    render(<ErrorMark error="frontmatter: bad" />);
    expect(screen.getByRole("img", { name: "Broken README: frontmatter: bad" })).toBeInTheDocument();
  });
});
