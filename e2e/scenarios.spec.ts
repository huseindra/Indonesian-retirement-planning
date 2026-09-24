import { expect, test, type Page, type TestInfo } from "@playwright/test";

// Expected figures were computed independently (Python decimal, half-up
// rounding) — see src/lib/services/scenarios.test.ts.

function testUser(testInfo: TestInfo) {
  return testInfo.project.name === "mobile" ? "e2e-mobile" : "e2e-desktop";
}

async function signIn(page: Page, username: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

const success = (page: Page) => page.getByTestId("success-message");

/** The comparison is a table on wide screens and cards on phones. */
function comparison(page: Page, isMobile: boolean) {
  return page.getByTestId(isMobile ? "comparison-cards" : "comparison-table").first();
}

async function deleteProfileIfAny(page: Page) {
  await page.goto("/financial-profile");
  if (await page.getByRole("button", { name: "Delete profile" }).isVisible()) {
    await page.getByRole("button", { name: "Delete profile" }).click();
    await page.getByRole("button", { name: "Delete everything" }).click();
    await expect(success(page)).toContainText("deleted");
  }
}

test("demo user compares seeded scenarios side by side", async ({ page, isMobile }) => {
  await signIn(page, "demo", "demo123");
  await page.goto("/scenarios");

  await expect(page.getByText("describe sets of assumptions, not predictions")).toBeVisible();
  const view = comparison(page, isMobile);
  for (const name of ["Your current plan", "Base", "Conservative", "Optimistic", "Base + buy the target home"]) {
    await expect(view.getByRole("link", { name, exact: true })).toBeVisible();
  }
  await expect(view.getByText("Rp 4.070.546.103").first()).toBeVisible(); // current plan & Base
  await expect(view.getByText("Rp 7.749.908.675")).toBeVisible(); // Conservative required fund
  await expect(view.getByText("+Rp 958.797.887")).toBeVisible(); // Optimistic surplus
  await expect(view.getByText("Rp 1.914.422.344")).toBeVisible(); // home price at 40
  await expect(page.getByRole("group", { name: /Projected asset balances by age/ })).toBeVisible();
});

test("scenario journey keeps the baseline isolated until applied", async ({ page, isMobile }, testInfo) => {
  await signIn(page, testUser(testInfo), "e2e-pass-123");
  await deleteProfileIfAny(page);

  await test.step("without a profile the page explains what is needed", async () => {
    await page.goto("/scenarios");
    await expect(page.getByRole("heading", { name: "Complete your financial profile to compare scenarios" })).toBeVisible();
  });

  await test.step("empty state offers examples", async () => {
    await page.goto("/financial-profile/edit");
    await page.getByLabel("Current age").fill("30");
    await page.getByLabel("Target retirement age").fill("55");
    await page.getByLabel("Monthly income").fill("20000000");
    await page.getByLabel("Monthly living expenses").fill("8000000");
    await page.getByLabel("Living in a family-owned home").check();
    await page.getByRole("button", { name: "Create profile" }).click();
    await expect(success(page)).toContainText("created");
    await page.goto("/financial-profile/assets/new?group=cash");
    await page.getByLabel("Name", { exact: true }).fill("Savings");
    await page.getByLabel("Current balance").fill("500000000");
    await page.getByRole("button", { name: "Add asset" }).click();
    await expect(success(page)).toContainText("added");

    await page.goto("/scenarios");
    await expect(page.getByTestId("scenarios-empty")).toBeVisible();
    await page.getByRole("button", { name: "Add example scenarios" }).click();
    await expect(success(page)).toContainText("Base, Conservative and Optimistic");
    await expect(comparison(page, isMobile).getByRole("link", { name: "Conservative", exact: true })).toBeVisible();
  });

  const baselineBefore = await test.step("record the baseline", async () => {
    await page.goto("/retirement-plan");
    return page.getByTestId("required-fund").textContent();
  });

  await test.step("create validates, then saves a scenario", async () => {
    await page.goto("/scenarios/new");
    await expect(page.getByText("Leave blank to use your plan: 55.")).toBeVisible();
    await page.getByLabel("Name").fill("Retire early");
    await page.getByLabel("Target retirement age").fill("25");
    await page.getByLabel("Annual inflation").fill("45");
    await page.getByRole("button", { name: "Create scenario" }).click();
    await expect(page.locator("#retirementAge-error")).toContainText("current age (30)");
    await expect(page.locator("#inflationBps-error")).toContainText("between 0% and 30%");
    await expect(page.getByLabel("Name")).toHaveValue("Retire early");

    await page.getByLabel("Target retirement age").fill("50");
    await page.getByLabel("Annual inflation").fill("4");
    await page.getByRole("button", { name: "Create scenario" }).click();
    await expect(success(page)).toContainText("Scenario created");
    await expect(page.getByRole("heading", { name: "Retire early", level: 1 })).toBeVisible();
    const assumptions = page.getByTestId("scenario-assumptions");
    await expect(assumptions.getByRole("row", { name: /Target retirement age/ })).toContainText("50");
    await expect(assumptions.getByRole("row", { name: /Target retirement age/ })).toContainText("Changed");
    await expect(assumptions.getByRole("row", { name: /Expected investment return/ })).not.toContainText("Changed");
  });

  await test.step("editing recalculates without touching the baseline", async () => {
    await page.getByRole("link", { name: "Edit", exact: true }).click();
    await expect(page.getByLabel("Target retirement age")).toHaveValue("50");
    await page.getByLabel("Expected investment return").fill("9");
    await page.getByRole("button", { name: "Save & recalculate" }).click();
    await expect(success(page)).toContainText("Your baseline plan was not changed");
    await expect(page.getByTestId("scenario-assumptions").getByRole("row", { name: /Expected investment return/ })).toContainText("9,00%");

    await page.goto("/retirement-plan");
    await expect(page.getByTestId("required-fund")).toHaveText(baselineBefore!);
    await expect(page.getByTestId("years-to-retirement")).toHaveText("25 years");
  });

  await test.step("duplicate and delete with confirmation", async () => {
    await page.goto("/scenarios");
    await page.getByRole("button", { name: "Duplicate Retire early" }).click();
    await expect(success(page)).toContainText("duplicated");
    await expect(page.getByLabel("Name")).toHaveValue("Copy of Retire early");

    await page.goto("/scenarios");
    await page.getByRole("button", { name: "Delete Copy of Retire early" }).click();
    const dialog = page.getByRole("dialog", { name: "Delete “Copy of Retire early”?" });
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    await page.getByRole("button", { name: "Delete Copy of Retire early" }).click();
    await dialog.getByRole("button", { name: "Delete" }).click();
    await expect(success(page)).toContainText("Scenario deleted");
    await expect(page.getByRole("link", { name: "Copy of Retire early" })).toHaveCount(0);
  });

  await test.step("an inconsistent scenario shows a calculation error", async () => {
    await page.goto("/scenarios/new");
    await page.getByLabel("Name").fill("Home after retiring");
    await page.getByLabel("Include a target property purchase").check();
    await page.getByLabel("Property price today").fill("800000000");
    await page.getByLabel("Property purchase age").fill("60");
    await page.getByRole("button", { name: "Create scenario" }).click();
    await expect(page.getByTestId("scenario-error")).toContainText("purchase age (60)");
    await page.goto("/scenarios");
    await expect(page.getByText("Needs attention")).toBeVisible();
  });

  await test.step("applying requires explicit selection and confirmation", async () => {
    await page.goto("/scenarios");
    await page.getByRole("link", { name: "Retire early", exact: true }).first().click();
    await page.getByRole("checkbox", { name: /Inflation → Economic assumptions/ }).check();
    await page.getByRole("button", { name: "Apply selected to my plan" }).click();
    await expect(page.getByText("Nothing was changed")).toBeVisible();

    await page.getByRole("checkbox", { name: /Inflation → Economic assumptions/ }).check();
    await page.getByRole("checkbox", { name: /I understand/ }).check();
    await page.getByRole("button", { name: "Apply selected to my plan" }).click();
    await expect(success(page)).toContainText("applied to your baseline plan");

    await page.goto("/living-costs");
    await expect(page.getByTestId("assumption-inflationBps")).toHaveText("4,00%");
    await expect(page.getByTestId("assumption-investmentReturnBps")).toHaveText("7,00%"); // not applied
    await page.goto("/retirement-plan");
    await expect(page.getByTestId("years-to-retirement")).toHaveText("25 years"); // retirement age not applied
  });

  await deleteProfileIfAny(page);
});
