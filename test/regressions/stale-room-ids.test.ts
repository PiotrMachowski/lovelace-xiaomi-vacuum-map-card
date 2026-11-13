import { describe, expect, it, vi } from "vitest";

import type { RoomConfig, XiaomiVacuumMapCardConfig } from "../../src/types/types";
import { SelectionState } from "../../src/types/types";
import type { CardHandle, MockHass } from "../harness";
import {
    fixtureConfig,
    fixtureHass,
    loadSyntheticFixture,
    loadSyntheticShiftedRoomIdsCamera,
    mountCard,
    settle,
    useHarnessClock,
    withState,
} from "../harness";

/**
 * Stale ROOM selections (issue #928).
 *
 * After a re-map, the camera's `rooms` metadata can carry different ids for the same physical
 * rooms (Dreame never reuses a deleted segment id). A ROOM mode whose `predefined_selections` were
 * generated against the old map must not clean by an id that no longer exists, and it must not
 * guess which new id belongs to which configured room: a rename plus an id shift would silently
 * clean the wrong room. The card warns instead, marks the stale room and keeps the id out of the
 * service call.
 */

const BEFORE_FIXTURE = loadSyntheticFixture();
const SHIFTED_CAMERA = loadSyntheticShiftedRoomIdsCamera();

/** A configured ROOM selection in vacuum coordinates, matching the synthetic fixture's geometry. */
function configuredRoom(id: string, text: string, selectedByDefault = false): RoomConfig {
    const [x0, y0, x1, y1] = id === "0" || id === "3" ? [200, 200, 800, 700] : [1000, 200, 1700, 700];
    const x = (x0 + x1) / 2;
    const y = (y0 + y1) / 2;
    return {
        id,
        label: { text, x, y, offset_y: 35 },
        icon: { name: "mdi:broom", x, y },
        outline: [
            [x0, y0],
            [x1, y0],
            [x1, y1],
            [x0, y1],
        ],
        ...(selectedByDefault ? { default_state: SelectionState.SELECTED } : {}),
    };
}

function roomsConfig(selections: RoomConfig[]): XiaomiVacuumMapCardConfig {
    return {
        ...fixtureConfig(BEFORE_FIXTURE),
        map_modes: [{ template: "vacuum_clean_segment", predefined_selections: selections }],
        tiles: [],
        icons: [],
        persist_map_view: false,
    };
}

/** Mounts with the camera metadata a re-map would leave behind (`3,4,5` instead of `0,1,2`). */
async function mountAfterRemap(
    selections: RoomConfig[],
): Promise<{ card: CardHandle; hass: MockHass }> {
    useHarnessClock();
    const hass = withState(fixtureHass(BEFORE_FIXTURE), SHIFTED_CAMERA.entity_id, {
        attributes: SHIFTED_CAMERA.attributes,
        last_updated: SHIFTED_CAMERA.last_updated,
        last_changed: SHIFTED_CAMERA.last_changed,
    }).hass;
    const card = await mountCard(roomsConfig(selections), hass);
    await card.fireMapLoad();
    return { card, hass };
}

function roomElement(card: CardHandle, id: string): Element | null {
    return card.shadowRoot.querySelector(`.room-${id}-wrapper`);
}

async function clickRoom(card: CardHandle, id: string): Promise<void> {
    const element = roomElement(card, id);
    if (!element) throw new Error(`room ${id} is not rendered`);
    const polygon = element.querySelector(".room-outline");
    if (!polygon) throw new Error(`room ${id} has no clickable outline`);
    polygon.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
    await settle(card.element);
}

/** Presses the card's own run control and lets its action handler fire. */
async function runSelection(card: CardHandle): Promise<void> {
    const button = card.shadowRoot.querySelector(".map-actions-item.main");
    if (!button) throw new Error("the card has no run button");
    button.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
    await settle(card.element, 400);
}

/** The room ids the card passed to the last service call, in payload order. */
function calledSegments(hass: MockHass): unknown[] {
    const calls = vi.mocked(hass.callService).mock.calls;
    expect(calls.length, "expected at least one service call").toBeGreaterThan(0);
    const [, service, serviceData] = calls[calls.length - 1];
    expect(service).toBe("vacuum_clean_segment");
    return (serviceData as unknown as { segments: unknown[] }).segments;
}

function roomConfigWarning(card: CardHandle): string | undefined {
    return card.shadowRoot.querySelector(".room-config-warning")?.textContent?.trim() || undefined;
}

describe("stale ROOM selections (#928)", () => {
    it("marks a stale room, warns with its id and never sends it", async () => {
        // The old Kitchen id (0) no longer exists; the shifted metadata calls the same room id 3.
        const { card, hass } = await mountAfterRemap([configuredRoom("0", "Kitchen", true)]);

        expect(roomElement(card, "0")?.classList.contains("room-stale")).toBe(true);
        expect(roomElement(card, "0")?.querySelector(".room-stale-marker")?.textContent?.trim()).toBe("!");
        const warning = roomConfigWarning(card);
        expect(warning).toContain("0");
        expect(warning).toBeTruthy();

        // `default_state: selected` on the stale room is ignored; the live rooms stay selectable.
        expect(card.element._getSelection(card.element._getCurrentMode()).selection).toEqual([]);
        expect(roomElement(card, "0")?.classList.contains("selected")).toBe(false);

        await clickRoom(card, "5");
        await clickRoom(card, "4");
        await runSelection(card);

        expect(calledSegments(hass)).toEqual([5, 4]);
        expect(calledSegments(hass)).not.toContain(0);
    });

    it("keeps live rooms in click order while excluding a stale selection", async () => {
        const { card, hass } = await mountAfterRemap([
            configuredRoom("3", "Kitchen", true),
            configuredRoom("0", "Old kitchen", true),
        ]);

        // The live configured room is still selected by the configuration and clickable.
        expect(roomElement(card, "3")?.classList.contains("room-stale")).toBe(false);
        expect(card.element._getSelection(card.element._getCurrentMode()).selection).toEqual([3]);

        await clickRoom(card, "5");
        await runSelection(card);

        expect(calledSegments(hass)).toEqual([3, 5]);
        expect(roomConfigWarning(card)).toContain("0");
    });

    it("does not warn when every configured id is still live", async () => {
        const { card, hass } = await mountAfterRemap([
            configuredRoom("3", "Kitchen"),
            configuredRoom("4", "Living room"),
        ]);

        expect(roomConfigWarning(card)).toBeUndefined();
        expect(roomElement(card, "3")?.classList.contains("room-stale")).toBe(false);

        await clickRoom(card, "4");
        await runSelection(card);
        expect(calledSegments(hass)).toEqual([4]);
    });

    it("does not warn or exclude when the camera exposes no rooms metadata", async () => {
        useHarnessClock();
        const attributes = { ...BEFORE_FIXTURE.camera.attributes };
        delete (attributes as Record<string, unknown>).rooms;
        const hass = withState(fixtureHass(BEFORE_FIXTURE), BEFORE_FIXTURE.camera.entity_id, {
            attributes,
        }).hass;
        const card = await mountCard(roomsConfig([configuredRoom("0", "Kitchen")]), hass);
        await card.fireMapLoad();

        // Without metadata the card keeps its documented fallback to the configured rooms, so the
        // configured id is usable and there is nothing to warn about.
        expect(roomConfigWarning(card)).toBeUndefined();
        expect(roomElement(card, "0")?.classList.contains("room-stale")).toBe(false);

        await clickRoom(card, "0");
        await runSelection(card);
        expect(calledSegments(hass)).toEqual([0]);
    });

    it("excludes a room selected before the ids shifted from the next service call", async () => {
        useHarnessClock();
        const hassBefore = fixtureHass(BEFORE_FIXTURE);
        const card = await mountCard(roomsConfig([configuredRoom("0", "Kitchen", true)]), hassBefore);
        await card.fireMapLoad();

        // Room 0 is live in the old metadata, so it is selected by the configuration and sent.
        expect(roomConfigWarning(card)).toBeUndefined();
        expect(card.element._getSelection(card.element._getCurrentMode()).selection).toEqual([0]);

        // A re-map shifts the metadata; the card's selection has not been rebuilt yet, so the
        // stale id is still in `selectedRooms`. The payload and the warning must not trust it.
        const hassAfter = withState(hassBefore, SHIFTED_CAMERA.entity_id, {
            attributes: SHIFTED_CAMERA.attributes,
            last_updated: SHIFTED_CAMERA.last_updated,
            last_changed: SHIFTED_CAMERA.last_changed,
        }).hass;
        await card.updateHass(hassAfter);

        expect(card.element._getSelection(card.element._getCurrentMode()).selection).toEqual([]);
        await runSelection(card);
        // No call at all is correct: the only selected room was stale, so the card reports "no
        // selection" instead of cleaning an id that now belongs to nothing (or another room).
        expect(vi.mocked(hassAfter.callService)).not.toHaveBeenCalled();
        expect(roomConfigWarning(card)).toContain("0");
    });
});
