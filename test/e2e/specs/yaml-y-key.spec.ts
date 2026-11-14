import { expect, openDashboard, card, shot, test, waitForCard } from "./helpers";

/**
 * Upstream #952: a YAML dashboard with an unquoted `y:` key inside `map_view`.
 *
 * Home Assistant parses YAML with implicit boolean resolution; if `y` resolves to `true`, the
 * configured vertical offset is lost. The card must open at the offset the file asks for, which
 * means the parser kept `y` as a string. That converts the old "reproduce it on the real instance"
 * task into an assertion.
 */
test("unquoted y: in a YAML dashboard is applied, not parsed as a boolean", async ({ loggedIn: page }) => {
    await openDashboard(page, "/e2e-yaml/yaml");
    await waitForCard(page);
    const target = await card(page);

    await expect.poll(async () => (await target.evaluate(element => element.mapScale))).toBeCloseTo(1.5, 1);

    const measured = await target.evaluate(element => {
        const zoomer = element.shadowRoot.getElementById("map-zoomer") as HTMLElement;
        const content = element.shadowRoot.getElementById("map-zoomer-content") as HTMLElement;
        const viewport = zoomer.getBoundingClientRect();
        const scale = element.mapScale as number;
        // The card centres a configured scale and then adds the configured offset, so the expected
        // value is viewport/2 - scale*content/2 + configuredY.
        const centring = viewport.height / 2 - (scale * content.offsetHeight) / 2;
        return {
            mapY: element.mapY as number,
            mapX: element.mapX as number,
            rotation: element.mapRotation as number,
            centring,
            expectedWithThirty: centring + 30,
            expectedWithoutThirty: centring,
        };
    });

    expect(measured.rotation).toBe(0);
    // 30 px of configured offset must be present. A boolean-parsed key would leave mapY at the
    // centring value, so assert both the value and the difference.
    expect(Math.abs(measured.mapY - measured.expectedWithThirty)).toBeLessThanOrEqual(2);
    expect(Math.abs(measured.mapY - measured.expectedWithoutThirty)).toBeGreaterThan(20);

    await shot(page, "12-yaml-y-key");
});
