import { test, expect } from "@playwright/test";

test.describe("Settings persistence", () => {
  test("theme setting saves via mock backend", async ({ page }) => {
    await page.goto("/settings");
    const themeSelect = page.locator("label", { hasText: "Theme" }).locator("..").locator("select");
    await themeSelect.selectOption("dark");
    await expect(page.getByText("Setting saved")).toBeVisible();
    await expect(themeSelect).toHaveValue("dark");
  });
});
