import { expect, test, type Page, type TestInfo } from "@playwright/test";

// Expected figures were computed independently (Python decimal, half-up
// rounding) — see src/lib/projection/projection.test.ts for the formulas.

function testUser(testInfo: TestInfo) {
  return testInfo.project.name === "mobile" ? "e2e-mobile" : "e2e-desktop";
}

async function signIn(page: Page, username: string) {
  await page.goto("/login");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill("e2e-pass-123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

const success = (page: Page) => page.getByTestId("success-message");

/** Leaves the user with no profile, no property and default assumptions. */
async function resetUser(page: Page) {
  await page.goto("/living-costs");
  if (await page.getByRole("button", { name: "Delete", exact: true }).isVisible()) {
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(success(page)).toHaveText("Target property deleted.");
  }
  await page.goto("/living-costs/assumptions");
  if (await page.getByRole("button", { name: "Reset to defaults" }).isVisible()) {
    await page.getByRole("button", { name: "Reset to defaults" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Reset" }).click();
    await expect(success(page)).toContainText("reset to the demo defaults");
  }
  await page.goto("/financial-profile");
  if (await page.getByRole("button", { name: "Delete profile" }).isVisible()) {
    await page.getByRole("button", { name: "Delete profile" }).click();
    await page.getByRole("button", { name: "Delete everything" }).click();
    await expect(success(page)).toContainText("deleted");
  }
}

test("demo user sees persisted projections", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill("demo");
  await page.getByLabel("Password").fill("demo123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/living-costs");

  await expect(page.getByTestId("assumption-inflationBps")).toHaveText("3,00%");
  await expect(page.getByTestId("retirement-monthly")).toHaveText("Rp 19.735.865");
  await expect(page.getByTestId("retirement-annual")).toHaveText("Rp 236.830.380");
  await expect(page.getByTestId("property-future")).toHaveText("Rp 1.914.422.344");
  await expect(page.getByTestId("property-real")).toHaveText("Rp 1.651.397.531");
  await expect(page.getByTestId("purchasing-power")).toContainText("Rp 506.692");
});

test("living costs and housing projection journey", async ({ page }, testInfo) => {
  await signIn(page, testUser(testInfo));
  await resetUser(page);

  await test.step("empty states guide the user", async () => {
    await page.goto("/living-costs");
    await expect(page.getByText("Demo defaults", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Add your financial profile to project living costs" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "No target property yet" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Add target property" })).toHaveCount(0);

    // Without a profile the property form sends users to create one.
    await page.goto("/living-costs/property");
    await expect(page).toHaveURL(/\/financial-profile\/edit$/);
  });

  await test.step("living costs are projected from the saved profile", async () => {
    await page.getByLabel("Current age").fill("30");
    await page.getByLabel("Target retirement age").fill("55");
    await page.getByLabel("Monthly income").fill("20000000");
    await page.getByLabel("Monthly living expenses").fill("8000000");
    await page.getByLabel("Living in a family-owned home").check();
    await page.getByRole("button", { name: "Create profile" }).click();
    await expect(success(page)).toContainText("created");

    await page.goto("/living-costs");
    await expect(page.getByTestId("current-monthly")).toHaveText("Rp 8.000.000");
    await expect(page.getByTestId("current-annual")).toHaveText("Rp 96.000.000");
    await expect(page.getByTestId("retirement-monthly")).toHaveText("Rp 16.750.223");
    await expect(page.getByTestId("retirement-annual")).toHaveText("Rp 201.002.676");
    await expect(page.getByText("Rp 8.000.000 × (1 + 3,00%)")).toBeVisible();
  });

  await test.step("assumptions are validated, saved and applied", async () => {
    await page.getByRole("link", { name: "Edit assumptions" }).click();
    await page.getByLabel("General inflation").fill("45");
    await page.getByLabel("Investment return").fill("abc");
    await page.getByRole("button", { name: "Save assumptions" }).click();
    await expect(page.locator("#inflationBps-error")).toHaveText("General inflation must be between 0% and 30%.");
    await expect(page.locator("#investmentReturnBps-error")).toContainText("as a percentage");
    await expect(page.getByLabel("General inflation")).toHaveValue("45");

    await page.getByLabel("General inflation").fill("4");
    await page.getByLabel("Housing-price growth").fill("6");
    await page.getByLabel("Investment return").fill("8,5");
    await page.getByRole("button", { name: "Save assumptions" }).click();

    await expect(success(page)).toContainText("Economic assumptions saved");
    await expect(page.getByText("Demo defaults", { exact: true })).toHaveCount(0);
    await expect(page.getByTestId("assumption-investmentReturnBps")).toHaveText("8,50%");
    await expect(page.getByTestId("retirement-monthly")).toHaveText("Rp 21.326.691");
    await expect(page.getByTestId("retirement-annual")).toHaveText("Rp 255.920.292");
  });

  await test.step("a target property is validated and projected", async () => {
    await page.getByRole("link", { name: "Add target property" }).click();
    await expect(page.getByText("You are 30 now.")).toBeVisible();
    await page.getByLabel("Description").fill("Apartment in Bekasi");
    await page.getByLabel("Current property price").fill("900000000");
    await page.getByLabel("Expected purchase age").fill("25");
    await page.getByRole("button", { name: "Add property" }).click();
    await expect(page.locator("#purchaseAge-error")).toContainText("earlier than your current age (30)");

    await page.getByLabel("Expected purchase age").fill("35");
    await page.getByRole("button", { name: "Add property" }).click();
    await expect(success(page)).toHaveText("Target property added.");

    await expect(page.getByText("from your housing-growth assumption")).toBeVisible();
    await expect(page.getByTestId("property-current")).toHaveText("Rp 900.000.000");
    await expect(page.getByTestId("property-future")).toHaveText("Rp 1.204.403.020");
    await expect(page.getByTestId("property-increase")).toHaveText("+Rp 304.403.020");
    await expect(page.getByTestId("property-real")).toHaveText("Rp 989.931.490");

    const explanation = page.getByTestId("housing-explanation");
    await expect(explanation).toContainText("Price growth (nominal)");
    await expect(explanation).toContainText("Money buys less (purchasing power)");
    await expect(explanation).toContainText("more than today in real terms");
    await expect(explanation).not.toContainText("depreciat");
  });

  await test.step("chart values are available as a table and via the keyboard", async () => {
    const housing = page.getByRole("region", { name: "Housing projection" });
    await housing.getByText("Show data table").click();
    const lastRow = housing.getByRole("row", { name: /Age 35/ });
    await expect(lastRow).toContainText("Rp 1.204.403.020");
    await expect(lastRow).toContainText("Rp 989.931.490");

    const chart = housing.getByRole("group", { name: /Property price rising/ });
    await chart.focus();
    await page.keyboard.press("ArrowLeft");
    await expect(chart.getByText("Age 34 · in 4 years")).toBeVisible();
  });

  await test.step("a property-specific rate below inflation shows a real-terms decline", async () => {
    await page.getByRole("link", { name: "Edit property" }).click();
    await expect(page.getByLabel("Current property price")).toHaveValue("900.000.000");
    await page.getByLabel("Expected annual property-price growth").fill("2");
    await page.getByRole("button", { name: "Save changes" }).click();

    await expect(success(page)).toHaveText("Target property updated.");
    await expect(page.getByText("set for this property")).toBeVisible();
    await expect(page.getByTestId("property-future")).toHaveText("Rp 993.672.723");
    await expect(page.getByTestId("property-real")).toHaveText("Rp 816.726.546");
    await expect(page.getByTestId("housing-explanation")).toContainText("less than today in real terms");
    await expect(page.getByTestId("housing-explanation")).toContainText("price tag still rises");
  });

  await test.step("deleting the property asks for confirmation", async () => {
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Delete your target property?" });
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByTestId("property-future")).toBeVisible();

    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await dialog.getByRole("button", { name: "Delete" }).click();
    await expect(success(page)).toHaveText("Target property deleted.");
    await expect(page.getByRole("heading", { name: "No target property yet" })).toBeVisible();
  });

  await test.step("assumptions can be reset to the defaults", async () => {
    await page.getByRole("link", { name: "Edit assumptions" }).click();
    await page.getByRole("button", { name: "Reset to defaults" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Reset" }).click();
    await expect(success(page)).toContainText("reset to the demo defaults");
    await expect(page.getByText("Demo defaults", { exact: true })).toBeVisible();
    await expect(page.getByTestId("retirement-monthly")).toHaveText("Rp 16.750.223");
  });
});
