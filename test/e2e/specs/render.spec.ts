import { expect, openDashboard, card, shot, test, waitForCard, viewState } from "./helpers";

/**
 * The card must render on a real Home Assistant frontend, from the real Lovelace resource, against a
 * real camera entity - not from the Vitest harness.
 */
test("renders on a real dashboard with the real camera", async ({ loggedIn: page }) => {
    await openDashboard(page, "/e2e-map/map");
    await waitForCard(page);

    const target = await card(page);
    const shadowHasCard = await target.evaluate(element => !!element.shadowRoot?.querySelector("ha-card"));
    expect(shadowHasCard).toBe(true);

    // The map viewport is transparent, so the card's surface shows through transparent map pixels
    // instead of Home Assistant's secondary grey.
    const zoomerBackground = await target.evaluate(element => {
        const zoomer = element.shadowRoot?.getElementById("map-zoomer");
        return zoomer ? getComputedStyle(zoomer).backgroundColor : null;
    });
    expect(zoomerBackground).toBe("rgba(0, 0, 0, 0)");

    const state = await viewState(target);
    expect(state.scale).toBeGreaterThan(0);

    const imageSrc = await target.evaluate(element => {
        const image = element.shadowRoot?.getElementById("map-image-source") as HTMLImageElement | null;
        return image?.getAttribute("src") ?? "";
    });
    expect(imageSrc).toContain("/api/map_fixture/image");

    // The fixture camera exposes the committed map; the browser must have decoded it.
    const imageLoaded = await target.evaluate(async element => {
        const image = element.shadowRoot?.getElementById("map-image-source") as HTMLImageElement | null;
        if (!image) return false;
        if (!image.complete) await new Promise(resolve => image.addEventListener("load", resolve, { once: true }));
        return image.naturalWidth > 0;
    });
    expect(imageLoaded).toBe(true);

    await shot(page, "01-real-dashboard");
});
