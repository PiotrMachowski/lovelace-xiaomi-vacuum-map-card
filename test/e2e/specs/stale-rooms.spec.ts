import { expect, openDashboard, card, shot, serviceCall, test, waitForCard } from "./helpers";

/**
 * B8 on a real instance: a re-map that keeps the geometry but renumbers the segments.
 *
 * The fixture camera can swap its `rooms` metadata for a shifted set. The card must mark the
 * configured rooms that no longer exist, warn about them, and refuse to select or send them - while
 * the map looks identical, which is exactly why this bug is dangerous.
 */
test("a re-mapped camera marks stale rooms and refuses them", async ({ loggedIn: page }) => {
    await openDashboard(page, "/e2e-stale/rooms");
    await waitForCard(page);
    const target = await card(page);

    const rooms = () =>
        target.evaluate(element => {
            const wrappers = [...element.shadowRoot.querySelectorAll(".room-wrapper")];
            return {
                ids: wrappers.map(wrapper => (wrapper.getAttribute("class") ?? "").match(/room-([\w-]+)-wrapper/)?.[1] ?? ""),
                stale: wrappers.filter(wrapper => wrapper.classList.contains("room-stale")).length,
                warning: (element.shadowRoot.querySelector(".room-config-warning")?.textContent ?? "").trim(),
            };
        });

    // Start from the original metadata even if an earlier run aborted before restoring it.
    await serviceCall("map_fixture", "set_rooms", { mode: "reset" });
    await expect.poll(async () => (await rooms()).ids.sort()).toEqual(["0", "1", "2"]);
    expect((await rooms()).warning).toBe("");

    try {
        await serviceCall("map_fixture", "set_rooms", { mode: "shift" });

        // The configured ids 0/1/2 no longer exist in the camera metadata: they are drawn from their
        // stored outlines, marked stale, and named in the warning.
        await expect.poll(async () => (await rooms()).stale, { timeout: 15_000 }).toBeGreaterThanOrEqual(3);
        const afterRemap = await rooms();
        expect(afterRemap.warning).toMatch(/0[\s,]+1[\s,]+2/);

        // The stale room is drawn from its configured outline but is not a hit target, so a click
        // there falls through to the live, colour-detected room that now covers the same pixels. It
        // must never select the stale id 0: the wrong room must not be cleanable.
        const stalePoint = await target.evaluate(element => {
            const stale = element.shadowRoot.querySelector(".room-0-wrapper .room-outline") as SVGPolygonElement | null;
            if (!stale) return null;
            const points = stale.points;
            const matrix = stale.getScreenCTM();
            if (!matrix || points.numberOfItems === 0) return null;
            const svg = stale.ownerSVGElement!;
            const screen: Array<{ x: number; y: number }> = [];
            for (let index = 0; index < points.numberOfItems; index++) {
                const point = svg.createSVGPoint();
                point.x = points.getItem(index).x;
                point.y = points.getItem(index).y;
                screen.push(point.matrixTransform(matrix));
            }
            const centre = screen.reduce((acc, p) => ({ x: acc.x + p.x / screen.length, y: acc.y + p.y / screen.length }), { x: 0, y: 0 });
            const vertex = screen[0];
            return { x: centre.x + (vertex.x - centre.x) * 0.6, y: centre.y + (vertex.y - centre.y) * 0.6 };
        });
        expect(stalePoint).not.toBeNull();
        await page.mouse.click(stalePoint!.x, stalePoint!.y);
        await expect
            .poll(async () => (await target.evaluate(element => element.selectedRooms.map((room: any) => String(room.toVacuum())))) as string[])
            .not.toContain("0");
        await shot(page, "15-stale-rooms");

        // Clear whatever the fall-through click selected, then pick the live room on purpose.
        while ((await target.evaluate(element => element.selectedRooms.length)) > 0) {
            await page.mouse.click(stalePoint!.x, stalePoint!.y);
            await page.waitForTimeout(150);
        }

        // The live rooms of the new metadata are selectable again.
        const livePoint = await target.evaluate(element => {
            const live = element.shadowRoot.querySelector(".room-7-wrapper .room-outline") as SVGPolygonElement | null;
            if (!live) return null;
            // Off-centre towards a vertex: the centre carries the room label, which is its own target.
            const points = live.points;
            const matrix = live.getScreenCTM();
            if (!matrix || points.numberOfItems === 0) return null;
            const svg = live.ownerSVGElement!;
            const screen: Array<{ x: number; y: number }> = [];
            for (let index = 0; index < points.numberOfItems; index++) {
                const point = svg.createSVGPoint();
                point.x = points.getItem(index).x;
                point.y = points.getItem(index).y;
                screen.push(point.matrixTransform(matrix));
            }
            const centre = screen.reduce((acc, p) => ({ x: acc.x + p.x / screen.length, y: acc.y + p.y / screen.length }), { x: 0, y: 0 });
            const vertex = screen[0];
            return { x: centre.x + (vertex.x - centre.x) * 0.6, y: centre.y + (vertex.y - centre.y) * 0.6 };
        });
        expect(livePoint, "the re-mapped room 7 must be live").not.toBeNull();
        await page.mouse.click(livePoint!.x, livePoint!.y);
        await expect
            .poll(async () => (await target.evaluate(element => element.selectedRooms.map((room: any) => String(room.toVacuum())))) as string[])
            .toEqual(["7"]);
    } finally {
        // Always restore the fixture: a failure above must not renumber the camera for later specs.
        await serviceCall("map_fixture", "set_rooms", { mode: "reset" });
        await expect.poll(async () => (await rooms()).stale, { timeout: 15_000 }).toBe(0);
    }
});
