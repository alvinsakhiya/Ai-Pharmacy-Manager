import { expect, test } from "@playwright/test";

import {
  expectAccessDenied,
  expectNavHidden,
  expectNavVisible,
  login,
  logout,
  nav,
} from "./helpers";

test("pharmacist can access users and audit but not organisation", async ({
  page,
}) => {
  await login(page, "pharmacist@demo.local");

  await expect(page.getByText("Dashboard landing")).toBeVisible();
  await expectNavVisible(page, ["Dashboard", "Users", "Audit Log"]);
  await expectNavHidden(page, ["Organisation"]);

  await nav(page).getByRole("link", { name: "Users", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Users", exact: true }),
  ).toBeVisible();

  await nav(page).getByRole("link", { name: "Audit Log", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Audit Log", exact: true }),
  ).toBeVisible();

  await page.goto("/tenancy");
  await expectAccessDenied(page);

  await logout(page);
});
