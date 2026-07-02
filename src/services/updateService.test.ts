import { describe, expect, it, vi, beforeEach } from "vitest";

const mockCheck = vi.fn();
const mockRelaunch = vi.fn();
const mockAsk = vi.fn();

vi.mock("@tauri-apps/plugin-updater", () => ({
  check: (...args: unknown[]) => mockCheck(...args),
}));

vi.mock("@tauri-apps/plugin-process", () => ({
  relaunch: (...args: unknown[]) => mockRelaunch(...args),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  ask: (...args: unknown[]) => mockAsk(...args),
}));

vi.mock("@/lib/constants", () => ({
  APP_NAME: "Kwiken",
  APP_VERSION: "0.1.0",
}));

import { checkForUpdatesAndApply } from "./updateService";
import { useUiStore } from "@/stores/index";

function resetStore() {
  useUiStore.setState({
    showUpdateDialog: false,
    updatePhase: "idle",
    updateMessage: "",
    hasUnsavedChanges: false,
  });
}

describe("checkForUpdatesAndApply", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
    mockAsk.mockResolvedValue(true);
  });

  it("shows up_to_date when check returns null", async () => {
    mockCheck.mockResolvedValue(null);
    await checkForUpdatesAndApply();
    const state = useUiStore.getState();
    expect(state.updatePhase).toBe("up_to_date");
    expect(mockRelaunch).not.toHaveBeenCalled();
  });

  it("shows up_to_date when remote version is not newer (semver guard)", async () => {
    mockCheck.mockResolvedValue({
      version: "0.1.0",
      downloadAndInstall: vi.fn(),
    });
    await checkForUpdatesAndApply();
    expect(useUiStore.getState().updatePhase).toBe("up_to_date");
    expect(mockRelaunch).not.toHaveBeenCalled();
  });

  it("downloads and relaunches when a newer version is available", async () => {
    const downloadAndInstall = vi.fn().mockResolvedValue(undefined);
    mockCheck.mockResolvedValue({ version: "0.2.0", downloadAndInstall });
    await checkForUpdatesAndApply();
    expect(downloadAndInstall).toHaveBeenCalled();
    expect(mockRelaunch).toHaveBeenCalled();
  });

  it("closes dialog when user declines unsaved changes prompt", async () => {
    useUiStore.setState({ hasUnsavedChanges: true });
    mockAsk.mockResolvedValue(false);
    mockCheck.mockResolvedValue({
      version: "0.2.0",
      downloadAndInstall: vi.fn(),
    });
    await checkForUpdatesAndApply();
    expect(useUiStore.getState().showUpdateDialog).toBe(false);
    expect(mockRelaunch).not.toHaveBeenCalled();
  });

  it("shows error phase on generic failure", async () => {
    mockCheck.mockRejectedValue(new Error("Network failure"));
    await checkForUpdatesAndApply();
    expect(useUiStore.getState().updatePhase).toBe("error");
    expect(useUiStore.getState().updateMessage).toContain("Network failure");
  });

  it("shows setup guidance when feed is unavailable", async () => {
    mockCheck.mockRejectedValue(new Error("Could not fetch a valid release JSON"));
    await checkForUpdatesAndApply();
    expect(useUiStore.getState().updatePhase).toBe("error");
    expect(useUiStore.getState().updateMessage).toContain("No update feed is published yet");
  });
});
