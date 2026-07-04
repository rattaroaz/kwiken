import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HelpMenu from "./HelpMenu";
import { openDoc, openDocsIndex } from "@/lib/docs";
import { checkForUpdatesAndApply } from "@/services/updateService";

vi.mock("@/lib/docs", () => ({
  openDoc: vi.fn(async () => undefined),
  openDocsIndex: vi.fn(async () => undefined),
}));

vi.mock("@/services/updateService", () => ({
  checkForUpdatesAndApply: vi.fn(async () => undefined),
}));

describe("HelpMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens documentation links from menu", async () => {
    const user = userEvent.setup();
    render(<HelpMenu />);
    await user.click(screen.getByTestId("menu-help"));
    await user.click(screen.getByTestId("menu-documentation"));
    expect(openDocsIndex).toHaveBeenCalled();
    await user.click(screen.getByTestId("menu-help"));
    await user.click(screen.getByTestId("menu-user-guide"));
    expect(openDoc).toHaveBeenCalledWith("user-guide.md");
  });

  it("checks for updates", async () => {
    const user = userEvent.setup();
    render(<HelpMenu />);
    await user.click(screen.getByTestId("menu-help"));
    await user.click(screen.getByTestId("menu-check-updates"));
    expect(checkForUpdatesAndApply).toHaveBeenCalled();
  });

  it("shows version in collapsed mode", async () => {
    const user = userEvent.setup();
    render(<HelpMenu collapsed />);
    await user.click(screen.getByTestId("menu-help"));
    expect(screen.getByTestId("menu-help-version")).toBeInTheDocument();
  });
});
