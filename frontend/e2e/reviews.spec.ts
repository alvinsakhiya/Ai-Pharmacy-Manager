import { expect, test } from "@playwright/test";

import { login, openFirstPatientDetail, openPatients } from "./helpers";

test("pharmacist can create and complete a patient review", async ({ page }) => {
  const marker = `E2E-REVIEW-${Date.now()}`;

  await login(page, "pharmacist@demo.local");
  await openPatients(page);
  await openFirstPatientDetail(page);

  await page.getByRole("button", { name: "Add review" }).click();

  const createDialog = page.getByRole("dialog", { name: "New review" });
  await createDialog.getByLabel("Notes").fill(marker);
  await createDialog.getByRole("button", { name: "Create review" }).click();

  const card = page.locator("article").filter({ hasText: marker });
  await expect(card).toBeVisible();

  await expect(card.getByText("SUT-P1")).toBeVisible();
  await expect(card.getByText("Pending")).toBeVisible();

  await card.getByRole("button", { name: "Complete" }).click();
  await page
    .getByRole("dialog", { name: "Complete review?" })
    .getByRole("button", { name: "Complete" })
    .click();

  await expect(card.getByText("Completed")).toBeVisible();

  await expect(
    card.getByText(/PatientOne|Demo Street|020 0000 0001|1980/),
  ).toHaveCount(0);
  await expect(card.getByText(/diagnos|recommendation|clinical/i)).toHaveCount(
    0,
  );
});
