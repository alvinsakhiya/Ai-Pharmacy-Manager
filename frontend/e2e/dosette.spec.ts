import { expect, test } from "@playwright/test";

import {
  login,
  openDosette,
  openFirstPatientDetail,
  openPatients,
} from "./helpers";

test("pharmacist can view dosette medication lines, cycles, and picking list", async ({
  page,
}) => {
  await login(page, "pharmacist@demo.local");
  await openPatients(page);
  await openFirstPatientDetail(page);
  await openDosette(page);

  await expect(
    page.getByRole("heading", { name: "Medication lines" }),
  ).toBeVisible();
  await expect(page.getByText("Paracetamol")).toBeVisible();

  await expect(page.getByRole("heading", { name: "Cycles" })).toBeVisible();
  await expect(page.getByText("MDS-2026-W26")).toBeVisible();

  await page.getByRole("button", { name: "View picking list" }).first().click();

  await expect(
    page.getByRole("heading", { name: /Picking list: MDS-2026-W26/ }),
  ).toBeVisible();
  await expect(page.getByText("Totals")).toBeVisible();
});
