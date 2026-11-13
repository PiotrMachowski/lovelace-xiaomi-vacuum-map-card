import { defineConfig } from "@playwright/test";

/**
 * Visual regression harness for the built card bundle.
 *
 * Kept out of the Vitest run and out of the main Build gate: `npm test` stays fast, and this suite
 * only runs on `workflow_dispatch` or on every push to a pull request labelled `visual` (see
 * .github/workflows/visual.yml).
 *
 * Baselines are Chromium-only and must be regenerated inside the same Playwright image the workflow
 * uses, never on macOS. Install, build and test all run in the container, as your own user so the
 * bind-mounted checkout does not end up root-owned; `--platform linux/amd64` is required on Apple
 * Silicon because the committed baselines come from CI's amd64 runner:
 *
 *   docker run --rm --platform linux/amd64 -v "$PWD":/work -w /work -e HOME=/tmp \
 *       --user "$(id -u):$(id -g)" mcr.microsoft.com/playwright:v1.65.0-jammy \
 *       bash -lc 'npm ci && npm run build && npx playwright test --update-snapshots'
 *
 * Bumping @playwright/test means bumping the image tag and PLAYWRIGHT_VERSION in the workflow, then
 * regenerating every baseline. The workflow does not run `playwright install`, so a mismatch fails
 * instead of silently using a different Chromium.
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
