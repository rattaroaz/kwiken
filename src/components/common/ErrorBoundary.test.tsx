import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ErrorBoundary from "./ErrorBoundary";
import { useLogStore } from "@/stores/logStore";

function Boom(): never {
  throw new Error("Test crash");
}

describe("ErrorBoundary", () => {
  it("renders children when no error", () => {
    render(
      <ErrorBoundary>
        <p>All good</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText("All good")).toBeInTheDocument();
  });

  it("catches errors and shows fallback UI", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    useLogStore.setState({ entries: [], panelOpen: false, levelFilter: "all" });

    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );

    expect(screen.getByTestId("error-boundary")).toBeInTheDocument();
    expect(screen.getByText("Test crash")).toBeInTheDocument();
    expect(useLogStore.getState().entries.some((e) => e.message === "Unhandled UI error")).toBe(true);
  });

  it("copies error to clipboard", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();

    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );

    await user.click(screen.getByTestId("error-copy"));
    expect(await screen.findByText("Copied")).toBeInTheDocument();
  });
});
