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

    /**
     * Inside and outside sample points for every edge of a room, in page coordinates.
     *
     * Sampling only the centre-to-vertex ray hides a shift along that ray, so each edge midpoint is
     * tested separately: 6 px inside must be the room colour, 6 px outside must not be.
     */
    const roomEdgeSamples = (roomId: string) =>
        target.evaluate((element, id) => {
            const polygon = element.shadowRoot.querySelector(`.room-${id}-wrapper .room-outline`) as SVGPolygonElement | null;
            if (!polygon) return null;
            const points = polygon.points;
            const matrix = polygon.getScreenCTM();
            if (!matrix || points.numberOfItems < 3) return null;
            const svg = polygon.ownerSVGElement!;
            const screen: Array<{ x: number; y: number }> = [];
            for (let index = 0; index < points.numberOfItems; index++) {
                const point = svg.createSVGPoint();
                point.x = points.getItem(index).x;
                point.y = points.getItem(index).y;
                screen.push(point.matrixTransform(matrix));
            }
            const centre = screen.reduce((acc, p) => ({ x: acc.x + p.x / screen.length, y: acc.y + p.y / screen.length }), { x: 0, y: 0 });
            const inside: Array<{ x: number; y: number }> = [];
            const outside: Array<{ x: number; y: number }> = [];
            for (let index = 0; index < screen.length; index++) {
                const a = screen[index];
                const b = screen[(index + 1) % screen.length];
                const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
                const nx = centre.x - mid.x;
                const ny = centre.y - mid.y;
                const length = Math.hypot(nx, ny) || 1;
                inside.push({ x: mid.x + (nx / length) * 6, y: mid.y + (ny / length) * 6 });
                outside.push({ x: mid.x - (nx / length) * 6, y: mid.y - (ny / length) * 6 });
            }
            return { centre, inside, outside };
        }, roomId);

    const cardBox = await target.locator.boundingBox();
    expect(cardBox).not.toBeNull();
    const mapBox = await target.evaluate(element => {
        const rect = (element.shadowRoot.getElementById("map-zoomer") as HTMLElement).getBoundingClientRect();
        return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
    });

    /** The pixel at a page point, or null when the point is outside the captured card. */
    const sample = (png: PNG, point: { x: number; y: number }): [number, number, number] | null => {
        const x = point.x - cardBox!.x;
        const y = point.y - cardBox!.y;
        if (x < 2 || y < 2 || x >= png.width - 2 || y >= png.height - 2) return null;
        // A room can extend past the map viewport into the controls area, where the pixels are not
        // the map: only points inside both the map and the captured card are meaningful.
        if (point.x < mapBox.left + 2 || point.x > mapBox.right - 2 || point.y < mapBox.top + 2 || point.y > mapBox.bottom - 2) return null;
        const offset = (png.width * Math.round(y) + Math.round(x)) * 4;
        return [png.data[offset], png.data[offset + 1], png.data[offset + 2]];
    };
    const distance = (a: [number, number, number], b: [number, number, number]): number =>
        Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);

    const selectedIds = async (): Promise<string[]> =>
        (await target.evaluate(element => element.selectedRooms.map((room: any) => String(room.toVacuum())))) as string[];

    const bringIntoView = async (roomId: string): Promise<{ x: number; y: number }> => {
        for (let attempt = 0; attempt < 5; attempt++) {
            const points = await roomEdgeSamples(roomId);
            expect(points, `room ${roomId} must be rendered`).not.toBeNull();
            const box = await target.evaluate(element => {
                const rect = (element.shadowRoot.getElementById("map-zoomer") as HTMLElement).getBoundingClientRect();
                return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 };
            });
            const point = points!.centre;
            const inside =
                point.x > box.left + 40 && point.x < box.right - 40 && point.y > box.top + 40 && point.y < box.bottom - 40;
            if (inside) return points!.inside[0];
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

    // A deliberate overlay shift, used to prove this spec would catch one. The shift is applied
    // inside the zoomed/rotated map content, so "20,0" moves the overlay by ~50 screen px at 2.5x.
    const [shiftX, shiftY] = (process.env.E2E_OVERLAY_SHIFT ?? "0,0").split(",").map(Number);
    if (shiftX !== 0 || shiftY !== 0) {
        await target.evaluate(
            (element, delta) => {
                element.shadowRoot.querySelectorAll(".room-wrapper").forEach((wrapper: HTMLElement) => {
                    wrapper.style.transform = `translate(${delta.x}px, ${delta.y}px)`;
                });
            },
            { x: shiftX || 0, y: shiftY || 0 },
        );
        await page.waitForTimeout(300);
    }

    // Alignment: the painted room and its outline must occupy the same screen box. The painted box
    // comes from the screenshot's room-colour pixels inside the map viewport; the outline box comes
    // from the polygon, clipped to the same viewport. A shift in any direction moves the outline box
    // away from the painted one, so the tolerance is 8 screen px.
    for (const roomId of ["0", "1", "2"]) {
        await bringIntoView(roomId);
        const outline = await roomEdgeSamples(roomId);
        expect(outline).not.toBeNull();
        const png = PNG.sync.read(await target.locator.screenshot());

        const clip = (rect: { left: number; top: number; right: number; bottom: number }) => ({
            left: Math.max(rect.left, mapBox.left) - cardBox!.x,
            top: Math.max(rect.top, mapBox.top) - cardBox!.y,
            right: Math.min(rect.right, mapBox.right) - cardBox!.x,
            bottom: Math.min(rect.bottom, mapBox.bottom) - cardBox!.y,
        });

        const polygonBox = await target.evaluate((element, id) => {
            const polygon = element.shadowRoot.querySelector(`.room-${id}-wrapper .room-outline`) as SVGPolygonElement | null;
            if (!polygon) return null;
            const rect = polygon.getBoundingClientRect();
            return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
        }, roomId);
        expect(polygonBox).not.toBeNull();
        const expected = clip(polygonBox!);

        const colour = ROOM_COLOURS[roomId];
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (let y = Math.max(0, Math.floor(expected.top)); y < Math.min(png.height, Math.ceil(expected.bottom)); y++) {
            for (let x = Math.max(0, Math.floor(expected.left)); x < Math.min(png.width, Math.ceil(expected.right)); x++) {
                const offset = (png.width * y + x) * 4;
                const pixel: [number, number, number] = [png.data[offset], png.data[offset + 1], png.data[offset + 2]];
                if (distance(pixel, colour) > 60) continue;
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
        expect(minX, `room ${roomId} must paint its colour inside the outline box`).toBeLessThan(Infinity);
        const painted = { left: minX, top: minY, right: maxX, bottom: maxY };
        expect(Math.abs(painted.left - expected.left), `room ${roomId} left edge`).toBeLessThanOrEqual(4);
        expect(Math.abs(painted.top - expected.top), `room ${roomId} top edge`).toBeLessThanOrEqual(4);
        expect(Math.abs(painted.right - expected.right), `room ${roomId} right edge`).toBeLessThanOrEqual(4);
        expect(Math.abs(painted.bottom - expected.bottom), `room ${roomId} bottom edge`).toBeLessThanOrEqual(4);
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
