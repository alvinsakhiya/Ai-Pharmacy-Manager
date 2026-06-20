import { expect, test } from "@playwright/test";

import { login, nav } from "./helpers";

test("stock employee can view stock reports without patient data", async ({
  page,
}) => {
  await login(page, "stock@demo.local");

  await nav(page)
    .getByRole("link", { name: "Reports", exact: true })
    .click();

  await expect(
    page.getByRole("heading", { name: "Reports", level: 1 }),
  ).toBeVisible();

  const attention = page.locator("section", {
    hasText: "Stock attention report",
  });
  await expect(
    attention.getByRole("heading", { name: "Stock attention report" }),
  ).toBeVisible();
  await expect(attention.getByText("Paracetamol").first()).toBeVisible();
  await expect(
    attention.getByRole("button", { name: "Download CSV" }),
  ).toBeVisible();

  const movements = page.locator("section", {
    hasText: "Stock movements report",
  });
  await expect(
    movements.getByRole("heading", { name: "Stock movements report" }),
  ).toBeVisible();
  await expect(movements.getByText(/movements returned/i)).toBeVisible();
  await expect(
    movements.getByRole("button", { name: "Download CSV" }),
  ).toBeVisible();

  await expect(
    page.getByRole("columnheader", { name: /^reason$/i }),
  ).toHaveCount(0);
  await expect(page.getByRole("columnheader", { name: /^actor/i })).toHaveCount(
    0,
  );
  await expect(
    page.getByText(/SUT-P1|CRO-P1|PatientOne|PatientThree/),
  ).toHaveCount(0);
});
