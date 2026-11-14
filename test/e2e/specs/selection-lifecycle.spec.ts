import { bumpCamera, card, expect, openDashboard, serviceCall, shot, test, waitForCard, type CardHandle } from "./helpers";

/**
 * Selection state across rebuilds on a real instance.
 *
 * Room 1 follows `input_boolean.e2e_clean_living_room`. Flipping that boolean outside the card, and
 * a new camera image, both rebuild the room objects. The user's rooms must survive each rebuild in
 * click order (the cleaning order); only the entity-backed room joins and leaves.
 */
const BOOLEAN = "input_boolean.e2e_clean_living_room";

function selected(target: CardHandle): Promise<string[]> {
    return target.evaluate(element => element.selectedRooms.map((room: any) => String(room.toVacuum())));
}

function badges(target: CardHandle): Promise<Record<string, string>> {
    return target.evaluate(element => {
        const result: Record<string, string> = {};
        element.shadowRoot.querySelectorAll(".room-wrapper").forEach((wrapper: Element) => {
            const id = (wrapper.getAttribute("class") ?? "").match(/room-([\w-]+)-wrapper/)?.[1];
            const badge = wrapper.querySelector(".room-order")?.textContent?.trim();
            if (id && badge) result[id] = badge;
        });
        return result;
    });
}

/** A screen point inside a room, off-centre towards a vertex so the label is not the target. */
function roomPoint(target: CardHandle, id: string): Promise<{ x: number; y: number } | null> {
    return target.evaluate((element, roomId: string) => {
        const outline = element.shadowRoot.querySelector(`.room-${roomId}-wrapper .room-outline`) as SVGPolygonElement | null;
        const matrix = outline?.getScreenCTM();
        if (!outline || !matrix || outline.points.numberOfItems === 0) return null;
        const svg = outline.ownerSVGElement!;
        const screen: Array<{ x: number; y: number }> = [];
        for (let index = 0; index < outline.points.numberOfItems; index++) {
            const point = svg.createSVGPoint();
            point.x = outline.points.getItem(index).x;
            point.y = outline.points.getItem(index).y;
            screen.push(point.matrixTransform(matrix));
        }
        const centre = screen.reduce((acc, p) => ({ x: acc.x + p.x / screen.length, y: acc.y + p.y / screen.length }), { x: 0, y: 0 });
        const vertex = screen[0];
        return { x: centre.x + (vertex.x - centre.x) * 0.6, y: centre.y + (vertex.y - centre.y) * 0.6 };
    }, id);
}

test("a selection survives entity and camera rebuilds in click order", async ({ loggedIn: page }) => {
    await serviceCall("input_boolean", "turn_off", { entity_id: BOOLEAN });
    await openDashboard(page, "/e2e-selection/rooms");
    await waitForCard(page);
    const target = await card(page);
    await expect.poll(async () => (await roomPoint(target, "2")) !== null).toBe(true);

    try {
        for (const id of ["2", "0"]) {
            const point = await roomPoint(target, id);
            await page.mouse.click(point!.x, point!.y);
            await page.waitForTimeout(150);
        }
        await expect.poll(() => selected(target)).toEqual(["2", "0"]);

        // Turned on outside the card (as an automation would): the room joins at the end.
        await serviceCall("input_boolean", "turn_on", { entity_id: BOOLEAN });
        await expect.poll(() => selected(target)).toEqual(["2", "0", "1"]);
        expect(await badges(target)).toEqual({ "2": "1", "0": "2", "1": "3" });

        // A new camera image rebuilds the rooms from the detected colours; nothing moves.
        await bumpCamera(page);
        await page.waitForTimeout(6_000);
        expect(await selected(target)).toEqual(["2", "0", "1"]);
        await shot(page, "16-selection-after-rebuilds");

        // Turned off elsewhere: only that room leaves, the others keep their numbers.
        await serviceCall("input_boolean", "turn_off", { entity_id: BOOLEAN });
        await expect.poll(() => selected(target)).toEqual(["2", "0"]);
        expect(await badges(target)).toEqual({ "2": "1", "0": "2" });
    } finally {
        await serviceCall("input_boolean", "turn_off", { entity_id: BOOLEAN });
    }
});
