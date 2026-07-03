import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn(async () => undefined),
}));

import { openUrl } from "@tauri-apps/plugin-opener";
import { DOCS_BASE_URL, openDoc, openDocsIndex } from "./docs";

const mockedOpenUrl = vi.mocked(openUrl);

describe("docs", () => {
  beforeEach(() => {
    mockedOpenUrl.mockClear();
  });

  it("opens a specific documentation file", async () => {
    await openDoc("user-guide.md");
    expect(mockedOpenUrl).toHaveBeenCalledWith(`${DOCS_BASE_URL}/user-guide.md`);
  });

  it("opens the documentation index", async () => {
    await openDocsIndex();
    expect(mockedOpenUrl).toHaveBeenCalledWith(`${DOCS_BASE_URL}/README.md`);
  });
});
