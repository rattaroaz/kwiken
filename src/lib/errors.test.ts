import { describe, expect, it, vi } from "vitest";
import { formatErrorForUser, copyErrorToClipboard } from "./errors";

describe("formatErrorForUser", () => {
  it("extracts Error message", () => {
    expect(formatErrorForUser(new Error("boom"))).toBe("boom");
  });

  it("stringifies non-Error values", () => {
    expect(formatErrorForUser("plain")).toBe("plain");
  });
});

describe("copyErrorToClipboard", () => {
  it("copies error text", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const ok = await copyErrorToClipboard(new Error("test error"));
    expect(ok).toBe(true);
    expect(writeText).toHaveBeenCalledWith("test error");
    vi.unstubAllGlobals();
  });
});
