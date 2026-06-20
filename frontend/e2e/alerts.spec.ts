import { expect, test } from "@playwright/test";

import { login, nav } from "./helpers";

test("stock employee can view alerts without patient data", async ({ page }) => {
  await login(page, "stock@demo.local");

  await nav(page).getByRole("link", { name: "Alerts", exact: true }).click();

  await expect(
    page.getByRole("heading", { name: "Alerts", level: 1 }),
  ).toBeVisible();

  await expect(page.getByText("Total", { exact: true })).toBeVisible();
  await expect(page.getByText("Info", { exact: true })).toBeVisible();

  const card = page.locator("article").filter({ hasText: "Paracetamol" }).first();
  await expect(card).toBeVisible();
  await expect(card.getByText("Stock", { exact: true })).toBeVisible();
  await expect(card.getByText(/^(critical|warning|info)$/)).toBeVisible();

  await expect(
    page.getByText(/SUT-P1|CRO-P1|PatientOne|PatientThree/),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /mark|resolve|dismiss|read/i }),
  ).toHaveCount(0);
});
