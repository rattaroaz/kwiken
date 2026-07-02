import { describe, expect, it } from "vitest";
import { isVersionNewer, parseSemver } from "./semver";

describe("parseSemver", () => {
  it("parses three-part versions", () => {
    expect(parseSemver("1.2.3")).toEqual([1, 2, 3]);
  });

  it("parses two-part versions as patch 0", () => {
    expect(parseSemver("1.2")).toEqual([1, 2, 0]);
  });

  it("strips v prefix", () => {
    expect(parseSemver("v1.2.0")).toEqual([1, 2, 0]);
  });

  it("strips pre-release and build metadata", () => {
    expect(parseSemver("1.2.3-beta.1+build")).toEqual([1, 2, 3]);
  });
});

describe("isVersionNewer", () => {
  it("returns true when candidate is newer", () => {
    expect(isVersionNewer("1.2.0", "1.1.9")).toBe(true);
  });

  it("returns false when versions are equal", () => {
    expect(isVersionNewer("1.1.0", "1.1.0")).toBe(false);
  });

  it("handles v-prefix on candidate", () => {
    expect(isVersionNewer("v1.2.0", "1.1.0")).toBe(true);
  });

  it("treats two-part version as patch 0", () => {
    expect(isVersionNewer("1.2", "1.1.9")).toBe(true);
    expect(isVersionNewer("1.2", "1.2.1")).toBe(false);
  });
});
