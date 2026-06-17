import { expect, test } from "@playwright/test";

import {
  expectAccessDenied,
  expectNavHidden,
  expectNavVisible,
  login,
  logout,
  nav,
} from "./helpers";

test("superintendent sees audit only and denied management routes", async ({
  page,
}) => {
  await login(page, "superintendent@demo.local");

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("Dashboard landing")).toBeVisible();
  await expectNavVisible(page, ["Dashboard", "Audit Log"]);
  await expectNavHidden(page, ["Users", "Organisation"]);

  await page.goto("/users");
  await expectAccessDenied(page);

  await page.goto("/tenancy");
  await expectAccessDenied(page);

  await nav(page).getByRole("link", { name: "Audit Log", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Audit Log", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Group-level audit visibility is limited in this phase."),
  ).toBeVisible();

  await logout(page);
});
