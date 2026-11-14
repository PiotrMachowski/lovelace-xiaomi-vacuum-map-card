import { describe, expect, it, vi } from "vitest";

import type { XiaomiVacuumMapCardConfig } from "../../src/types/types";
import type { CardHandle, MockHass } from "../harness";
import { fixtureConfig, fixtureHass, loadSyntheticFixture, mountCard, settle, useHarnessClock, withState } from "../harness";

/**
 * Cleaning-order badges (upstream #959, issue #866).
 *
 * The card sends rooms to the service call in click order, which decides what platforms that honour
 * a custom order actually clean. A selected room now shows its position in that order, and the
 * remaining rooms renumber when one is deselected.
 *
 * These tests click the rendered room polygons. happy-dom has no canvas 2D context, so the card's
 * colour detection (which replaces the polygon's own click handler with the image hit test) does not
 * run here; the polygon's `@click` is therefore the same target a manual room configuration uses.
 * Room hit-testing through the image is covered in Chromium by `test/visual/visual.spec.ts`.
 */

/** The synthetic fixture's camera room ids: Kitchen (0), Living room (1), Bedroom (2). */
const ROOM_IDS = ["0", "1", "2"] as const;

function cleaningOrderConfig(overrides: Partial<XiaomiVacuumMapCardConfig> = {}): XiaomiVacuumMapCardConfig {
    const fixture = loadSyntheticFixture();
    return {
        ...fixtureConfig(fixture),
        map_modes: [{ template: "vacuum_clean_segment" }],
        // Pin tiles and icons empty: this file is about the map overlay only.
        tiles: [],
        icons: [],
        persist_map_view: false,
        ...overrides,
    };
}

async function mountCleaningOrderCard(
    overrides: Partial<XiaomiVacuumMapCardConfig> = {},
): Promise<{ card: CardHandle; hass: MockHass }> {
    useHarnessClock();
    const fixture = loadSyntheticFixture();
    const hass = fixtureHass(fixture);
    const card = await mountCard(cleaningOrderConfig(overrides), hass);
    await card.fireMapLoad();
    return { card, hass };
}

function roomElement(card: CardHandle, id: string): Element {
    const element = card.shadowRoot.querySelector(`.room-${id}-wrapper`);
    if (!element) throw new Error(`room ${id} is not rendered`);
    return element;
}

/** The order number rendered inside a room, or undefined when the room shows none. */
function badge(card: CardHandle, id: string): string | undefined {
    return roomElement(card, id).querySelector(".room-order")?.textContent?.trim() || undefined;
}

/** Every badge on the map, keyed by room id; unselected rooms are absent. */
function badges(card: CardHandle): Record<string, string> {
    const entries: Array<[string, string]> = [];
    for (const id of ROOM_IDS) {
        const value = badge(card, id);
        if (value !== undefined) entries.push([id, value]);
    }
    return Object.fromEntries(entries) as Record<string, string>;
}

async function clickRoom(card: CardHandle, id: string): Promise<void> {
    const polygon = roomElement(card, id).querySelector(".room-outline");
    if (!polygon) throw new Error(`room ${id} has no clickable outline`);
    polygon.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
    await settle(card.element);
}

async function clickRooms(card: CardHandle, ids: readonly string[]): Promise<void> {
    for (const id of ids) await clickRoom(card, id);
}

/**
 * Presses the card's own run control and lets its action handler fire. The control is bound with
 * `hasDoubleClick`, so a click or Enter is turned into a `tap` 250 ms later.
 */
async function runSelection(card: CardHandle, activation: "click" | "keyboard" = "click"): Promise<void> {
    const button = card.shadowRoot.querySelector(".map-actions-item.main");
    if (!button) throw new Error("the card has no run button");
    if (activation === "click") {
        button.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
    } else {
        const event = new KeyboardEvent("keyup", { bubbles: true, composed: true, key: "Enter" });
        // The action handler still reads the legacy `keyCode`.
        Object.defineProperty(event, "keyCode", { value: 13 });
        button.dispatchEvent(event);
    }
    await settle(card.element, 400);
}

/** The service calls the card made, as `[domain, service, serviceData]` tuples. */
function serviceCalls(hass: MockHass): unknown[][][] {
    return vi.mocked(hass.callService).mock.calls as unknown as unknown[][][];
}

/** The room ids the card passed to the last service call, in payload order. */
function calledSegments(hass: MockHass): unknown[] {
    const calls = serviceCalls(hass);
    expect(calls.length, "expected at least one service call").toBeGreaterThan(0);
    const [domain, service, serviceData] = calls[calls.length - 1];
    expect(domain).toBe("xiaomi_miio");
    expect(service).toBe("vacuum_clean_segment");
    return (serviceData as unknown as { segments: unknown[] }).segments;
}

/** Room ids ordered by the badge they show, so a badge can be compared with the payload order. */
function roomsByBadge(card: CardHandle): string[] {
    const rendered = Object.entries(badges(card));
    const numbers = rendered.map(([, value]) => Number(value)).sort((a, b) => a - b);
    // Contiguous 1..n: a duplicate or a gap means the positions do not describe one order.
    expect(numbers).toEqual(numbers.map((_, index) => index + 1));
    return rendered.sort(([, a], [, b]) => Number(a) - Number(b)).map(([id]) => id);
}

describe("cleaning-order badges (#866, upstream #959)", () => {
    it("shows each selected room's position in the order the rooms were clicked", async () => {
        const { card } = await mountCleaningOrderCard();
        expect(badges(card)).toEqual({});

        // Click order deliberately differs from room-id order, so a badge drawn from the room
        // list (`0,1,2`) instead of the selection would be caught.
        await clickRooms(card, ["2", "0", "1"]);

        expect(badges(card)).toEqual({ "2": "1", "0": "2", "1": "3" });
        for (const id of ROOM_IDS) {
            expect(roomElement(card, id).classList.contains("selected")).toBe(true);
        }
    });

    it("renumbers the remaining rooms when one is deselected", async () => {
        const { card } = await mountCleaningOrderCard();
        await clickRooms(card, ["2", "0", "1"]);
        expect(badges(card)).toEqual({ "2": "1", "0": "2", "1": "3" });

        // Deselect the middle room of the order: the third room has to move into its place.
        await clickRoom(card, "0");

        expect(badges(card)).toEqual({ "2": "1", "1": "2" });
        expect(roomElement(card, "0").classList.contains("selected")).toBe(false);
    });

    it("keeps the service call on click order before and after a renumber", async () => {
        const { card, hass } = await mountCleaningOrderCard();

        await clickRooms(card, ["2", "0", "1"]);
        const badgesBeforeFirstRun = roomsByBadge(card);
        await runSelection(card);
        expect(calledSegments(hass)).toEqual([2, 0, 1]);
        expect(serviceCalls(hass)).toHaveLength(1);
        // The numbered rooms are the payload, in payload order: a badge is the position in the very
        // array the card sends, so rendering it can never reorder that array.
        expect(badgesBeforeFirstRun).toEqual(calledSegments(hass).map(String));

        // The default `clean_selection_on_start` clears the card's selection and redraws the map
        // right away, so the second round of clicks reaches the current room objects.
        expect(card.element._getSelection(card.element._getCurrentMode()).selection).toEqual([]);
        // The started run keeps its order on the map, in the same style, and the rooms are locked
        // until the vacuum is done (test/regressions/active-room-run.test.ts).
        expect(badges(card)).toEqual({ "2": "1", "0": "2", "1": "3" });
        const vacuum = fixtureConfig(loadSyntheticFixture()).entity as string;
        for (const state of ["cleaning", "docked"]) {
            await card.updateHass(withState(card.hass, vacuum, { state }).hass);
            await settle(card.element);
        }
        expect(badges(card)).toEqual({});
        await clickRooms(card, ["2", "0", "1"]);
        await clickRoom(card, "0");
        const badgesBeforeSecondRun = roomsByBadge(card);
        expect(badgesBeforeSecondRun).toEqual(["2", "1"]);

        // Keyboard and click reach the same run path, and the payload still follows click order.
        await runSelection(card, "keyboard");
        expect(calledSegments(hass)).toEqual([2, 1]);
        expect(serviceCalls(hass)).toHaveLength(2);
        expect(badgesBeforeSecondRun).toEqual(calledSegments(hass).map(String));
    });

    it("replaces the icon of a selected room when the room has one (upstream behaviour)", async () => {
        const { card } = await mountCleaningOrderCard({
            map_modes: [
                {
                    template: "vacuum_clean_segment",
                    predefined_selections: ROOM_IDS.map(id => ({
                        id: Number(id),
                        icon: { name: "mdi:broom", x: 0, y: 0 },
                    })),
                },
            ],
        });

        const iconWrapper = (id: string): Element => {
            const wrapper = roomElement(card, id).querySelector(".room-icon-wrapper");
            if (!wrapper) throw new Error(`room ${id} has no icon wrapper`);
            return wrapper;
        };

        // An unselected room keeps its icon and shows no number.
        expect(iconWrapper("1").querySelector("ha-icon")).not.toBeNull();
        expect(iconWrapper("1").querySelector(".room-order")).toBeNull();

        // Clicking the icon selects the room, exactly as before the badge existed.
        iconWrapper("1").dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
        await settle(card.element);

        expect(iconWrapper("1").querySelector(".room-order")?.textContent?.trim()).toBe("1");
        expect(iconWrapper("1").querySelector("ha-icon")).toBeNull();
        // The number lives in the icon slot, not above the label, for a room that has an icon.
        expect(roomElement(card, "1").querySelectorAll(".room-order")).toHaveLength(1);
    });

    it("does not number a room that cannot be selected once the selection limit is reached", async () => {
        const { card, hass } = await mountCleaningOrderCard({
            map_modes: [{ template: "vacuum_clean_segment", max_selections: 2 }],
        });

        await clickRooms(card, ["2", "0"]);
        expect(badges(card)).toEqual({ "2": "1", "0": "2" });

        // The third room is refused before it is selected, so it must stay unselected and unnumbered.
        await clickRoom(card, "1");
        expect(badge(card, "1")).toBeUndefined();
        expect(roomElement(card, "1").classList.contains("selected")).toBe(false);

        await runSelection(card);
        expect(calledSegments(hass)).toEqual([2, 0]);
    });
});
