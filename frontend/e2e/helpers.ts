import { expect, type Page } from "@playwright/test";

export const DEMO_PASSWORD = "DemoPass!2026";

export async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Dashboard landing")).toBeVisible();
}
