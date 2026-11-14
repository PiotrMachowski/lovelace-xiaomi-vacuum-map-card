import { expect, openDashboard, card, bumpCamera, cameraRequests, resetCamera, resetCameraRequests, serviceCall, shot, test, waitForCard } from "./helpers";

/**
 * Camera request rate on the real instance with a controllable camera.
 *
 * The fixture camera counts every image request, so this measures what the card actually asks the
 * backend for while entity state changes, on a camera update, and while the tab is hidden.
 */
test("camera requests follow the refresh policy on a real instance", async ({ loggedIn: page }) => {
    await openDashboard(page, "/e2e-map/map");
    await waitForCard(page);
    const target = await card(page);
    await expect
        .poll(async () => target.evaluate(element => {
            const image = element.shadowRoot.getElementById("map-image-source") as HTMLImageElement;
            return image?.complete && image.naturalWidth > 0;
        }))
        .toBe(true);

    await resetCamera(page);
    await resetCameraRequests(page);

    // Real vacuum state changes re-render the card; they must not ask for a new snapshot.
    for (let index = 0; index < 6; index++) {
        await serviceCall("vacuum", index % 2 === 0 ? "start" : "stop", { entity_id: "vacuum.demo_vacuum_0_ground_floor" });
        await page.waitForTimeout(200);
    }
    await page.waitForTimeout(1200);
    const duringUpdates = await cameraRequests(page);
    expect(duringUpdates.total ?? 0).toBeLessThanOrEqual(1);

    // A camera state change is a real new map: exactly one new request.
    const beforeBump = (await cameraRequests(page)).total ?? 0;
    await bumpCamera(page);
    await expect.poll(async () => ((await cameraRequests(page)).total ?? 0) - beforeBump, { timeout: 10_000 }).toBe(1);

    // A hidden tab must not request snapshots, even when the camera changes.
    await page.evaluate(() => {
        Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
        document.dispatchEvent(new Event("visibilitychange"));
    });
    const hiddenBefore = (await cameraRequests(page)).total ?? 0;
    await bumpCamera(page);
    await bumpCamera(page);
    await page.waitForTimeout(2500);
    expect((await cameraRequests(page)).total ?? 0).toBe(hiddenBefore);

    // Becoming visible again applies one refresh for the changes that were held back.
    await page.evaluate(() => {
        Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
        document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect.poll(async () => ((await cameraRequests(page)).total ?? 0) - hiddenBefore, { timeout: 10_000 }).toBe(1);

    await shot(page, "11-camera-rate");
});
