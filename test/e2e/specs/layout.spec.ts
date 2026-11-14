import { expect, openDashboard, card, shot, test, waitForCard, getDashboardConfig, saveDashboardConfig } from "./helpers";

/**
 * `layout: horizontal` in a real sections view: the card must place the map beside the controls, a
 * long mode name must ellipsize instead of overflowing, and the geometry must follow the cell when
 * the window is resized. All measurements come from the rendered shadow DOM of the real frontend.
 */
test("horizontal layout in a real sections view, with resize and a long mode name", async ({ loggedIn: page }) => {
    await openDashboard(page, "/e2e-layout/sections");
    await waitForCard(page);
    const target = await card(page);

    const geometry = () =>
        target.evaluate(element => {
            const wrapper = element.shadowRoot.querySelector(".layout-content.horizontal");
            if (!wrapper) return null;
            const map = wrapper.querySelector(".map-wrapper") as HTMLElement;
            const controls = wrapper.querySelector(".controls-column") as HTMLElement;
            const mapBox = map.getBoundingClientRect();
            const controlsBox = controls.getBoundingClientRect();
            const column = element.shadowRoot.querySelector(".controls-column") as HTMLElement;
            const scroller = element.shadowRoot.querySelector(".controls-wrapper") as HTMLElement;
            const button = element.shadowRoot.querySelector(".dropdown-menu-button") as HTMLElement;
            const text = element.shadowRoot.querySelector(".dropdown-menu-button-text") as HTMLElement;
            return {
                map: { left: mapBox.left, right: mapBox.right, width: mapBox.width, height: mapBox.height },
                controls: { left: controlsBox.left, right: controlsBox.right, width: controlsBox.width },
                columnWidth: column.getBoundingClientRect().width,
                scrollWidth: scroller.scrollWidth,
                clientWidth: scroller.clientWidth,
                buttonRight: button.getBoundingClientRect().right,
                buttonLeft: button.getBoundingClientRect().left,
                textOverflow: getComputedStyle(text).textOverflow,
            };
        });

    await expect.poll(geometry).not.toBeNull();
    const wide = (await geometry())!;
    expect(wide.map.right).toBeLessThanOrEqual(wide.controls.left + 1); // side by side
    expect(wide.controls.width).toBeGreaterThan(150);

    // The long mode name must stay inside the controls column, not overflow or clip on both sides.
    expect(wide.scrollWidth).toBeLessThanOrEqual(wide.clientWidth + 1);
    expect(wide.buttonLeft).toBeGreaterThanOrEqual(wide.controls.left - 1);
    expect(wide.buttonRight).toBeLessThanOrEqual(wide.controls.right + 1);
    expect(wide.textOverflow).toBe("ellipsis");
    await shot(page, "05-layout-horizontal-1280");

    // Home Assistant caps a sections column at a fixed width, so a browser resize does not resize the
    // card. What the resize handle does is change the card's grid options, which is the real resize
    // path: shrink the cell to 6 columns, reload, and the card must follow it.
    const original = await getDashboardConfig("e2e-layout");
    try {
        const narrowed = JSON.parse(JSON.stringify(original));
        const cardConfig = narrowed.views.find((view: any) => view.path === "sections").sections[0].cards[0];
        cardConfig.grid_options = { columns: 6 };
        await saveDashboardConfig("e2e-layout", narrowed);
        await page.reload();
        await waitForCard(page);
        await expect.poll(async () => (await geometry())?.map.width ?? 0).toBeLessThan(wide.map.width);
        const narrow = (await geometry())!;
        expect(narrow.map.right).toBeLessThanOrEqual(narrow.controls.left + 1);
        expect(narrow.scrollWidth).toBeLessThanOrEqual(narrow.clientWidth + 1);
        await shot(page, "06-layout-horizontal-cell-6");

        const widened = JSON.parse(JSON.stringify(original));
        const wideCard = widened.views.find((view: any) => view.path === "sections").sections[0].cards[0];
        wideCard.grid_options = { columns: 12 };
        await saveDashboardConfig("e2e-layout", widened);
        await page.reload();
        await waitForCard(page);
        await expect.poll(async () => (await geometry())?.map.width ?? 0).toBeGreaterThan(narrow.map.width);
        await shot(page, "07-layout-horizontal-cell-12");
    } finally {
        await saveDashboardConfig("e2e-layout", original);
    }

    // The page itself must never scroll sideways, whatever the viewport is.
    await page.setViewportSize({ width: 720, height: 900 });
    await page.waitForTimeout(300);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await shot(page, "08-layout-page-720");
});

test("vertical layout on a real dashboard is unchanged", async ({ loggedIn: page }) => {
    await openDashboard(page, "/e2e-layout/vertical");
    await waitForCard(page);
    const target = await card(page);
    const stacked = await target.evaluate(element => {
        const horizontal = element.shadowRoot.querySelector(".layout-content.horizontal");
        const map = element.shadowRoot.querySelector("pinch-zoom") as HTMLElement;
        const controls = element.shadowRoot.querySelector(".map-controls") as HTMLElement;
        const mapBox = map.getBoundingClientRect();
        const controlsBox = controls.getBoundingClientRect();
        return { hasWrapper: !!horizontal, controlsBelowMap: controlsBox.top >= mapBox.bottom - 1 };
    });
    expect(stacked.hasWrapper).toBe(false);
    expect(stacked.controlsBelowMap).toBe(true);
    await shot(page, "09-layout-vertical");
});
