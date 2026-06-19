import { expect, test } from "@playwright/test";

import {
  expectAccessDenied,
  expectNavHidden,
  expectNavVisible,
  login,
  logout,
  openMedicationsAndAssert,
} from "./helpers";

test("dispenser sees dashboard and medications but is denied management routes", async ({
  page,
}) => {
  await login(page, "dispenser@demo.local");

  await expect(page.getByText("Dashboard landing")).toBeVisible();
  await expectNavVisible(page, ["Dashboard", "Medications"]);
  await expectNavHidden(page, ["Users", "Organisation", "Audit Log"]);

  await page.goto("/users");
  await expectAccessDenied(page);

  await page.goto("/tenancy");
  await expectAccessDenied(page);

  await page.goto("/audit");
  await expectAccessDenied(page);

  await openMedicationsAndAssert(page, { canManage: false });

  await logout(page);
});
