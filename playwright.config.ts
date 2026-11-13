import { defineConfig } from "@playwright/test";

/**
 * Visual regression harness for the built card bundle.
 *
 * Kept out of the Vitest run and out of the main Build gate: `npm test` stays fast, and this suite
 * only runs on `workflow_dispatch` or on pull requests labelled `visual` (see .github/workflows/visual.yml).
 *
 * Baselines are Chromium-only and must be regenerated inside the same Playwright image the workflow
 * uses, never on macOS:
 *
 *   docker run --rm -v "$PWD":/work -w /work mcr.microsoft.com/playwright:v1.65.0-jammy \
 *       npx playwright test --update-snapshots
 */
export default defineConfig({
    testDir: "test/visual",
    testMatch: "**/*.spec.ts",
    outputDir: "test-results",
    snapshotPathTemplate: "{testDir}/__screenshots__/{testFileName}/{arg}{ext}",
    fullyParallel: false,
    workers: 1,
    forbidOnly: !!process.env.CI,
    retries: 0,
    timeout: 30_000,
    reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
    use: {
        baseURL: "http://127.0.0.1:4173",
        browserName: "chromium",
        viewport: { width: 800, height: 700 },
        deviceScaleFactor: 1,
        colorScheme: "light",
        locale: "en-US",
        timezoneId: "UTC",
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
    },
    expect: {
        toHaveScreenshot: {
            // About 0.1 % of the pixels may differ, and only where the colour distance is small
            // enough to be antialiasing rather than a moved overlay.
            maxDiffPixelRatio: 0.001,
            animations: "disabled",
            caret: "hide",
        },
    },
    projects: [{ name: "chromium" }],
    webServer: {
        command: "node test/visual/server.cjs",
        url: "http://127.0.0.1:4173/",
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
        env: { VISUAL_PORT: "4173" },
    },
});
