import { test, expect } from "@playwright/test";

test.describe("Reports", () => {
  test("spending report renders with mocked data", async ({ page }) => {
    await page.goto("/reports");
    await expect(page.getByTestId("reports-panel")).toBeVisible();
    await expect(page.getByTestId("report-spending")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Groceries")).toBeVisible();
  });
});
