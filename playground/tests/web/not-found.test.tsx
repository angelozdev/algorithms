import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NotFound } from "../../web/components/NotFound.tsx";
import { renderWithRouter } from "./render.tsx";

describe("NotFound", () => {
  it("says what is missing and leads back home", async () => {
    await renderWithRouter(<NotFound message='There is no concept "tries".' />);
    expect(screen.getByRole("heading", { name: "Not found" })).toBeInTheDocument();
    expect(screen.getByText('There is no concept "tries".')).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Algorithms" })).toHaveAttribute("href", "/");
  });
});
