import { expect, test } from "@playwright/test";

import {
  expectAccessDenied,
  expectNavHidden,
  expectNavVisible,
  login,
  logout,
  openFirstPatientDetail,
  openPatients,
} from "./helpers";

test("admin can view and manage patients", async ({ page }) => {
  await login(page, "admin@demo.local");

  await expectNavVisible(page, ["Patients"]);
  await openPatients(page);
  await expect(page.getByText("CRO-P1")).toBeVisible();
  await expect(page.getByRole("button", { name: "Create patient" })).toBeVisible();

  await openFirstPatientDetail(page);
  await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Deactivate" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Note history" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Add note" })).toBeVisible();

  await logout(page);
});

test("pharmacist can view and manage patients in scope", async ({ page }) => {
  await login(page, "pharmacist@demo.local");

  await expectNavVisible(page, ["Patients"]);
  await openPatients(page);
  await expect(page.getByText("SUT-P1")).toBeVisible();
  await expect(page.getByRole("button", { name: "Create patient" })).toBeVisible();

  await openFirstPatientDetail(page);
  await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Deactivate" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Note history" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Add note" })).toBeVisible();

  await logout(page);
});

test("dispenser can view patients and notes but cannot manage", async ({
  page,
}) => {
  await login(page, "dispenser@demo.local");

  await expectNavVisible(page, ["Patients"]);
  await openPatients(page);
  await expect(page.getByText("CRO-P1")).toBeVisible();
  await expect(page.getByRole("button", { name: "Create patient" })).toHaveCount(0);

  await openFirstPatientDetail(page);
  await expect(
    page.getByRole("heading", { name: "Note history" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Deactivate" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add note" })).toHaveCount(0);

  await logout(page);
});

test("superintendent cannot access patients", async ({ page }) => {
  await login(page, "superintendent@demo.local");

  await expectNavHidden(page, ["Patients"]);
  await page.goto("/patients");
  await expectAccessDenied(page);
  await page.goto("/patients/1");
  await expectAccessDenied(page);

  await logout(page);
});

test("stock employee cannot access patients", async ({ page }) => {
  await login(page, "stock@demo.local");

  await expectNavHidden(page, ["Patients"]);
  await page.goto("/patients");
  await expectAccessDenied(page);
  await page.goto("/patients/1");
  await expectAccessDenied(page);

  await logout(page);
});
