import { describe, expect, it } from "vitest";

import type { XiaomiVacuumMapCardConfig } from "../../src/types/types";
import type { CardHandle } from "../harness";
import {
    cameraEntity,
    extractorRoom,
    fixtureConfig,
    fixtureHass,
    loadSyntheticFixture,
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
 * The second preset here uses its own camera entity, which is the strongest form of the same bug:
 * every room id and label differs, so a stale selection cannot accidentally look correct.
 */

const SECOND_CAMERA = "camera.vacuum_upstairs";

const FIRST_ROOM_IDS = ["0", "1", "2"];
const SECOND_ROOM_IDS = ["7", "8", "9"];

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
});
