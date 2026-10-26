import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT ?? 3100);

/**
 * iPad is the primary target. WebKit projects mirror iPadOS Safari and run in CI;
 * the Chromium project emulates the same viewport with touch for quick local runs.
 */
export default defineConfig({
  testDir: "e2e",
  // Each test runs a full simulation + WebGL; serial runs keep timings stable.
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [
    { name: "ipad-pro-landscape", use: { ...devices["iPad Pro 11 landscape"] } },
    { name: "ipad-portrait", use: { ...devices["iPad (gen 7)"] } },
    {
      name: "chromium-ipad",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1180, height: 820 },
        hasTouch: true,
        isMobile: false,
        launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
      },
    },
  ],
  webServer: {
    command: `pnpm start -p ${PORT}`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
