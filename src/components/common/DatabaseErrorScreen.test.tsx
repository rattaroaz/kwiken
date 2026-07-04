import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DatabaseErrorScreen from "./DatabaseErrorScreen";
import { useUiStore } from "@/stores/index";
import { db } from "@/services/db";

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

vi.mock("@/services/db", () => ({
  db: { restoreDatabase: vi.fn(async () => undefined) },
}));

import { open } from "@tauri-apps/plugin-dialog";

const mockedOpen = vi.mocked(open);
const mockedRestore = vi.mocked(db.restoreDatabase);

describe("DatabaseErrorScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUiStore.setState({ toasts: [] });
    vi.stubGlobal("location", { reload: vi.fn() });
  });

  it("shows unclean shutdown message", () => {
    render(<DatabaseErrorScreen uncleanShutdown />);
    expect(screen.getByText(/did not shut down cleanly/i)).toBeInTheDocument();
  });

  it("restores database from selected backup", async () => {
    const user = userEvent.setup();
    mockedOpen.mockResolvedValueOnce("C:\\backup\\kwiken.db");
    render(<DatabaseErrorScreen />);
    await user.click(screen.getByTestId("database-restore"));
    await waitFor(() => {
      expect(mockedRestore).toHaveBeenCalledWith("C:\\backup\\kwiken.db");
    });
    expect(useUiStore.getState().toasts.some((t) => t.type === "success")).toBe(true);
    expect(window.location.reload).toHaveBeenCalled();
  });

  it("shows error toast when restore fails", async () => {
    const user = userEvent.setup();
    mockedOpen.mockResolvedValueOnce("/tmp/kwiken.db");
    mockedRestore.mockRejectedValueOnce(new Error("Corrupt file"));
    render(<DatabaseErrorScreen />);
    await user.click(screen.getByTestId("database-restore"));
    await waitFor(() => {
      expect(useUiStore.getState().toasts.some((t) => t.message === "Corrupt file")).toBe(true);
    });
  });

  it("does nothing when dialog is cancelled", async () => {
    const user = userEvent.setup();
    mockedOpen.mockResolvedValueOnce(null);
    render(<DatabaseErrorScreen />);
    await user.click(screen.getByTestId("database-restore"));
    expect(mockedRestore).not.toHaveBeenCalled();
  });
});
