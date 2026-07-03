import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AppShell from "./layout/AppShell";
import CommandPalette from "./layout/CommandPalette";
import ConfirmDialog from "./common/ConfirmDialog";
import DatabaseErrorScreen from "./common/DatabaseErrorScreen";
import LoadingSkeleton, { CardSkeleton } from "./common/LoadingSkeleton";
import Modal from "./common/Modal";
import ToastContainer from "./common/ToastContainer";
import LockScreen from "./security/LockScreen";
import PrivacyToggle from "./security/PrivacyToggle";
import HelpMenu from "./help/HelpMenu";
import { useLogStore } from "@/stores/logStore";
import { useSecurityStore, useUiStore } from "@/stores/index";

const mocks = vi.hoisted(() => ({
  unlockApp: vi.fn(async (password: string) => password === "secret"),
}));

vi.mock("@/services/db", () => ({
  db: {
    unlockApp: mocks.unlockApp,
    restoreDatabase: vi.fn(async () => undefined),
  },
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(async () => "C:\\e2e\\backup.db"),
}));

vi.mock("@/services/updateService", () => ({
  checkForUpdatesAndApply: vi.fn(async () => undefined),
}));

vi.mock("@/lib/docs", () => ({
  openDoc: vi.fn(async () => undefined),
  openDocsIndex: vi.fn(async () => undefined),
}));

beforeEach(() => {
  vi.clearAllMocks();
  useUiStore.setState({
    toasts: [],
    confirm: { open: false, title: "", message: "" },
    sidebarCollapsed: false,
    commandPaletteOpen: false,
  });
  useSecurityStore.setState({
    hasMasterPassword: true,
    isLocked: true,
    privacyMode: false,
    lastActivity: Date.now(),
  });
  useLogStore.setState({ panelOpen: false, entries: [] });
});

describe("component smoke coverage", () => {
  it("renders modal content and footer", () => {
    render(
      <Modal open title="Test Modal" onClose={() => {}} footer={<button type="button">Done</button>}>
        Body content
      </Modal>,
    );
    expect(screen.getByRole("heading", { name: "Test Modal" })).toBeInTheDocument();
    expect(screen.getByText("Body content")).toBeInTheDocument();
  });

  it("renders confirmation dialog and runs confirm action", () => {
    const onConfirm = vi.fn();
    useUiStore.getState().showConfirm("Delete", "Really delete?", onConfirm);
    render(<ConfirmDialog />);
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it("renders toasts", () => {
    useUiStore.getState().addToast("success", "Saved");
    render(<ToastContainer />);
    expect(screen.getByText("Saved")).toBeInTheDocument();
  });

  it("renders skeletons", () => {
    const { container } = render(
      <>
        <LoadingSkeleton rows={2} />
        <CardSkeleton />
      </>,
    );
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("renders lock screen and unlocks", async () => {
    render(<LockScreen />);
    fireEvent.change(screen.getByPlaceholderText("Master password"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));
    await waitFor(() => expect(useSecurityStore.getState().isLocked).toBe(false));
  });

  it("toggles privacy mode", () => {
    render(<PrivacyToggle />);
    fireEvent.click(screen.getByRole("button"));
    expect(useSecurityStore.getState().privacyMode).toBe(true);
  });

  it("opens help menu", () => {
    render(<HelpMenu />);
    fireEvent.click(screen.getByTestId("menu-help"));
    expect(screen.getByTestId("menu-check-updates")).toBeInTheDocument();
    expect(screen.getByTestId("menu-documentation")).toBeInTheDocument();
  });

  it("renders database error recovery screen", () => {
    render(<DatabaseErrorScreen />);
    expect(screen.getByText("Database problem detected")).toBeInTheDocument();
    expect(screen.getByText("Restore from backup")).toBeInTheDocument();
  });

  it("renders app shell navigation", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<div>Dashboard Outlet</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("Dashboard Outlet")).toBeInTheDocument();
    expect(screen.getByText("Accounts")).toBeInTheDocument();
  });

  it("renders command palette when store opens it", () => {
    useUiStore.setState({ commandPaletteOpen: true });
    render(
      <MemoryRouter>
        <CommandPalette />
      </MemoryRouter>,
    );
    expect(screen.getByPlaceholderText("Search pages, accounts, payees, categories, transactions…")).toBeInTheDocument();
  });
});
