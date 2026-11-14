import { describe, expect, it, vi } from "vitest";

import type { XiaomiVacuumMapCardConfig } from "../../src/types/types";
import { RoomColorDetector, type RoomColorDetection } from "../../src/model/room-color-detector";
import type { CardHandle } from "../harness";
import {
    cameraEntity,
    extractorRoom,
    fixtureConfig,
    fixtureHass,
    loadSyntheticFixture,
    loadSyntheticShiftedRoomIdsCamera,
    mountCard,
    selectPreset,
    syntheticCalibrationPoints,
    useHarnessClock,
    withState,
} from "../harness";

/**
 * Rooms refresh when the active preset switches camera (issue #385).
 *
 * The reported setup is a multi-map vacuum: two presets, each with the same camera entity but a
 * different loaded map. The fork detects rooms per camera identity (camera id, `last_updated` and
 * `entity_picture`) and rebuilds the selectable rooms when that identity changes, so switching the
 * preset must show the new map's rooms without toggling map modes as the old workaround required.
 *
 * Two tests cover the two shapes of the bug: a second preset with its own camera entity (every id
 * and label differs, so a stale selection cannot accidentally look correct), and the same camera
 * entity reporting a new map (`load_multi_map`), which only the camera-identity refresh can catch.
 */

const SECOND_CAMERA = "camera.vacuum_upstairs";

const FIRST_ROOM_IDS = ["0", "1", "2"];
const SECOND_ROOM_IDS = ["7", "8", "9"];
const SHIFTED_ROOM_IDS = ["3", "4", "5"];

function upstairsRooms(): Record<string, ReturnType<typeof extractorRoom>> {
    return {
        "7": extractorRoom(200, 200, 800, 700, "Office"),
        "8": extractorRoom(1000, 200, 1700, 700, "Loft"),
        "9": extractorRoom(200, 900, 800, 1300, "Bathroom"),
    };
}

function roomsConfig(): XiaomiVacuumMapCardConfig {
    const fixture = loadSyntheticFixture();
    const base = fixtureConfig(fixture);
    return {
        ...base,
        preset_name: "Downstairs",
        map_modes: [{ template: "vacuum_clean_segment" }],
        tiles: [],
        icons: [],
        persist_map_view: false,
        additional_presets: [
            {
                ...base,
                preset_name: "Upstairs",
                map_source: { camera: SECOND_CAMERA },
                calibration_source: { camera: true },
                map_modes: [{ template: "vacuum_clean_segment" }],
                tiles: [],
                icons: [],
            },
        ],
    };
}

function roomIds(card: CardHandle): string[] {
    return Array.from(card.shadowRoot.querySelectorAll(".room-wrapper"))
        .map(element => element.getAttribute("class") ?? "")
        .map(className => /room-([^\s]+)-wrapper/.exec(className)?.[1])
        .filter((id): id is string => id !== undefined);
}

/** The same config with a second preset that keeps the first preset's camera entity. */
function sameCameraConfig(): XiaomiVacuumMapCardConfig {
    const fixture = loadSyntheticFixture();
    const base = fixtureConfig(fixture);
    return {
        ...base,
        preset_name: "Downstairs",
        map_modes: [{ template: "vacuum_clean_segment" }],
        tiles: [],
        icons: [],
        persist_map_view: false,
        additional_presets: [
            {
                ...base,
                preset_name: "Upstairs",
                map_modes: [{ template: "vacuum_clean_segment" }],
                tiles: [],
                icons: [],
            },
        ],
    };
}

/**
 * A detection the card can hold without a canvas. happy-dom returns no 2D context, so
 * `RoomColorDetector.detect` yields nothing there and the refresh below it never runs; the test
 * stubs exactly that pixel step and leaves the camera-identity decision around it real.
 */
function stubDetection(): RoomColorDetection {
    return {
        imageData: { width: 0, height: 0, data: new Uint8ClampedArray(0) },
        regions: [],
        roomIdByColor: new Map(),
        labels: new Int16Array(0),
        labelRoomIds: [],
    };
}

function roomLabel(card: CardHandle, id: string): string | undefined {
    return card.shadowRoot.querySelector(`.room-${id}-wrapper .room-label`)?.textContent?.trim() || undefined;
}

describe("room refresh on preset switch (#385)", () => {
    it("takes the rooms from the camera of the preset that was switched to", async () => {
        useHarnessClock();
        const fixture = loadSyntheticFixture();
        const upstairs = cameraEntity({
            entity_id: SECOND_CAMERA,
            rooms: upstairsRooms(),
            calibration_points: syntheticCalibrationPoints(),
        });
        const hass = withState(fixtureHass(fixture), SECOND_CAMERA, {
            attributes: upstairs.attributes,
            last_updated: upstairs.last_updated,
            last_changed: upstairs.last_changed,
        }).hass;
        const card = await mountCard(roomsConfig(), hass);
        await card.fireMapLoad();

        expect(roomIds(card)).toEqual(FIRST_ROOM_IDS);
        expect(roomLabel(card, "0")).toBe("Kitchen");

        await selectPreset(card, 1);
        await card.fireMapLoad();

        expect(card.element._getCurrentPreset().map_source.camera).toBe(SECOND_CAMERA);
        expect(roomIds(card)).toEqual(SECOND_ROOM_IDS);
        expect(roomLabel(card, "7")).toBe("Office");
        expect(roomLabel(card, "8")).toBe("Loft");
        // No room from the preset that was left behind survives on the map.
        for (const id of FIRST_ROOM_IDS) expect(roomLabel(card, id)).toBeUndefined();
    });

    it("refreshes the rooms when the same camera reports a new map", async () => {
        useHarnessClock();
        const fixture = loadSyntheticFixture();
        const detect = vi.spyOn(RoomColorDetector, "detect").mockReturnValue(stubDetection());
        const card = await mountCard(sameCameraConfig(), fixtureHass(fixture));
        await card.fireMapLoad();

        expect(roomIds(card)).toEqual(FIRST_ROOM_IDS);
        expect(detect).toHaveBeenCalledTimes(1);

        // Both presets point at the same camera entity, so the preset switch rebuilds the rooms
        // from unchanged metadata. Anything that changes after this point came from the camera
        // identity refresh, not from `_setPresetIndex`.
        await selectPreset(card, 1);
        await card.fireMapLoad();
        expect(card.element._getCurrentPreset().map_source.camera).toBe(fixture.camera.entity_id);
        expect(roomIds(card)).toEqual(FIRST_ROOM_IDS);

        // The camera keeps its entity id but reports a new map: new rooms, new `last_updated` and a
        // new `entity_picture`, which is what `load_multi_map` does on a multi-map vacuum.
        const shifted = loadSyntheticShiftedRoomIdsCamera();
        const shiftedAttributes = {
            ...shifted.attributes,
            entity_picture: `${String(shifted.attributes.entity_picture)}&map=second`,
        };
        const next = withState(card.hass, fixture.camera.entity_id, {
            attributes: shiftedAttributes,
            last_updated: shifted.last_updated,
            last_changed: shifted.last_changed,
        }).hass;
        await card.updateHass(next);
        // The new map's URL only loads in a browser; dispatching the load is what runs the
        // detection that decides whether the rooms need rebuilding.
        await card.fireMapLoad();

        expect(detect).toHaveBeenCalledTimes(2);
        expect(Object.keys(detect.mock.calls[1][1] as Record<string, unknown>)).toEqual(SHIFTED_ROOM_IDS);
        expect(roomIds(card)).toEqual(SHIFTED_ROOM_IDS);
        expect(roomLabel(card, "3")).toBe("Kitchen");
        expect(roomLabel(card, "4")).toBe("Living room");
        for (const id of FIRST_ROOM_IDS) expect(roomLabel(card, id)).toBeUndefined();
    });
});
