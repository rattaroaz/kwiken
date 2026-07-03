import { test, expect } from "@playwright/test";

const SAMPLE_CSV = `date,amount,payee,memo,category
2026-06-20,-12.50,Coffee Shop,Morning,Food & Dining`;

test.describe("CSV import", () => {
  test("preview and commit import rows", async ({ page }) => {
    await page.addInitScript((csv) => {
      sessionStorage.setItem("e2e-file-content", csv);
    }, SAMPLE_CSV);

    await page.goto("/import-export");

    await page.getByRole("button", { name: "Choose File" }).click();
    await expect(page.getByText("Coffee Shop")).toBeVisible();
    await expect(page.getByRole("button", { name: /Import 1 rows/ })).toBeVisible();

    await page.getByRole("button", { name: /Import 1 rows/ }).click();
    await expect(page.getByText("Imported 1 transactions")).toBeVisible();
  });
});
