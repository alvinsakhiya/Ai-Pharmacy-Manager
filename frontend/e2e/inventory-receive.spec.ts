import { expect, test } from "@playwright/test";

import { login, openFirstStockItemDetail, openInventory } from "./helpers";

test("admin can receive a new stock batch", async ({ page }) => {
  await login(page, "admin@demo.local");
  await openInventory(page);
  await openFirstStockItemDetail(page);

  await page.getByRole("button", { name: "Receive stock" }).click();
  await page.getByLabel("Batch number").fill("E2E-RECEIPT-001");
  await page.getByLabel("Expiry date").fill("2030-12-31");
  await page.getByLabel("Quantity").fill("10");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Receive stock" })
    .click();

  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByText("E2E-RECEIPT-001")).toBeVisible();
});
