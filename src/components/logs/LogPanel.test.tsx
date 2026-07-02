import { describe, expect, it, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LogPanel from "./LogPanel";
import { useLogStore } from "@/stores/logStore";
import { makeLogEntry } from "@/test/helpers";

describe("LogPanel", () => {
  beforeEach(() => {
    useLogStore.setState({
      entries: [
        makeLogEntry({ level: "info", category: "app", message: "App started" }),
        makeLogEntry({ level: "error", category: "db", message: "Query timeout" }),
      ],
      panelOpen: true,
      levelFilter: "all",
    });
  });

  it("renders when panel is open", () => {
    render(<LogPanel />);
    expect(screen.getByTestId("log-panel")).toBeInTheDocument();
    expect(screen.getByText("App started")).toBeInTheDocument();
  });

  it("shows error count badge", () => {
    render(<LogPanel />);
    expect(screen.getByTestId("log-error-count")).toHaveTextContent("1");
  });

  it("filters by search query", async () => {
    const user = userEvent.setup();
    render(<LogPanel />);
    await user.type(screen.getByTestId("log-search"), "timeout");
    expect(screen.getByText("Query timeout")).toBeInTheDocument();
    expect(screen.queryByText("App started")).not.toBeInTheDocument();
  });

  it("clears logs", async () => {
    const user = userEvent.setup();
    render(<LogPanel />);
    await user.click(screen.getByTestId("log-clear"));
    expect(useLogStore.getState().entries).toHaveLength(0);
  });

  it("returns null when panel is closed", () => {
    useLogStore.setState({ panelOpen: false });
    const { container } = render(<LogPanel />);
    expect(container).toBeEmptyDOMElement();
  });
});
