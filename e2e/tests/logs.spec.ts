import { test, expect } from "@playwright/test";

test.describe("Log panel", () => {
  test("opens from Settings and shows entries", async ({ page }) => {
    await page.goto("/settings");
    await page.getByTestId("settings-view-logs").click();
    await expect(page.getByTestId("log-panel")).toBeVisible();
    await expect(page.getByTestId("log-entry-count")).toBeVisible();
  });
});
