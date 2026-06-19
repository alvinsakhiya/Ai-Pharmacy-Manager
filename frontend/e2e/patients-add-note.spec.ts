import { expect, test } from "@playwright/test";

import {
  login,
  logout,
  openFirstPatientDetail,
  openPatients,
} from "./helpers";

test("pharmacist adds a patient note", async ({ page }) => {
  await login(page, "pharmacist@demo.local");
  await openPatients(page);
  await openFirstPatientDetail(page);

  await page.getByRole("button", { name: "Add note" }).click();

  const dialog = page.getByRole("dialog", { name: "Add note" });
  await dialog.getByLabel("Note body").fill("E2E note: pharmacist follow-up");
  await dialog.getByRole("button", { name: "Add note" }).click();

  await expect(page.getByRole("dialog", { name: "Add note" })).toHaveCount(0);
  await expect(
    page.getByText("E2E note: pharmacist follow-up").first(),
  ).toBeVisible();

  await logout(page);
});
