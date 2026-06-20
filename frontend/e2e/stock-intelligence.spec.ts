import { expect, test } from "@playwright/test";

import { login, nav } from "./helpers";

test("stock employee can view stock intelligence without patient data", async ({
  page,
}) => {
  await login(page, "stock@demo.local");

  await nav(page)
    .getByRole("link", { name: "Stock Intelligence", exact: true })
    .click();

  await expect(
    page.getByRole("heading", { name: "Stock Intelligence" }),
  ).toBeVisible();
  await expect(page.getByText("Total items")).toBeVisible();
  await expect(page.getByText("Needs attention")).toBeVisible();

  await expect(
    page.getByRole("heading", { name: "Attention table" }),
  ).toBeVisible();
  await expect(page.getByText("Paracetamol").first()).toBeVisible();
  await expect(
    page.getByText(/no outbound movement in 90 days/i).first(),
  ).toBeVisible();

  await expect(
    page.getByText(/SUT-P1|CRO-P1|PatientOne|PatientThree/),
  ).toHaveCount(0);
});
