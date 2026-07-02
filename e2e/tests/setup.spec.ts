import { test, expect } from "@playwright/test";

test.describe("Setup wizard", () => {
  test("first-run account setup", async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem("e2e-force-setup", "1");
    });
    await page.goto("/");

    await expect(page.getByTestId("setup-wizard")).toBeVisible();
    await page.getByPlaceholder("e.g. Main Checking").fill("E2E Checking");
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Finish Setup" }).click();

    await expect(page.getByText("Welcome! Your first account has been created.")).toBeVisible();
  });
});
