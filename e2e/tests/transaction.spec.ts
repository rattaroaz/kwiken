import { test, expect } from "@playwright/test";

test.describe("Transactions", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/accounts/e2e-default-account");
  });

  test("add transaction and verify balance update", async ({ page }) => {
    await page.getByTestId("add-transaction").click();
    await page.getByLabel("Date").fill("2024-06-15");
    await page.getByLabel("Payee").fill("Coffee Shop");
    await page.getByLabel("Amount").fill("-5.00");
    await page.getByRole("button", { name: "Save", exact: true }).click();

    await expect(page.getByTestId("transaction-register")).toContainText("Coffee Shop");
    await expect(page.getByTestId("transaction-register")).toContainText("$5.00");
  });
});
