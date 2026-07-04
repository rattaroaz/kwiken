import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AppShell from "./AppShell";
import { useSecurityStore, useUiStore } from "@/stores/index";

vi.mock("./CommandPalette", () => ({ default: () => null }));
vi.mock("@/components/logs/LogPanel", () => ({ default: () => null }));
vi.mock("./Sidebar", () => ({ default: () => <nav>Sidebar</nav> }));
vi.mock("@/components/security/PrivacyToggle", () => ({ default: () => <button type="button">Privacy</button> }));

describe("AppShell", () => {
  beforeEach(() => {
    useUiStore.setState({ commandPaletteOpen: false });
    useSecurityStore.setState({ lastActivity: 0 });
  });

  it("opens command palette on Ctrl+K", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<div>Home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(useUiStore.getState().commandPaletteOpen).toBe(true);
  });

  it("navigates to accounts on Ctrl+N", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<div>Home</div>} />
            <Route path="accounts" element={<div>Accounts Page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.keyDown(window, { key: "n", ctrlKey: true });
    expect(screen.getByText("Accounts Page")).toBeInTheDocument();
  });

  it("touches activity on keydown", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<div>Home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    const before = useSecurityStore.getState().lastActivity;
    fireEvent.keyDown(window, { key: "a" });
    expect(useSecurityStore.getState().lastActivity).toBeGreaterThanOrEqual(before);
  });
});
