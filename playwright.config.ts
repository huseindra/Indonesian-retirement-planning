import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const baseURL = `http://127.0.0.1:${PORT}`;

// Optional: point at a preinstalled Chromium instead of Playwright's own.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    launchOptions: { executablePath },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], launchOptions: { executablePath } } },
    { name: "mobile", use: { ...devices["Pixel 7"], launchOptions: { executablePath } } },
  ],
  webServer: {
    // A separate database keeps test sessions out of the dev database.
    command: `npm run build && npx next start -p ${PORT}`,
    url: `${baseURL}/login`,
    env: { DATABASE_PATH: "./data/e2e.db" },
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
