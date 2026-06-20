import { expect, test } from "@playwright/test";

import { login, openDosette, openPatients } from "./helpers";

test("admin can deduct stock for a prepared dosette cycle", async ({ page }) => {
  await login(page, "admin@demo.local");
  await openPatients(page);

  const patientRow = page.getByRole("row").filter({ hasText: "CRO-P1" });
  await patientRow.getByRole("link", { name: "View" }).click();
  await openDosette(page);

  const cycleRow = page.getByRole("row").filter({ hasText: "MDS-2026-FW07" });
  await cycleRow.getByRole("button", { name: "View picking list" }).click();

  await expect(
    page.getByRole("heading", { name: "Stock availability" }),
  ).toBeVisible();
  await expect(page.getByText("Ibuprofen")).toBeVisible();
  await expect(page.getByText("CRO-IBU-001")).toBeVisible();

  const deductButton = cycleRow.getByRole("button", { name: "Deduct stock" });

  if ((await deductButton.count()) > 0) {
    await deductButton.click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Deduct stock" })
      .click();
  }

  await expect(cycleRow.getByText("Stock deducted")).toBeVisible();
  await expect(
    cycleRow.getByRole("button", { name: "Deduct stock" }),
  ).toHaveCount(0);
  await expect(cycleRow.getByRole("button", { name: "Cancel" })).toHaveCount(0);
});
