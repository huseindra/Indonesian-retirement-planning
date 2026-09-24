import { expect, test, type Page, type TestInfo } from "@playwright/test";

// Expected figures were computed independently (Python decimal, half-up
// rounding) — see src/lib/projection/retirement.test.ts.

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

async function deleteProfileIfAny(page: Page) {
  await page.goto("/financial-profile");
  if (await page.getByRole("button", { name: "Delete profile" }).isVisible()) {
    await page.getByRole("button", { name: "Delete profile" }).click();
    await page.getByRole("button", { name: "Delete everything" }).click();
    await expect(success(page)).toContainText("deleted");
  }
}

test("demo user sees the retirement plan with explainable figures", async ({ page }) => {
  await signIn(page, "demo", "demo123");
  await page.goto("/retirement-plan");

  await expect(page.getByTestId("years-to-retirement")).toHaveText("23 years");
  await expect(page.getByTestId("annual-cost-at-retirement")).toHaveText("Rp 236.830.380");
  await expect(page.getByTestId("required-fund")).toHaveText("Rp 4.070.546.103");
  await expect(page.getByTestId("projected-assets")).toHaveText("Rp 2.877.738.653");
  await expect(page.getByTestId("gap-amount")).toHaveText("−Rp 1.192.807.450");
  await expect(page.getByTestId("readiness-summary")).toContainText("70,7% funded");
  await expect(page.getByTestId("funds-last")).toContainText("run out at age 73");
  await expect(page.getByTestId("saving-needed")).toContainText("Rp 1.860.176");

  await expect(page.getByRole("heading", { name: "Current financial position" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Projected future position" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "How this was calculated" })).toBeVisible();
  await expect(page.getByText("estimates from fixed formulas")).toBeVisible();

  const chart = page.getByRole("group", { name: /Projected assets grow/ });
  await chart.focus();
  await page.keyboard.press("End");
  await expect(chart.getByText("Rp 4.070.546.103")).toBeVisible();
});

test("retirement plan journey: empty, no assets, validation, recalculation and error states", async ({ page }, testInfo) => {
  await signIn(page, testUser(testInfo), "e2e-pass-123");
  await deleteProfileIfAny(page);

  await test.step("incomplete profile is handled gracefully", async () => {
    await page.goto("/retirement-plan");
    await expect(page.getByRole("heading", { name: "Complete your financial profile to see your plan" })).toBeVisible();
    await page.goto("/dashboard");
    await expect(page.getByRole("region", { name: "Retirement readiness" })).toContainText(
      "Complete your financial profile",
    );
  });

  await test.step("a profile without assets shows a full shortfall and a hint", async () => {
    await page.goto("/financial-profile/edit");
    await page.getByLabel("Current age").fill("30");
    await page.getByLabel("Target retirement age").fill("55");
    await page.getByLabel("Monthly income").fill("20000000");
    await page.getByLabel("Monthly living expenses").fill("8000000");
    await page.getByLabel("Living in a family-owned home").check();
    await page.getByRole("button", { name: "Create profile" }).click();
    await expect(success(page)).toContainText("created");

    await page.goto("/retirement-plan");
    await expect(page.getByText("You haven't recorded any savings")).toBeVisible();
    await expect(page.getByTestId("projected-assets")).toHaveText("Rp 0");
    await expect(page.getByTestId("readiness-summary")).toContainText("Projected shortfall");
  });

  await test.step("the plan-until age is validated and saved", async () => {
    await page.getByLabel("Plan until age").fill("50");
    await page.getByRole("button", { name: "Save & recalculate" }).click();
    await expect(page.locator("#planUntilAge-error")).toHaveText("Must be later than your target retirement age (55).");
    await expect(page.getByLabel("Plan until age")).toHaveValue("50");

    await page.getByLabel("Plan until age").fill("90");
    await page.getByRole("button", { name: "Save & recalculate" }).click();
    await expect(success(page)).toContainText("recalculated");
    await expect(page.getByTestId("required-fund")).toBeVisible();
    await expect(page.getByText("To fund ages 55–90")).toBeVisible();
  });

  await test.step("an inconsistent profile shows a calculation error", async () => {
    await page.goto("/financial-profile/edit");
    await page.getByLabel("Target retirement age").fill("95");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(success(page)).toContainText("updated");

    await page.goto("/retirement-plan");
    await expect(page.getByTestId("calculation-error")).toContainText("plan-until age (90)");
    await page.goto("/dashboard");
    await expect(page.getByRole("region", { name: "Retirement readiness" })).toContainText(
      "couldn't calculate",
    );
  });

  await deleteProfileIfAny(page);
});
