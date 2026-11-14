import { PNG } from "pngjs";
import { expect, openDashboard, card, shot, test, waitForCard } from "./helpers";

/** Room colours painted by the synthetic fixture generator. */
const ROOM_COLOURS: Record<string, [number, number, number]> = {
    "0": [230, 25, 75],
    "1": [60, 180, 75],
    "2": [67, 99, 216],
};

/**
 * Overlay alignment on the real renderer at zoom 2.5 and rotation 90.
 *
 * The proof is against the rendered image, not the overlay: the test samples screenshot pixels just
 * inside and just outside each room outline. A correct overlay sits on the coloured room, so the
 * inside pixel is the room colour; a shifted overlay would sample the white background there. The
 * click assertions then show the hit test agrees with what is drawn.
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

    /** Inside and outside sample points for a room, in page coordinates. */
    const roomSample = (roomId: string) =>
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
            // 60% of the way to a vertex is inside the convex room and clear of the centred label.
            // The outside sample is 12 px beyond the farthest vertex, along the same ray.
            const maxRadius = Math.max(...screen.map(p => Math.hypot(p.x - centre.x, p.y - centre.y)));
            const radius = Math.hypot(vertex.x - centre.x, vertex.y - centre.y) || 1;
            const ux = (vertex.x - centre.x) / radius;
            const uy = (vertex.y - centre.y) / radius;
            return {
                inside: { x: centre.x + (vertex.x - centre.x) * 0.6, y: centre.y + (vertex.y - centre.y) * 0.6 },
                outside: { x: centre.x + ux * (maxRadius + 12), y: centre.y + uy * (maxRadius + 12) },
            };
        }, roomId);

    const cardBox = await target.locator.boundingBox();
    expect(cardBox).not.toBeNull();

    const sample = (png: PNG, point: { x: number; y: number }): [number, number, number] => {
        const x = point.x - cardBox!.x;
        const y = point.y - cardBox!.y;
        expect(x, `sample x inside the card (${x})`).toBeGreaterThanOrEqual(0);
        expect(x, `sample x inside the card (${x})`).toBeLessThan(png.width);
        expect(y, `sample y inside the card (${y})`).toBeGreaterThanOrEqual(0);
        expect(y, `sample y inside the card (${y})`).toBeLessThan(png.height);
        const offset = (png.width * Math.round(y) + Math.round(x)) * 4;
        return [png.data[offset], png.data[offset + 1], png.data[offset + 2]];
    };
    const distance = (a: [number, number, number], b: [number, number, number]): number =>
        Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);

    const selectedIds = async (): Promise<string[]> =>
        (await target.evaluate(element => element.selectedRooms.map((room: any) => String(room.toVacuum())))) as string[];

    const bringIntoView = async (roomId: string): Promise<{ x: number; y: number }> => {
        for (let attempt = 0; attempt < 5; attempt++) {
            const points = await roomSample(roomId);
            expect(points, `room ${roomId} must be rendered`).not.toBeNull();
            const box = await target.evaluate(element => {
                const rect = (element.shadowRoot.getElementById("map-zoomer") as HTMLElement).getBoundingClientRect();
                return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 };
            });
            const point = points!.inside;
            const inside =
                point.x > box.left + 40 && point.x < box.right - 40 && point.y > box.top + 40 && point.y < box.bottom - 40;
            if (inside) return point;
            await target.evaluate(
                (element, delta) => {
                    const zoomer = element.shadowRoot.getElementById("map-zoomer");
                    zoomer.setTransform({ scale: zoomer.scale, x: zoomer.x + delta.dx, y: zoomer.y + delta.dy, allowChangeEvent: true });
                },
                { dx: box.cx - point.x, dy: box.cy - point.y },
            );
            await page.waitForTimeout(250);
        }
        throw new Error(`could not bring room ${roomId} into view`);
    };

    // Alignment: the rendered pixels inside the outline must be the room colour, and the pixels just
    // beyond the outline must not be. An overlay shifted off the room fails the inside sample.
    for (const roomId of ["0", "1", "2"]) {
        await bringIntoView(roomId);
        const points = await roomSample(roomId);
        expect(points).not.toBeNull();
        const png = PNG.sync.read(await target.locator.screenshot());
        const inside = sample(png, points!.inside);
        const outside = sample(png, points!.outside);
        expect(distance(inside, ROOM_COLOURS[roomId]), `inside room ${roomId} must be its colour`).toBeLessThan(70);
        expect(distance(outside, ROOM_COLOURS[roomId]), `outside room ${roomId} must not be its colour`).toBeGreaterThan(80);
    }

    // The hit test agrees with what is drawn: clicking each outline selects that room.
    for (const roomId of ["0", "1", "2"]) {
        while ((await selectedIds()).length > 0) {
            const first = (await selectedIds())[0];
            const point = await bringIntoView(first);
            await page.mouse.click(point.x, point.y);
            await page.waitForTimeout(150);
        }
        const point = await bringIntoView(roomId);
        await page.mouse.click(point.x, point.y);
        await expect.poll(selectedIds).toEqual([roomId]);
        await page.mouse.click(point.x, point.y);
        await expect.poll(selectedIds).toEqual([]);
    }

    await shot(page, "10-zoom-2-5-rotation-90");
});
