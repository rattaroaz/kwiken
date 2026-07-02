import { test, expect } from "@playwright/test";
import pkg from "../../package.json" with { type: "json" };

test.describe("Update check flow", () => {
  test("Help → Check for updates shows up to date dialog", async ({ page }) => {
    await page.goto("/");

    await page.getByTestId("menu-help").click();
    await page.getByTestId("menu-check-updates").click();

    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Up to date" })).toBeVisible();
    await expect(page.getByText(`Kwiken ${pkg.version} is up to date.`)).toBeVisible();
  });
});
