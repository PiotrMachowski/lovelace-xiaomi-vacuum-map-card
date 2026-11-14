import { expect, openDashboard, card, shot, test, waitForCard } from "./helpers";

/**
 * Overlay alignment and room hit-testing on the real renderer at zoom 2.5 and rotation 90.
 *
 * The hit test samples the camera image at the clicked image pixel, so a click on a room outline
 * only selects that room when the SVG overlay sits where the image says it does. That makes the
 * clicks behavioural proof of alignment, not just a screenshot comparison.
 */
test("zoom 2.5 and rotation 90 keep the overlays on the rooms", async ({ loggedIn: page }) => {
    await openDashboard(page, "/e2e-map/map");
    await waitForCard(page);
    const target = await card(page);

    await target.evaluate(async element => {
        const zoomer = element.shadowRoot.getElementById("map-zoomer");
        zoomer.setTransform({ scale: 2.5, x: 0, y: 0, allowChangeEvent: true });
        element._setRotation(90);
        await element.updateComplete;
    });
    await expect.poll(async () => (await target.evaluate(element => element.mapRotation))).toBe(90);
    await expect.poll(async () => (await target.evaluate(element => element.mapScale))).toBeCloseTo(2.5, 1);
    await page.waitForTimeout(500);
    expect(await target.evaluate(element => !!element.roomColorDetection)).toBe(true);

    /** A point inside the room outline, in screen coordinates, away from the centred label. */
    const roomPoint = (roomId: string) =>
        target.evaluate((element, id) => {
            const polygon = element.shadowRoot.querySelector(`.room-${id}-wrapper .room-outline`) as SVGPolygonElement | null;
            if (!polygon) return null;
            const points = polygon.points;
            const matrix = polygon.getScreenCTM();
            if (!matrix || points.numberOfItems === 0) return null;
            const svg = polygon.ownerSVGElement!;
            const screen: Array<{ x: number; y: number }> = [];
            for (let index = 0; index < points.numberOfItems; index++) {
                const point = svg.createSVGPoint();
                point.x = points.getItem(index).x;
                point.y = points.getItem(index).y;
                screen.push(point.matrixTransform(matrix));
            }
            const centre = screen.reduce((acc, p) => ({ x: acc.x + p.x / screen.length, y: acc.y + p.y / screen.length }), { x: 0, y: 0 });
            const vertex = screen[0];
            // Three quarters of the way to a vertex: inside a convex outline, clear of the label.
            return { x: centre.x + (vertex.x - centre.x) * 0.6, y: centre.y + (vertex.y - centre.y) * 0.6 };
        }, roomId);

    /** Pans the map so the room is inside the visible card, because 2.5x is larger than the card. */
    const bringIntoView = async (roomId: string): Promise<{ x: number; y: number }> => {
        for (let attempt = 0; attempt < 4; attempt++) {
            const point = await roomPoint(roomId);
            expect(point, `room ${roomId} must be rendered`).not.toBeNull();
            const box = await target.evaluate(element => {
                const rect = (element.shadowRoot.getElementById("map-zoomer") as HTMLElement).getBoundingClientRect();
                return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 };
            });
            const inside =
                point!.x > box.left + 20 && point!.x < box.right - 20 && point!.y > box.top + 20 && point!.y < box.bottom - 20;
            if (inside) return point!;
            await target.evaluate(
                (element, delta) => {
                    const zoomer = element.shadowRoot.getElementById("map-zoomer");
                    zoomer.setTransform({
                        scale: zoomer.scale,
                        x: zoomer.x + delta.dx,
                        y: zoomer.y + delta.dy,
                        allowChangeEvent: true,
                    });
                },
                { dx: box.cx - point!.x, dy: box.cy - point!.y },
            );
            await page.waitForTimeout(250);
        }
        throw new Error(`could not bring room ${roomId} into view`);
    };

    const selectedIds = async (): Promise<string[]> =>
        (await target.evaluate(element => element.selectedRooms.map((room: any) => String(room.toVacuum())))) as string[];

    const clickRoom = async (roomId: string): Promise<void> => {
        const point = await bringIntoView(roomId);
        await page.mouse.click(point.x, point.y);
        await page.waitForTimeout(200);
    };

    for (const roomId of ["0", "1", "2"]) {
        while ((await selectedIds()).length > 0) await clickRoom((await selectedIds())[0]);
        await clickRoom(roomId);
        await expect.poll(selectedIds).toEqual([roomId]);
        await clickRoom(roomId);
        await expect.poll(selectedIds).toEqual([]);
    }

    await shot(page, "10-zoom-2-5-rotation-90");
});
