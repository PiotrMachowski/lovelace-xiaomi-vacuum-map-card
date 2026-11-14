import { expect, openDashboard, card, shot, test, waitForCard, viewState } from "./helpers";

/**
 * The configured default view must open, survive a pan/zoom, reset, and persist across a reload on
 * the real frontend (fetch + storage + Lit render), not only in the happy-dom harness.
 */
test("map_view opens, resets and persists on a real dashboard", async ({ loggedIn: page }) => {
    await openDashboard(page, "/e2e-map/map");
    await waitForCard(page);
    const target = await card(page);

    // The card config sets map_view {scale: 2, x: 0, y: 0, rotation: 0}; the rendered view must use it.
    await expect.poll(async () => (await viewState(target)).scale).toBeCloseTo(2, 1);

    // A real gesture changes the view.
    await target.evaluate(element => {
        const zoomer = element.shadowRoot.getElementById("map-zoomer");
        zoomer.setTransform({ scale: 3.25, x: -140, y: -90, allowChangeEvent: true });
    });
    await expect.poll(async () => (await viewState(target)).scale).toBeCloseTo(3.25, 1);
    await shot(page, "02-map-view-panned");

    // The reset control in the card toolbar returns to the configured default.
    await target.evaluate(element => {
        const reset = element.shadowRoot.querySelector(".icon-on-map.clickable");
        reset.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
    });
    await expect.poll(async () => (await viewState(target)).scale).toBeCloseTo(2, 1);
    await shot(page, "03-map-view-reset");

    // The reset persisted: a fresh navigation reads the stored view, which equals the default here.
    await page.reload();
    await waitForCard(page);
    const reloaded = await card(page);
    await expect.poll(async () => (await viewState(reloaded)).scale).toBeCloseTo(2, 1);

    // And a view panned after the reset survives a reload, proving persistence is real.
    await reloaded.evaluate(element => {
        const zoomer = element.shadowRoot.getElementById("map-zoomer");
        zoomer.setTransform({ scale: 2.75, x: -60, y: -40, allowChangeEvent: true });
    });
    await expect.poll(async () => (await viewState(reloaded)).scale).toBeCloseTo(2.75, 1);
    await page.waitForTimeout(600);
    await page.reload();
    await waitForCard(page);
    const afterReload = await card(page);
    await expect.poll(async () => (await viewState(afterReload)).scale).toBeCloseTo(2.75, 1);
    await shot(page, "04-map-view-persisted");
});
