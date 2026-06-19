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

export async function openMedicationsAndAssert(
  page: Page,
  { canManage }: { canManage: boolean },
) {
  await nav(page)
    .getByRole("link", { name: "Medications", exact: true })
    .click();

  await expect(
    page.getByRole("heading", { name: "Medications", exact: true }),
  ).toBeVisible();

  const createButton = page.getByRole("button", { name: "Create medication" });

  if (canManage) {
    await expect(createButton).toBeVisible();
  } else {
    await expect(createButton).toHaveCount(0);
  }
}

export async function openInventory(page: Page) {
  await nav(page)
    .getByRole("link", { name: "Inventory", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Inventory", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "View" }).first()).toBeVisible();
}

export async function openFirstStockItemDetail(page: Page) {
  await page.getByRole("link", { name: "View" }).first().click();
  await expect(page).toHaveURL(/\/inventory\/\d+$/);
  await expect(
    page.getByRole("link", { name: "Back to inventory" }),
  ).toBeVisible();
}

export async function openPatients(page: Page) {
  await nav(page).getByRole("link", { name: "Patients", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Patients", exact: true }),
  ).toBeVisible();
}

export async function openFirstPatientDetail(page: Page) {
  await page.getByRole("link", { name: "View" }).first().click();
  await expect(page).toHaveURL(/\/patients\/\d+$/);
  await expect(
    page.getByRole("link", { name: "Back to patients" }),
  ).toBeVisible();
}
