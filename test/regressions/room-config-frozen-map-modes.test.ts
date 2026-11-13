import { describe, expect, it } from "vitest";

import { PlatformGenerator } from "../../src/model/generators/platform-generator";
import type { MapModeConfig, RoomConfig, RoomConfigEventData, XiaomiVacuumMapCardConfig } from "../../src/types/types";
import {
    captureWindowErrors,
    fireRoomConfig,
    fixtureConfig,
    fixtureHass,
    loadSyntheticFixture,
    mountEditor,
    settle,
    useHarnessClock,
} from "../harness";

/** Freezes the array and every mode object, like Home Assistant's config does. */
function freezeModes(modes: MapModeConfig[]): MapModeConfig[] {
    modes.forEach(mode => Object.freeze(mode));
    return Object.freeze(modes) as MapModeConfig[];
}

function generatedRooms(): RoomConfig[] {
    return [
        {
            id: "0",
            icon: { name: "mdi:broom", x: 50, y: 45 },
            label: { text: "Kitchen", x: 50, y: 45, offset_y: 35 },
            outline: [
                [20, 20],
                [80, 20],
                [80, 70],
                [20, 70],
            ],
        },
    ];
}

describe("editor room-config generation", () => {
    // Expected failure on purpose: upstream PR #956 is not in this fork yet. The editor writes
    // into Home Assistant's frozen `map_modes`, so the test body throws before its assertions.
    // Batch B2 ports #956 and flips this back to a normal `it`, which then proves the copy.
    it.fails("does not mutate Home Assistant's frozen map_modes (#956)", async () => {
        useHarnessClock();
        const fixture = loadSyntheticFixture();
        const baseConfig = fixtureConfig(fixture);
        const roomsTemplate = PlatformGenerator.getRoomsTemplate(baseConfig.vacuum_platform as string);
        expect(roomsTemplate).toBeDefined();

        const modes = freezeModes([{ template: roomsTemplate, predefined_selections: [] }]);
        const config: XiaomiVacuumMapCardConfig = { ...baseConfig, map_modes: modes };
        const modesSnapshot = JSON.parse(JSON.stringify(modes));
        const editor = await mountEditor(config, fixtureHass(fixture));

        const configChanges: XiaomiVacuumMapCardConfig[] = [];
        editor.element.addEventListener("config-changed", event => {
            configChanges.push((event as CustomEvent<{ config: XiaomiVacuumMapCardConfig }>).detail.config);
        });

        const roomConfig: RoomConfigEventData = { modeIndex: 0, rooms: generatedRooms() };
        const captured = captureWindowErrors();
        fireRoomConfig(roomConfig);
        await settle(editor.element);
        captured.stop();

        // Desired behaviour: generating rooms works against a frozen config, and leaves it untouched.
        expect(captured.errors).toEqual([]);
        expect(config.map_modes).toEqual(modesSnapshot);
        expect(configChanges).toHaveLength(1);
        expect(configChanges[0].map_modes?.[0].predefined_selections).toHaveLength(1);
    });

    // Expected failure on purpose for the same upstream PR #956 bug. An empty frozen array takes
    // the `map_modes.push(...)` branch in `_handleRoomConfig`, not the
    // `map_modes[modeIndex] = ...` branch covered above. B2 flips both tests to normal `it`s.
    it.fails("does not mutate an empty frozen map_modes array (#956)", async () => {
        useHarnessClock();
        const fixture = loadSyntheticFixture();
        const baseConfig = fixtureConfig(fixture);
        const roomsTemplate = PlatformGenerator.getRoomsTemplate(baseConfig.vacuum_platform as string);
        expect(roomsTemplate).toBeDefined();

        const modes = freezeModes([]);
        const config: XiaomiVacuumMapCardConfig = { ...baseConfig, map_modes: modes };
        const modesSnapshot = JSON.parse(JSON.stringify(modes));
        const editor = await mountEditor(config, fixtureHass(fixture));

        const configChanges: XiaomiVacuumMapCardConfig[] = [];
        editor.element.addEventListener("config-changed", event => {
            configChanges.push((event as CustomEvent<{ config: XiaomiVacuumMapCardConfig }>).detail.config);
        });

        const captured = captureWindowErrors();
        fireRoomConfig({ modeIndex: 0, rooms: generatedRooms() });
        await settle(editor.element);
        captured.stop();

        expect(captured.errors).toEqual([]);
        expect(config.map_modes).toEqual(modesSnapshot);
        expect(configChanges).toHaveLength(1);
        const roomsModes = configChanges[0].map_modes?.filter(mode => mode.template === roomsTemplate) ?? [];
        expect(roomsModes).toHaveLength(1);
        expect(roomsModes[0].predefined_selections).toHaveLength(1);
    });
});
