import { expect, type Page } from "@playwright/test";

export const DEMO_PASSWORD = "DemoPass!2026";

export function nav(page: Page) {
  return page.getByRole("navigation", { name: "Primary navigation" });
}

export async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Dashboard landing")).toBeVisible();
}

export async function logout(page: Page) {
  await page.getByRole("button", { name: "Logout" }).click();
  await expect(page.getByLabel("Email")).toBeVisible();
}

export async function expectAccessDenied(page: Page) {
  await expect(page.getByText(/access to this section/i)).toBeVisible();
}

export async function expectNavVisible(page: Page, names: string[]) {
  for (const name of names) {
    await expect(
      nav(page).getByRole("link", { name, exact: true }),
    ).toBeVisible();
  }
}

export async function expectNavHidden(page: Page, names: string[]) {
  for (const name of names) {
    await expect(nav(page).getByRole("link", { name, exact: true })).toHaveCount(
      0,
    );
  }
}
