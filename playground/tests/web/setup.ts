import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(cleanup);
// jsdom has no scrollTo; TanStack Router calls it after navigating.
window.scrollTo = () => {};
