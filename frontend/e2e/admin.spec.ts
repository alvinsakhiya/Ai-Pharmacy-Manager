import { expect, test } from "@playwright/test";

import { login, openMedicationsAndAssert } from "./helpers";

test("admin can navigate phase 1 management screens", async ({ page }) => {
  await login(page, "admin@demo.local");

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("Dashboard landing")).toBeVisible();

  const nav = page.getByRole("navigation", { name: "Primary navigation" });
  await expect(nav.getByRole("link", { name: "Dashboard" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Users" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Organisation" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Medications" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Audit" })).toBeVisible();

  await nav.getByRole("link", { name: "Users" }).click();
  await expect(
    page.getByRole("heading", { name: "Users", exact: true }),
  ).toBeVisible();

  await nav.getByRole("link", { name: "Organisation" }).click();
  await expect(
    page.getByRole("heading", { name: "Organisation", exact: true }),
  ).toBeVisible();

  await nav.getByRole("link", { name: "Audit" }).click();
  await expect(
    page.getByRole("heading", { name: "Audit Log", exact: true }),
  ).toBeVisible();

  await openMedicationsAndAssert(page, { canManage: true });

  await page.getByRole("button", { name: "Logout" }).click();
  await expect(page.getByLabel("Email")).toBeVisible();
});
