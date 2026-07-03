import { test, expect } from "@playwright/test";

test.describe("Lock screen", () => {
  test("unlock with master password", async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem(
        "e2e-security",
        JSON.stringify({
          hasMasterPassword: true,
          isLocked: true,
          password: "secret",
        }),
      );
    });

    await page.goto("/");

    await expect(page.getByText("is locked")).toBeVisible();
    await page.getByPlaceholder("Master password").fill("secret");
    await page.getByRole("button", { name: "Unlock" }).click();

    await expect(page.getByText("App unlocked")).toBeVisible();
    await expect(page.getByText("is locked")).not.toBeVisible();
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });

  test("shows error for wrong password", async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem(
        "e2e-security",
        JSON.stringify({
          hasMasterPassword: true,
          isLocked: true,
          password: "secret",
        }),
      );
    });

    await page.goto("/");
    await page.getByPlaceholder("Master password").fill("wrong");
    await page.getByRole("button", { name: "Unlock" }).click();

    await expect(page.getByText("Incorrect password")).toBeVisible();
    await expect(page.getByText("is locked")).toBeVisible();
  });
});
