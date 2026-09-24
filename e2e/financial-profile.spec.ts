import { expect, test, type Page, type TestInfo } from "@playwright/test";

// Each viewport project gets its own user so runs never share data, and the
// demo account used by other specs is left untouched.
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

/** Leaves the user with no financial profile, whatever a previous run did. */
async function resetProfile(page: Page) {
  await page.goto("/financial-profile");
  const deleteButton = page.getByRole("button", { name: "Delete profile" });
  if (await deleteButton.isVisible()) {
    await deleteButton.click();
    await page.getByRole("button", { name: "Delete everything" }).click();
    await expect(page.getByTestId("success-message")).toContainText("deleted");
  }
}

const success = (page: Page) => page.getByTestId("success-message");

test("financial profile create, view, edit and delete journey", async ({ page }, testInfo) => {
  await signIn(page, testUser(testInfo));
  await resetProfile(page);

  await test.step("dashboard guides the user instead of showing figures", async () => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Complete your financial profile" })).toBeVisible();
    const summary = page.getByRole("region", { name: "Summary" });
    // All four cards, including the Stage 4 retirement fund card.
    await expect(summary.getByText("Not set")).toHaveCount(4);
    await expect(summary.getByText(/Rp \d/)).toHaveCount(0);
  });

  await test.step("validation errors are shown and values are kept", async () => {
    await page.getByRole("link", { name: "Start profile" }).click();
    await expect(page).toHaveURL(/\/financial-profile\/edit$/);
    await expect(page.getByRole("heading", { name: "Create your financial profile" })).toBeVisible();

    await page.getByRole("button", { name: "Create profile" }).click();
    const summary = page.locator("#profile-form-error");
    await expect(summary).toContainText("Please correct the highlighted fields");
    await expect(summary).toContainText("Enter your current age.");
    await expect(page.getByLabel("Current age")).toHaveAttribute("aria-invalid", "true");

    await page.getByLabel("Current age").fill("30");
    await page.getByLabel("Target retirement age").fill("25");
    await page.getByLabel("Monthly income").fill("15000000");
    await expect(page.getByLabel("Monthly income")).toHaveValue("15.000.000");
    await page.getByLabel("Monthly living expenses").fill("7000000");
    await page.getByLabel("I rent").check();
    await expect(page.getByRole("textbox", { name: "Monthly rent" })).toBeVisible();
    await page.getByRole("button", { name: "Create profile" }).click();

    await expect(summary).toContainText("Retirement age must be later than your current age.");
    await expect(summary).toContainText("Enter your monthly rent.");
    await expect(page.getByLabel("Current age")).toHaveValue("30");
    await expect(page.getByLabel("Monthly income")).toHaveValue("15.000.000");
    // Regression: the housing choice must survive a failed save.
    await expect(page.getByLabel("I rent")).toBeChecked();
  });

  await test.step("profile is created and shown", async () => {
    await page.getByLabel("Target retirement age").fill("55");
    await page.getByRole("textbox", { name: "Monthly rent" }).fill("3500000");
    await page.getByRole("button", { name: "Create profile" }).click();

    await expect(page).toHaveURL(/\/financial-profile\?status=profile-created$/);
    await expect(success(page)).toContainText("Your financial profile has been created");
    await expect(page.getByText("Rp 15.000.000")).toBeVisible();
    await expect(page.getByText("Rp 3.500.000")).toBeVisible();
    await expect(page.getByText("25 years", { exact: true })).toBeVisible();
  });

  await test.step("dashboard uses the persisted profile", async () => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Complete your financial profile" })).toHaveCount(0);
    const summary = page.getByRole("region", { name: "Summary" });
    await expect(summary.getByText("30 years")).toBeVisible();
    await expect(summary.getByText("55 years")).toBeVisible();
    await expect(summary.getByText("25 years from now")).toBeVisible();
    await expect(summary.getByRole("link", { name: /Record your savings/ })).toBeVisible();
    await expect(page.getByRole("region", { name: "Monthly cash flow" }).getByText("Rp 4.500.000")).toBeVisible();
  });

  await test.step("assets can be added", async () => {
    await page.goto("/financial-profile");
    await page.getByRole("link", { name: "Add asset" }).click();
    await page.getByLabel("Type").selectOption("bpjs_jht");
    await page.getByLabel("Name", { exact: true }).fill("JHT balance");
    await page.getByLabel("Current balance").fill("50000000");
    await page.getByRole("button", { name: "Add asset" }).click();
    await expect(success(page)).toHaveText("Asset record added.");

    // Group shortcut pre-selects the type.
    await page.getByRole("link", { name: "+ Add Cash & savings" }).click();
    await expect(page.getByLabel("Type")).toHaveValue("cash");
    await page.getByRole("button", { name: "Add asset" }).click();
    await expect(page.locator("#name-error")).toContainText("Give this record a name");
    await page.getByLabel("Name", { exact: true }).fill("Tabungan");
    await page.getByLabel("Current balance").fill("20000000");
    await page.getByRole("button", { name: "Add asset" }).click();
    await expect(success(page)).toHaveText("Asset record added.");

    const jht = page.getByRole("region", { name: "JHT – BPJS Ketenagakerjaan" });
    await expect(jht.getByText("JHT balance", { exact: true })).toBeVisible();
    await expect(jht.getByText("Rp 50.000.000").first()).toBeVisible();
  });

  await test.step("an asset can be edited", async () => {
    await page.getByRole("link", { name: "Edit Tabungan" }).click();
    await expect(page.getByLabel("Current balance")).toHaveValue("20.000.000");
    await page.getByLabel("Current balance").fill("25000000");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(success(page)).toHaveText("Asset record updated.");
    await expect(page.getByRole("region", { name: "Cash & savings" }).getByText("Rp 25.000.000").first()).toBeVisible();
  });

  await test.step("dashboard totals reflect the assets", async () => {
    await page.goto("/dashboard");
    const summary = page.getByRole("region", { name: "Summary" });
    await expect(summary.getByText("Rp 25.000.000")).toBeVisible();
    await expect(summary.getByText("+ Rp 50 jt in JHT & pension funds")).toBeVisible();
  });

  await test.step("deleting an asset asks for confirmation", async () => {
    await page.goto("/financial-profile");
    await page.getByRole("button", { name: "Delete Tabungan" }).click();
    const dialog = page.getByRole("dialog", { name: "Delete “Tabungan”?" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText("Tabungan", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Delete Tabungan" }).click();
    await dialog.getByRole("button", { name: "Delete" }).click();
    await expect(success(page)).toHaveText("Asset record deleted.");
    await expect(page.getByRole("link", { name: "Edit Tabungan" })).toHaveCount(0);
  });

  await test.step("profile can be edited", async () => {
    await page.getByRole("link", { name: "Edit profile" }).click();
    await expect(page.getByLabel("Current age")).toHaveValue("30");
    await expect(page.getByLabel("I rent")).toBeChecked();
    await page.getByLabel("I own my home").check();
    await expect(page.getByRole("textbox", { name: "Monthly rent" })).toHaveCount(0);
    await page.getByLabel("Current property value").fill("1200000000");
    await page.getByRole("button", { name: "Save changes" }).click();

    await expect(success(page)).toHaveText("Your financial profile has been updated.");
    await expect(page.getByText("Rp 1.200.000.000")).toBeVisible();
    await expect(page.getByText("Monthly rent")).toHaveCount(0);
  });

  await test.step("profile can be deleted after confirmation", async () => {
    await page.getByRole("button", { name: "Delete profile" }).click();
    const dialog = page.getByRole("dialog", { name: "Delete your financial profile?" });
    await expect(dialog).toContainText("1 record");
    await dialog.getByRole("button", { name: "Delete everything" }).click();

    await expect(success(page)).toContainText("have been deleted");
    await expect(page.getByRole("heading", { name: /haven't created a financial profile/ })).toBeVisible();

    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Complete your financial profile" })).toBeVisible();
  });
});

test("adding an asset without a profile redirects to profile creation", async ({ page }, testInfo) => {
  await signIn(page, testUser(testInfo));
  await resetProfile(page);
  await page.goto("/financial-profile/assets/new");
  await expect(page).toHaveURL(/\/financial-profile\/edit$/);
});

test("an unknown or foreign asset shows a not-found state", async ({ page }, testInfo) => {
  await signIn(page, testUser(testInfo));
  // Asset id 1 belongs to the demo user.
  for (const id of ["1", "999999", "abc"]) {
    await page.goto(`/financial-profile/assets/${id}/edit`);
    await expect(page.getByRole("heading", { name: "Record not found" })).toBeVisible();
  }
});
