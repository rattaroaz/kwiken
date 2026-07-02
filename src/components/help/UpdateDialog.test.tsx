import { describe, expect, it, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import UpdateDialog from "./UpdateDialog";
import { useUiStore } from "@/stores/index";

describe("UpdateDialog", () => {
  afterEach(() => {
    cleanup();
    useUiStore.setState({
      showUpdateDialog: false,
      updatePhase: "idle",
      updateMessage: "",
    });
  });

  it("shows checking title when phase is checking", () => {
    useUiStore.setState({
      showUpdateDialog: true,
      updatePhase: "checking",
      updateMessage: "Checking for updates…",
    });
    render(<UpdateDialog />);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Checking for updates")).toBeTruthy();
  });

  it("shows footer close button when not busy", () => {
    useUiStore.setState({
      showUpdateDialog: true,
      updatePhase: "up_to_date",
      updateMessage: "Up to date",
    });
    render(<UpdateDialog />);
    expect(screen.getByTestId("update-dialog-close")).toBeTruthy();
  });

  it("hides footer close button while downloading", () => {
    useUiStore.setState({
      showUpdateDialog: true,
      updatePhase: "downloading",
      updateMessage: "Downloading…",
    });
    render(<UpdateDialog />);
    expect(screen.queryByTestId("update-dialog-close")).toBeNull();
    expect(screen.getByText("Please wait…")).toBeTruthy();
  });
});
