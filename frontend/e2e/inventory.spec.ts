import { expect, test, type Page } from "@playwright/test";

import {
  expectNavVisible,
  login,
  openFirstStockItemDetail,
  openInventory,
} from "./helpers";

async function openInventoryDetailForUser(page: Page, email: string) {
  await login(page, email);
  await expectNavVisible(page, ["Inventory"]);
  await openInventory(page);
  await openFirstStockItemDetail(page);
}

test("admin sees inventory action controls", async ({ page }) => {
  await openInventoryDetailForUser(page, "admin@demo.local");

  await expect(page.getByRole("button", { name: "Receive stock" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Adjust" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Count" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Transfer" }).first()).toBeVisible();
});

test("superintendent sees inventory action controls", async ({ page }) => {
  await openInventoryDetailForUser(page, "superintendent@demo.local");

  await expect(page.getByRole("button", { name: "Receive stock" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Adjust" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Count" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Transfer" }).first()).toBeVisible();
});

test("stock employee sees inventory action controls", async ({ page }) => {
  await openInventoryDetailForUser(page, "stock@demo.local");

  await expect(page.getByRole("button", { name: "Receive stock" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Adjust" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Count" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Transfer" }).first()).toBeVisible();
});

test("pharmacist sees stock manage actions but not transfer", async ({ page }) => {
  await openInventoryDetailForUser(page, "pharmacist@demo.local");

  await expect(page.getByRole("button", { name: "Receive stock" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Adjust" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Count" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Transfer" })).toHaveCount(0);
});

test("dispenser sees inventory without action controls", async ({ page }) => {
  await openInventoryDetailForUser(page, "dispenser@demo.local");

  await expect(
    page.getByRole("columnheader", { name: "Actions" }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Receive stock" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Adjust" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Count" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Transfer" })).toHaveCount(0);
});
