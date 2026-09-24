import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, username = "demo", password = "demo123") {
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("unauthenticated visitors are sent to the login page", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("invalid credentials show an error and keep the user on the login page", async ({ page }) => {
  await page.goto("/login");
  await signIn(page, "demo", "wrong-password");

  await expect(page.locator("#login-error")).toHaveText(/Incorrect username or password/);
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByLabel("Username")).toHaveValue("demo");
  await expect(page.getByLabel("Password")).toHaveValue("");
});

test("empty submission asks for both fields", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator("#login-error")).toHaveText(/enter both your username and password/);
});

test("demo user can sign in, see the dashboard and sign out", async ({ page, isMobile }) => {
  await page.goto("/login");
  await signIn(page);

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: /Selamat datang, Andi/ })).toBeVisible();

  const summary = page.getByRole("region", { name: "Summary" });
  await expect(summary.getByRole("heading", { name: "Current Age" })).toBeVisible();
  await expect(summary.getByRole("heading", { name: "Target Retirement Age" })).toBeVisible();
  await expect(summary.getByText("58 years")).toBeVisible();
  await expect(summary.getByText("Rp 469.750.000")).toBeVisible();
  await expect(summary.getByText("Not yet calculated")).toBeVisible();
  await expect(page.getByRole("img", { name: /future retirement projection chart/ })).toBeVisible();
  await expect(page.getByText("JHT – BPJS Ketenagakerjaan")).toBeVisible();

  // Session survives a reload because it is stored server-side.
  await page.reload();
  await expect(page).toHaveURL(/\/dashboard$/);

  if (isMobile) {
    await page.getByRole("button", { name: "Open navigation menu" }).click();
    await expect(page.getByRole("dialog", { name: "Navigation" })).toBeVisible();
  }
  const nav = page.getByRole("navigation", { name: "Main" }).locator("visible=true");
  for (const label of ["Dashboard", "Financial Profile", "Living Costs", "Retirement Plan", "Scenarios"]) {
    await expect(nav.getByRole("link", { name: new RegExp(label) })).toBeVisible();
  }
  await expect(nav.getByRole("link", { name: /Dashboard/ })).toHaveAttribute("aria-current", "page");

  await page.getByRole("button", { name: "Sign out" }).locator("visible=true").click();
  await expect(page).toHaveURL(/\/login\?signedOut=1$/);
  await expect(page.getByRole("status")).toHaveText(/You have been signed out/);

  // The old session no longer grants access.
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("upcoming sections show a placeholder", async ({ page }) => {
  await page.goto("/login?next=%2Fscenarios");
  await signIn(page);
  await expect(page).toHaveURL(/\/scenarios$/);
  await expect(page.getByRole("heading", { name: "Scenarios", level: 1 })).toBeVisible();
  await expect(page.getByText("This section is on its way")).toBeVisible();
});

test("an already signed-in user visiting /login goes to the dashboard", async ({ page }) => {
  await page.goto("/login");
  await signIn(page);
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/login");
  await expect(page).toHaveURL(/\/dashboard$/);
});
