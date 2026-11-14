import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end suite against a real Home Assistant instance.
 *
 * `setup.cjs` onboards the instance, registers the card resource and writes the dashboards; this
 * project only drives the UI. Start the instance with `docker compose -f test/e2e/compose.yaml up -d`
 * and run `node test/e2e/setup.cjs` first.
 */
export default defineConfig({
    testDir: "./specs",
    timeout: 90_000,
    expect: { timeout: 15_000 },
    fullyParallel: false,
    workers: 1,
    retries: 0,
    reporter: [["list"], ["html", { open: "never", outputFolder: "../artifacts/playwright-report" }]],
    outputDir: "../artifacts/test-results",
    use: {
        baseURL: process.env.E2E_HA_URL || "http://localhost:8123",
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
        video: "off",
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 900 },
    },
    projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
