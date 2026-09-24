import { expect, test, type Page, type TestInfo } from "@playwright/test";

// The e2e server runs with AI_PROVIDER=mock (see playwright.config.ts), so
// generation is real (goes through the actual service and provider
// interfaces) but deterministic and network-free. Expected demo figures
// were computed independently — see src/lib/ai/signals.test.ts.

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
const openInsights = (page: Page) => page.getByTestId("insight-card").filter({ hasNot: page.locator('[data-status="rejected"], [data-status="dismissed"]') });

async function deleteProfileIfAny(page: Page) {
  await page.goto("/financial-profile");
  if (await page.getByRole("button", { name: "Delete profile" }).isVisible()) {
    await page.getByRole("button", { name: "Delete profile" }).click();
    await page.getByRole("button", { name: "Delete everything" }).click();
    await expect(success(page)).toContainText("deleted");
  }
}

test("demo user generates insights citing the exact figures from their plan", async ({ page }) => {
  await signIn(page, "demo", "demo123");
  await page.goto("/ai-insights");

  await expect(page.getByText("nothing here changes your saved plan unless you accept and apply it yourself")).toBeVisible();
  await page.getByRole("button", { name: /Generate( new)? insights/ }).click();
  await expect(success(page)).toContainText(/Generated \d+ new insight/);

  const fundingGap = page.getByTestId("insight-card").filter({ hasText: "Funding gap" }).first();
  await expect(fundingGap).toContainText("Rp 1.192.807.450");
  await expect(fundingGap.getByText("AI interpretation")).toBeVisible();
  await expect(fundingGap.getByText("From your calculations:")).toBeVisible();
  await expect(fundingGap.getByRole("button", { name: "Accept" })).toBeVisible();
  await expect(fundingGap.getByRole("button", { name: "Edit" })).toBeVisible();
  await expect(fundingGap.getByRole("button", { name: "Reject" })).toBeVisible();
  await expect(fundingGap.getByRole("button", { name: "Dismiss" })).toBeVisible();

  const propertyCard = page.getByTestId("insight-card").filter({ hasText: "Property purchase" }).first();
  await expect(propertyCard).toContainText("3-bedroom landed house in Tangerang Selatan");
});

test("full journey: generate, edit, reject, dismiss, accept and apply — never touching the plan except via a confirmed apply", async ({ page }, testInfo) => {
  const user = testUser(testInfo);
  await signIn(page, user, "e2e-pass-123");
  await deleteProfileIfAny(page);

  await test.step("insights need a financial profile first", async () => {
    await page.goto("/ai-insights");
    await expect(page.getByRole("heading", { name: "Complete your financial profile to get AI Insights" })).toBeVisible();
  });

  await test.step("create a profile with a likely shortfall", async () => {
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
    await page.getByLabel("Current balance").fill("300000000");
    await page.getByRole("button", { name: "Add asset" }).click();
    await expect(success(page)).toContainText("added");
  });

  let retirementAgeBefore: string | null;
  await test.step("record the baseline retirement plan before touching any insight", async () => {
    await page.goto("/retirement-plan");
    retirementAgeBefore = await page.getByTestId("years-to-retirement").textContent();
  });

  await test.step("generate insights", async () => {
    await page.goto("/ai-insights");
    await page.getByRole("button", { name: /Generate( new)? insights/ }).click();
    await expect(success(page)).toContainText(/Generated \d+ new insight/);
    await expect(openInsights(page).first()).toBeVisible();
  });

  await test.step("editing changes only the proposed values, never the saved plan", async () => {
    const card = page.getByTestId("insight-card").filter({ hasText: "Delaying retirement" }).first();
    await card.getByRole("button", { name: "Edit" }).click();
    await card.getByLabel("Action summary").fill("AI test: retire later");
    await card.getByLabel("Scenario name").fill("AI test: retire later");
    await card.getByLabel("Retirement age", { exact: false }).first().fill("60");
    await card.getByRole("button", { name: "Save edit" }).click();
    await expect(success(page)).toContainText("Your edit was saved. Nothing in your saved plan has changed yet.");

    await page.goto("/retirement-plan");
    await expect(page.getByTestId("years-to-retirement")).toHaveText(retirementAgeBefore!);
  });

  await test.step("reject one suggestion and dismiss another — both terminal, neither writes anything", async () => {
    await page.goto("/ai-insights");
    const rejectTarget = page.getByTestId("insight-card").filter({ hasText: "Increasing savings" }).first();
    await rejectTarget.getByRole("button", { name: "Reject" }).click();
    await expect(success(page)).toContainText("Suggestion rejected");

    const dismissTarget = page.getByTestId("insight-card").filter({ hasText: "Scenario comparison" }).first();
    if (await dismissTarget.isVisible()) {
      await dismissTarget.getByRole("button", { name: "Dismiss" }).click();
      await expect(success(page)).toContainText("Suggestion dismissed");
    }
  });

  await test.step("accept reveals Apply with an exact diff, which requires confirmation", async () => {
    const card = page.getByTestId("insight-card").filter({ hasText: "AI test: retire later" }).first();
    await card.getByRole("button", { name: "Accept" }).click();
    await expect(success(page)).toContainText("Suggestion accepted. Nothing in your saved plan has changed yet.");

    const accepted = page.getByTestId("insight-card").filter({ hasText: "AI test: retire later" }).first();
    await expect(accepted.getByText("Review before applying")).toBeVisible();
    await expect(accepted.getByText("New scenario name")).toBeVisible();
    await expect(accepted.getByText("AI test: retire later").first()).toBeVisible();

    // Applying without confirming changes nothing.
    await accepted.getByRole("button", { name: "Apply to my plan" }).click();
    await expect(page.getByText("Nothing was changed. Confirm to apply this suggestion to your plan.")).toBeVisible();

    await page.goto("/scenarios");
    await expect(page.getByRole("link", { name: "AI test: retire later", exact: true })).toHaveCount(0);
  });

  await test.step("confirmed apply creates the scenario and marks the insight applied", async () => {
    await page.goto("/ai-insights");
    const accepted = page.getByTestId("insight-card").filter({ hasText: "AI test: retire later" }).first();
    await accepted.getByRole("checkbox", { name: /I understand this will create a new scenario/ }).check();
    await accepted.getByRole("button", { name: "Apply to my plan" }).click();
    await expect(success(page)).toContainText("Applied to your saved plan.");

    // Applied insights move into the collapsed History section.
    await page.getByText(/^History \(\d+\)$/).click();
    const applied = page.getByTestId("insight-card").filter({ hasText: "AI test: retire later" }).first();
    await expect(applied).toContainText("Applied to your plan");
    await applied.getByRole("link", { name: "View the new scenario" }).click();
    await expect(page.getByRole("heading", { name: "AI test: retire later", level: 1 })).toBeVisible();
    const assumptions = page.getByTestId("scenario-assumptions");
    await expect(assumptions.getByRole("row", { name: /Target retirement age/ })).toContainText("60");

    // Applying again is refused — it already happened once.
    await page.goto("/ai-insights");
    await page.getByText(/^History \(\d+\)$/).click();
    await expect(page.getByTestId("insight-card").filter({ hasText: "AI test: retire later" }).first()).not.toContainText("Apply to my plan");
  });

  await test.step("the baseline plan was never touched by generate, edit, reject, dismiss or accept", async () => {
    await page.goto("/retirement-plan");
    await expect(page.getByTestId("years-to-retirement")).toHaveText(retirementAgeBefore!);
  });

  await test.step("clean up the scenario this test created", async () => {
    // Scenarios are independent of the financial profile (not cascaded by
    // "Delete everything" below), so remove it explicitly to keep this
    // user's data clean for other specs.
    await page.goto("/scenarios");
    await page.getByRole("button", { name: "Delete AI test: retire later" }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(success(page)).toContainText("deleted");
  });

  await deleteProfileIfAny(page);
});
