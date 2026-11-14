import { expect, openDashboard, card, shot, test, waitForCard, viewState } from "./helpers";

/**
 * The configured default view on the real frontend (fetch + storage + Lit render).
 *
 * Inputs are real user gestures: a wheel zoom over the map and clicks on the card's own zoom and
 * reset controls. The view is asserted on scale and offsets, and it must survive a reload.
 */
test("map_view opens, resets and persists on a real dashboard", async ({ loggedIn: page }) => {
    await openDashboard(page, "/e2e-map/map");
    await waitForCard(page);
    const target = await card(page);

    // The card config sets map_view {scale: 2, x: 0, y: 0, rotation: 0}. x/y are offsets from the
    // centred view, so the neutral expectation is the values the card computes for that placement.
    await expect.poll(async () => (await viewState(target)).scale).toBeCloseTo(2, 1);
    const defaultView = await viewState(target);

    const mapBox = await target.evaluate(element => {
        const rect = (element.shadowRoot.getElementById("map-zoomer") as HTMLElement).getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    });

    // A real wheel gesture over the map. The card's pinch-zoom handles the wheel event; a retry
    // keeps the test stable while the card finishes attaching its gesture handlers after load.
    for (let attempt = 0; attempt < 4 && (await viewState(target)).scale <= 2.05; attempt++) {
        await page.mouse.move(mapBox.x, mapBox.y);
        await page.mouse.wheel(0, -600);
        await page.waitForTimeout(300);
    }
    await expect.poll(async () => (await viewState(target)).scale).toBeGreaterThan(2.05);
    const wheeled = await viewState(target);
    expect(Math.abs(wheeled.x) + Math.abs(wheeled.y)).toBeGreaterThan(0);
    await shot(page, "02-map-view-panned");

    // The card's reset control returns to the configured default, offsets included.
    await target.evaluate(element => {
        const reset = element.shadowRoot.querySelector(".icon-on-map.clickable") as HTMLElement;
        reset.click();
    });
    await expect.poll(async () => (await viewState(target)).scale).toBeCloseTo(2, 1);
    await expect.poll(async () => Math.abs((await viewState(target)).x - defaultView.x)).toBeLessThan(3);
    await expect.poll(async () => Math.abs((await viewState(target)).y - defaultView.y)).toBeLessThan(3);
    await shot(page, "03-map-view-reset");

    // Reload: the stored view for this key was written by the reset, which equals the default here.
    await page.reload();
    await waitForCard(page);
    const reloaded = await card(page);
    await expect.poll(async () => (await viewState(reloaded)).scale).toBeCloseTo(2, 1);

    // A wheel gesture after the reset persists across another reload.
    // Give the reloaded card a moment to attach its gesture handlers, then zoom with the wheel.
    await expect
        .poll(async () => reloaded.evaluate(element => !!element.shadowRoot?.getElementById("map-zoomer")))
        .toBe(true);
    const mapBox2 = await reloaded.evaluate(element => {
        const rect = (element.shadowRoot.getElementById("map-zoomer") as HTMLElement).getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    });
    for (let attempt = 0; attempt < 3 && (await viewState(reloaded)).scale <= 2.05; attempt++) {
        await page.mouse.move(mapBox2.x, mapBox2.y);
        await page.mouse.wheel(0, -600);
        await page.waitForTimeout(300);
    }
    await expect.poll(async () => (await viewState(reloaded)).scale).toBeGreaterThan(2.05);
    const gestures = await viewState(reloaded);
    await page.waitForTimeout(700);
    await page.reload();
    await waitForCard(page);
    const afterReload = await card(page);
    await expect.poll(async () => (await viewState(afterReload)).scale).toBeCloseTo(gestures.scale, 1);
    await expect.poll(async () => Math.abs((await viewState(afterReload)).x - gestures.x)).toBeLessThan(4);
    await expect.poll(async () => Math.abs((await viewState(afterReload)).y - gestures.y)).toBeLessThan(4);
    await shot(page, "04-map-view-persisted");
});
