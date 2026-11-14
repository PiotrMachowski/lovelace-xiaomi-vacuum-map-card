import { describe, expect, it, vi } from "vitest";

import { addRectangle } from "../../src/card/selection";
import type { MapModeConfig, XiaomiVacuumMapCardConfig } from "../../src/types/types";
import type { CardHandle, MockHass } from "../harness";
import {
    extractorRoom,
    fixtureConfig,
    fixtureHass,
    loadSyntheticFixture,
    mountCard,
    settle,
    syntheticRooms,
    useHarnessClock,
    withState,
} from "../harness";

/**
 * Selection state across rebuilds.
 *
 * The card rebuilds its selectable objects (rooms, predefined zones and points) on many paths: a
 * hass update of an entity behind a selection, a camera refresh, a change of the camera `rooms`
 * metadata, and a config re-set by the editor or the dashboard. Each rebuild used to start a fresh
 * selection, so the user's choice was lost or reordered without a click (1.0.2 fixed the camera
 * refresh only). The rule tested here:
 *
 *   A selection changes only when the user changes it (a click, a mode or preset switch, the clear
 *   action, a run with `clean_selection_on_start`) or when the thing it refers to disappears; then
 *   only that item is dropped and the rest keep their order. An item behind a `state_entity`
 *   follows its entity.
 */

const SERVICE_CALL = {
    service: "vacuum.send_command",
    service_data: { entity_id: "[[entity_id]]", command: "test", params: "[[selection]]" },
};

const ROOM_ENTITY = "input_boolean.clean_living_room";
const ZONE_ENTITY = "input_boolean.clean_hallway";
const POINT_ENTITY = "input_boolean.go_to_sofa";
const ZONES_SOURCE = "sensor.vacuum_zones";
const POINTS_SOURCE = "sensor.vacuum_points";
const VACUUM = "vacuum.roborock_s7";
const CAMERA = "camera.vacuum_map";

function mode(config: Partial<MapModeConfig> & { selection_type: string }): MapModeConfig {
    return {
        name: config.selection_type,
        icon: "mdi:broom",
        repeats_type: "NONE",
        service_call_schema: SERVICE_CALL,
        ...config,
    } as MapModeConfig;
}

const ROOM_MODE_METADATA = mode({ selection_type: "ROOM" });

/** Rooms 0 and 2 are plain; room 1 follows `ROOM_ENTITY`. They all exist in the camera metadata. */
const ROOM_MODE_CONFIGURED = mode({
    selection_type: "ROOM",
    predefined_selections: [
        { id: 0, outline: [[200, 200], [800, 200], [800, 700], [200, 700]] },
        { id: 1, outline: [[1000, 200], [1700, 200], [1700, 700], [1000, 700]], state_entity: ROOM_ENTITY },
        { id: 2, outline: [[200, 900], [800, 900], [800, 1300], [200, 1300]] },
    ],
} as never);

const ZONE_A = [100, 100, 300, 300];
const ZONE_B = [400, 100, 600, 300];
const ZONE_C = [700, 100, 900, 300];
const ZONE_HALL = [100, 1000, 300, 1200];

const RECTANGLE_MODE = mode({
    selection_type: "PREDEFINED_RECTANGLE",
    predefined_selections: [
        { zones: [ZONE_A] },
        { zones: [ZONE_B] },
        { zones: [ZONE_C] },
        { zones: [ZONE_HALL], state_entity: ZONE_ENTITY },
        { zones: `${ZONES_SOURCE}.attributes.zones` },
    ],
} as never);

const POINT_A = [500, 500];
const POINT_SOFA = [1200, 600];

const POINT_MODE = mode({
    selection_type: "PREDEFINED_POINT",
    predefined_selections: [
        { position: POINT_A },
        { position: POINT_SOFA, state_entity: POINT_ENTITY },
        { position: `${POINTS_SOURCE}.attributes.points` },
    ],
} as never);

const MANUAL_RECTANGLE_MODE = mode({ selection_type: "MANUAL_RECTANGLE" });
const MANUAL_PATH_MODE = mode({ selection_type: "MANUAL_PATH" });
const MANUAL_POINT_MODE = mode({ selection_type: "MANUAL_POINT" });

interface CardInternals {
    _getSelection(mode: unknown): { selection: unknown[] };
    _getCurrentMode(): unknown;
    _handleLovelaceDomEvent(event: Event): Promise<void>;
    selectedMode: number;
    selectedRooms: Array<{ toVacuum(): unknown }>;
}

function internals(card: CardHandle): CardInternals {
    return card.element as unknown as CardInternals;
}

function baseHass(): MockHass {
    let hass = fixtureHass(loadSyntheticFixture());
    hass = withState(hass, ROOM_ENTITY, { state: "off" }).hass;
    hass = withState(hass, ZONE_ENTITY, { state: "off" }).hass;
    hass = withState(hass, POINT_ENTITY, { state: "off" }).hass;
    hass = withState(hass, ZONES_SOURCE, { state: "ok", attributes: { zones: [[1000, 1000, 1200, 1200]] } }).hass;
    hass = withState(hass, POINTS_SOURCE, { state: "ok", attributes: { points: [[1500, 1000]] } }).hass;
    return hass;
}

function cardConfig(modes: MapModeConfig[], overrides: Partial<XiaomiVacuumMapCardConfig> = {}): XiaomiVacuumMapCardConfig {
    return {
        ...fixtureConfig(loadSyntheticFixture()),
        map_modes: modes,
        tiles: [],
        icons: [],
        persist_map_view: false,
        ...overrides,
    };
}

async function mount(
    modes: MapModeConfig[],
    overrides: Partial<XiaomiVacuumMapCardConfig> = {},
    hass: MockHass = baseHass(),
): Promise<CardHandle> {
    useHarnessClock();
    const card = await mountCard(cardConfig(modes, overrides), hass);
    await card.fireMapLoad();
    return card;
}

function selection(card: CardHandle): unknown[] {
    const element = internals(card);
    return element._getSelection(element._getCurrentMode()).selection;
}

/** Selected room ids, in the order the card keeps them (the cleaning order). */
function roomOrder(card: CardHandle): string[] {
    return internals(card).selectedRooms.map(room => String(room.toVacuum()));
}

/** The badge numbers drawn on the map, keyed by room id. */
function badges(card: CardHandle): Record<string, string> {
    const result: Record<string, string> = {};
    card.shadowRoot.querySelectorAll(".room-wrapper").forEach(wrapper => {
        const id = /room-([^\s]+)-wrapper/.exec(wrapper.getAttribute("class") ?? "")?.[1];
        const badge = wrapper.querySelector(".room-order")?.textContent?.trim();
        if (id && badge) result[id] = badge;
    });
    return result;
}

async function click(card: CardHandle, element: Element | null | undefined, label: string): Promise<void> {
    if (!element) throw new Error(`${label} is not rendered`);
    element.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
    await settle(card.element);
}

async function clickRoom(card: CardHandle, id: string): Promise<void> {
    await click(card, card.shadowRoot.querySelector(`.room-${id}-wrapper .room-outline`), `room ${id}`);
}

/** Clicks the predefined zone whose first polygon is the `index`-th rendered zone. */
async function clickZone(card: CardHandle, index: number): Promise<void> {
    const wrappers = card.shadowRoot.querySelectorAll(".predefined-rectangle-wrapper");
    await click(card, wrappers[index]?.querySelector(".predefined-rectangle"), `zone ${index}`);
}

async function clickPoint(card: CardHandle, index: number): Promise<void> {
    const wrappers = card.shadowRoot.querySelectorAll(".predefined-point-wrapper");
    await click(card, wrappers[index]?.querySelector(".predefined-point-icon-wrapper"), `point ${index}`);
}

/** Taps the map at a position in the SVG overlay, as a MANUAL_PATH / MANUAL_POINT mode reads it. */
async function tapMap(card: CardHandle, x: number, y: number): Promise<void> {
    const svg = card.shadowRoot.getElementById("svg-wrapper");
    if (!svg) throw new Error("the map overlay is not rendered");
    svg.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, composed: true, button: 0, clientX: x, clientY: y }));
    svg.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, composed: true, button: 0, clientX: x, clientY: y }));
    await settle(card.element);
}

async function setState(card: CardHandle, entityId: string, patch: Parameters<typeof withState>[2]): Promise<void> {
    await card.updateHass(withState(card.hass, entityId, patch).hass);
    await settle(card.element);
}

/** A hass update that touches only the vacuum, which every card watches. */
async function unrelatedUpdate(card: CardHandle): Promise<void> {
    await setState(card, VACUUM, { attributes: { ...card.hass.states[VACUUM].attributes, battery_level: 42 } });
}

/** Re-sets the card's config the way the editor preview or a dashboard re-render does. */
async function resetConfig(card: CardHandle, config: XiaomiVacuumMapCardConfig): Promise<void> {
    card.element.setConfig(config);
    await settle(card.element, 300);
}

async function dispatchAction(card: CardHandle, action: string, data: Record<string, unknown> = {}): Promise<void> {
    const event = new CustomEvent("ll-custom", {
        detail: { xiaomi_vacuum_map_card: { action_handler_id: "this", action, data } },
    });
    await internals(card)._handleLovelaceDomEvent(event);
    await settle(card.element);
}

async function runSelection(card: CardHandle): Promise<void> {
    const button = card.shadowRoot.querySelector(".map-actions-item.main");
    if (!button) throw new Error("the card has no run button");
    button.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
    await settle(card.element, 400);
}

describe("ROOM selections across rebuilds", () => {
    it("keeps click order through an unrelated hass update and a card re-attach", async () => {
        const card = await mount([ROOM_MODE_METADATA]);
        await clickRoom(card, "2");
        await clickRoom(card, "0");

        await unrelatedUpdate(card);
        expect(roomOrder(card)).toEqual(["2", "0"]);

        const parent = card.element.parentElement!;
        card.element.remove();
        await settle();
        parent.appendChild(card.element);
        await settle(card.element, 300);
        expect(roomOrder(card)).toEqual(["2", "0"]);
        expect(badges(card)).toEqual({ "2": "1", "0": "2" });
    });

    it("keeps the user's rooms when a state-entity room changes, and adds that room at the end", async () => {
        const card = await mount([ROOM_MODE_CONFIGURED]);
        await clickRoom(card, "2");
        await clickRoom(card, "0");
        expect(roomOrder(card)).toEqual(["2", "0"]);

        // An automation (not this card) turns the room's boolean on.
        await setState(card, ROOM_ENTITY, { state: "on" });
        expect(roomOrder(card)).toEqual(["2", "0", "1"]);
        expect(badges(card)).toEqual({ "2": "1", "0": "2", "1": "3" });

        // An attribute-only change of that entity rebuilds the rooms again; nothing may move.
        await setState(card, ROOM_ENTITY, { attributes: { friendly_name: "Living room" } });
        expect(roomOrder(card)).toEqual(["2", "0", "1"]);

        // Turned off elsewhere: only that room leaves, the others keep their positions.
        await setState(card, ROOM_ENTITY, { state: "off" });
        expect(roomOrder(card)).toEqual(["2", "0"]);
        expect(badges(card)).toEqual({ "2": "1", "0": "2" });
    });

    it("does not re-select a default room the user deselected when the rooms are rebuilt", async () => {
        const defaultMode = mode({
            selection_type: "ROOM",
            predefined_selections: [
                { id: 0, outline: [[200, 200], [800, 200], [800, 700], [200, 700]], default_state: "selected" },
                { id: 1, outline: [[1000, 200], [1700, 200], [1700, 700], [1000, 700]], state_entity: ROOM_ENTITY },
                { id: 2, outline: [[200, 900], [800, 900], [800, 1300], [200, 1300]] },
            ],
        } as never);
        const card = await mount([defaultMode], {}, withState(baseHass(), ROOM_ENTITY, { state: "on" }).hass);
        expect(roomOrder(card)).toEqual(["0", "1"]);

        await clickRoom(card, "0");
        await clickRoom(card, "2");
        expect(roomOrder(card)).toEqual(["1", "2"]);

        await setState(card, ROOM_ENTITY, { attributes: { friendly_name: "Living room" } });
        expect(roomOrder(card)).toEqual(["1", "2"]);
    });

    it("drops only a room that disappears from the camera metadata, keeping the others in order", async () => {
        const card = await mount([ROOM_MODE_METADATA]);
        await clickRoom(card, "2");
        await clickRoom(card, "0");
        await clickRoom(card, "1");

        const rooms = syntheticRooms();
        delete rooms["0"];
        rooms["5"] = extractorRoom(1000, 900, 1700, 1300, "Office");
        await setState(card, CAMERA, {
            attributes: { ...card.hass.states[CAMERA].attributes, rooms },
            last_updated: "2026-11-01T10:05:00.000Z",
        });

        expect(roomOrder(card)).toEqual(["2", "1"]);
        expect(badges(card)).toEqual({ "2": "1", "1": "2" });
        expect(selection(card)).toEqual(["2", "1"]);
        // The new room is on the map and can be selected after the others.
        await clickRoom(card, "5");
        expect(roomOrder(card)).toEqual(["2", "1", "5"]);
    });

    it("keeps the selection and the mode when the same config is set again", async () => {
        const config = cardConfig([MANUAL_RECTANGLE_MODE, ROOM_MODE_METADATA]);
        useHarnessClock();
        const card = await mountCard(config, baseHass());
        await card.fireMapLoad();
        await dispatchAction(card, "map_mode.set", { index: 1 });
        await clickRoom(card, "2");
        await clickRoom(card, "0");

        await resetConfig(card, { ...config });

        expect(internals(card).selectedMode).toBe(1);
        expect(roomOrder(card)).toEqual(["2", "0"]);
        expect(badges(card)).toEqual({ "2": "1", "0": "2" });
    });

    it("drops only the rooms an edited config removes", async () => {
        const config = cardConfig([ROOM_MODE_CONFIGURED]);
        useHarnessClock();
        const card = await mountCard(config, baseHass());
        await card.fireMapLoad();
        await clickRoom(card, "2");
        await clickRoom(card, "0");

        const edited = mode({
            selection_type: "ROOM",
            predefined_selections: (ROOM_MODE_CONFIGURED.predefined_selections ?? []).filter(
                room => (room as { id: number }).id !== 2,
            ),
        } as never);
        // The camera still reports room 2, so it remains a selectable metadata room; remove it there too.
        const rooms = syntheticRooms();
        delete rooms["2"];
        await setState(card, CAMERA, { attributes: { ...card.hass.states[CAMERA].attributes, rooms } });
        await resetConfig(card, cardConfig([edited]));

        expect(roomOrder(card)).toEqual(["0"]);
    });

    it("starts a new selection when the user switches mode, clears or runs", async () => {
        const card = await mount([ROOM_MODE_METADATA, MANUAL_RECTANGLE_MODE]);
        await clickRoom(card, "2");
        await dispatchAction(card, "selection.clear");
        expect(roomOrder(card)).toEqual([]);

        await clickRoom(card, "1");
        await dispatchAction(card, "map_mode.next");
        await dispatchAction(card, "map_mode.previous");
        expect(roomOrder(card)).toEqual([]);

        await clickRoom(card, "1");
        await clickRoom(card, "0");
        await runSelection(card);
        expect(vi.mocked(card.hass.callService).mock.calls.at(-1)?.[2]).toMatchObject({ params: ["1", "0"] });
        expect(roomOrder(card)).toEqual([]);
    });

    it("keeps the selection in click order after a run when clean_selection_on_start is off", async () => {
        const card = await mount([ROOM_MODE_METADATA], { clean_selection_on_start: false });
        await clickRoom(card, "2");
        await clickRoom(card, "0");
        await runSelection(card);
        expect(vi.mocked(card.hass.callService).mock.calls.at(-1)?.[2]).toMatchObject({ params: ["2", "0"] });
        expect(roomOrder(card)).toEqual(["2", "0"]);
    });

    it("refuses a room past max_selections and renumbers on deselection", async () => {
        const card = await mount([{ ...ROOM_MODE_METADATA, max_selections: 2 }]);
        await clickRoom(card, "2");
        await clickRoom(card, "0");
        await clickRoom(card, "1");
        expect(roomOrder(card)).toEqual(["2", "0"]);
        await clickRoom(card, "2");
        await clickRoom(card, "1");
        expect(roomOrder(card)).toEqual(["0", "1"]);
        expect(badges(card)).toEqual({ "0": "1", "1": "2" });
    });

    it("runs a single room immediately with run_immediately and leaves nothing selected", async () => {
        const card = await mount([{ ...ROOM_MODE_METADATA, run_immediately: true }]);
        await clickRoom(card, "1");
        expect(vi.mocked(card.hass.callService).mock.calls.at(-1)?.[2]).toMatchObject({ params: ["1"] });
        // The room is no longer selected; the map keeps it highlighted as the started run instead
        // (test/regressions/active-room-run.test.ts).
        expect(roomOrder(card)).toEqual([]);
    });
});

describe("PREDEFINED_RECTANGLE selections across rebuilds", () => {
    it("keeps the user's zones in click order when a state-entity zone changes", async () => {
        const card = await mount([RECTANGLE_MODE]);
        // The entity zone is rendered first, then ZONE_A, ZONE_B, ZONE_C and ZONE_HALL.
        await clickZone(card, 2); // ZONE_B
        const first = selection(card);
        await clickZone(card, 0);
        const both = selection(card);
        expect(both).toHaveLength(2);
        expect(both[0]).toEqual(first[0]);

        await setState(card, ZONE_ENTITY, { state: "on" });
        expect(selection(card)).toEqual([...both, ZONE_HALL]);

        await setState(card, ZONE_ENTITY, { state: "off" });
        expect(selection(card)).toEqual(both);
    });

    it("follows a changed zone source entity and keeps the zones that still exist", async () => {
        const card = await mount([RECTANGLE_MODE]);
        const entityZone = [1000, 1000, 1200, 1200];
        // The entity zones are listed first, then the configured zones.
        await clickZone(card, 1); // ZONE_A
        await clickZone(card, 0); // the entity zone
        expect(selection(card)).toEqual([ZONE_A, entityZone]);

        const newZone = [1300, 1000, 1500, 1200];
        await setState(card, ZONES_SOURCE, { attributes: { zones: [newZone, entityZone] } });
        expect(selection(card)).toEqual([ZONE_A, entityZone]);
        expect(card.shadowRoot.querySelectorAll(".predefined-rectangle-wrapper")).toHaveLength(6);

        await setState(card, ZONES_SOURCE, { attributes: { zones: [newZone] } });
        expect(selection(card)).toEqual([ZONE_A]);
        expect(card.shadowRoot.querySelectorAll(".predefined-rectangle-wrapper")).toHaveLength(5);
    });

    it("keeps zones across an unrelated update and the same config set again", async () => {
        const config = cardConfig([RECTANGLE_MODE]);
        useHarnessClock();
        const card = await mountCard(config, baseHass());
        await card.fireMapLoad();
        await clickZone(card, 3); // ZONE_C
        await clickZone(card, 1); // ZONE_A
        expect(selection(card)).toEqual([ZONE_C, ZONE_A]);

        await unrelatedUpdate(card);
        expect(selection(card)).toEqual([ZONE_C, ZONE_A]);

        await resetConfig(card, { ...config });
        expect(selection(card)).toEqual([ZONE_C, ZONE_A]);
    });
});

describe("the map after a selection is cleared", () => {
    it("redraws the cleared selection right after a run, without waiting for another update", async () => {
        const card = await mount([RECTANGLE_MODE]);
        await clickZone(card, 1);
        expect(card.shadowRoot.querySelectorAll(".predefined-rectangle-wrapper.selected")).toHaveLength(1);

        await runSelection(card);
        expect(selection(card)).toEqual([]);
        expect(card.shadowRoot.querySelectorAll(".predefined-rectangle-wrapper.selected")).toHaveLength(0);
    });
});

describe("PREDEFINED_POINT selections across rebuilds", () => {
    it("keeps the user's point when a state-entity point or the point source changes", async () => {
        const card = await mount([POINT_MODE]);
        // The entity point is rendered first, then the configured POINT_A and POINT_SOFA.
        await clickPoint(card, 1);
        expect(selection(card)).toEqual(POINT_A);

        await setState(card, POINT_ENTITY, { attributes: { friendly_name: "Sofa" } });
        expect(selection(card)).toEqual(POINT_A);

        await setState(card, POINTS_SOURCE, { attributes: { points: [[1500, 1000], [1600, 1100]] } });
        expect(selection(card)).toEqual(POINT_A);
        expect(card.shadowRoot.querySelectorAll(".predefined-point-wrapper")).toHaveLength(4);
    });
});

describe("manual selections across rebuilds", () => {
    it("keeps drawn rectangles through an update and the same config set again", async () => {
        const config = cardConfig([MANUAL_RECTANGLE_MODE]);
        useHarnessClock();
        const card = await mountCard(config, baseHass());
        await card.fireMapLoad();
        addRectangle(card.element);
        addRectangle(card.element);
        await settle(card.element);
        const drawn = selection(card);
        expect(drawn).toHaveLength(2);

        await unrelatedUpdate(card);
        expect(selection(card)).toEqual(drawn);

        await resetConfig(card, { ...config });
        expect(selection(card)).toEqual(drawn);
        expect(card.shadowRoot.querySelectorAll(".manual-rectangle-wrapper")).toHaveLength(2);
    });

    it("renumbers the remaining rectangles when one is deleted", async () => {
        const card = await mount([MANUAL_RECTANGLE_MODE]);
        for (let i = 0; i < 3; i++) addRectangle(card.element);
        await settle(card.element);
        const deleteFirst = card.shadowRoot.querySelector(".manual-rectangle-delete-circle");
        deleteFirst?.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, composed: true }));
        await settle(card.element);
        const labels = Array.from(card.shadowRoot.querySelectorAll(".manual-rectangle-description text")).map(
            text => text.textContent?.trim().split(/\s+/)[0],
        );
        expect(labels).toEqual(["1", "2"]);
    });

    it("keeps a drawn path and point through an update and the same config set again", async () => {
        for (const manualMode of [MANUAL_PATH_MODE, MANUAL_POINT_MODE]) {
            const config = cardConfig([manualMode]);
            useHarnessClock();
            const card = await mountCard(config, baseHass());
            await card.fireMapLoad();
            await tapMap(card, 20, 30);
            await tapMap(card, 60, 40);
            const drawn = selection(card);
            expect(drawn.length, manualMode.selection_type).toBeGreaterThan(0);

            await unrelatedUpdate(card);
            expect(selection(card), manualMode.selection_type).toEqual(drawn);

            await resetConfig(card, { ...config });
            expect(selection(card), manualMode.selection_type).toEqual(drawn);
            await card.cleanup();
        }
    });
});
