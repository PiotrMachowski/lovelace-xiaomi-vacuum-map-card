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

function defaultTemplates(platform: string | undefined): Array<string | undefined> {
    return PlatformGenerator.generateDefaultModes(platform ?? "").map(mode => mode.template);
}

describe("editor room-config generation", () => {
    it("does not mutate Home Assistant's frozen map_modes (#956)", async () => {
        useHarnessClock();
        const fixture = loadSyntheticFixture();
        const baseConfig = fixtureConfig(fixture);
        const roomsTemplate = PlatformGenerator.getRoomsTemplate(baseConfig.vacuum_platform as string);
        expect(roomsTemplate).toBeDefined();
        const [defaultTemplate] = defaultTemplates(baseConfig.vacuum_platform);

        const modes = freezeModes([
            { template: defaultTemplate },
            { template: roomsTemplate, predefined_selections: [] },
        ]);
        const config: XiaomiVacuumMapCardConfig = { ...baseConfig, map_modes: modes };
        const modesSnapshot = JSON.parse(JSON.stringify(modes));
        const editor = await mountEditor(config, fixtureHass(fixture));

        const configChanges: XiaomiVacuumMapCardConfig[] = [];
        editor.element.addEventListener("config-changed", event => {
            configChanges.push((event as CustomEvent<{ config: XiaomiVacuumMapCardConfig }>).detail.config);
        });

        const roomConfig: RoomConfigEventData = { modeIndex: 1, rooms: generatedRooms(), entity: baseConfig.entity };
        const captured = captureWindowErrors();
        fireRoomConfig(roomConfig);
        await settle(editor.element);
        captured.stop();

        // Generating rooms works against a frozen config, and leaves it untouched.
        expect(captured.errors).toEqual([]);
        expect(config.map_modes).toEqual(modesSnapshot);
        expect(configChanges).toHaveLength(1);

        // The emitted config is a copy: a new array, a new ROOM mode object, while the
        // untouched default mode keeps its identity.
        const emitted = configChanges[0].map_modes ?? [];
        expect(emitted).not.toBe(config.map_modes);
        expect(emitted[0]).toBe(config.map_modes?.[0]);
        expect(emitted[1]).not.toBe(config.map_modes?.[1]);
        expect(emitted[1].predefined_selections).toEqual(generatedRooms());
        expect(config.map_modes?.[1].predefined_selections).toEqual([]);
    });

    it("does not mutate an empty frozen map_modes array (#956)", async () => {
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
        fireRoomConfig({ modeIndex: 0, rooms: generatedRooms(), entity: baseConfig.entity });
        await settle(editor.element);
        captured.stop();

        expect(captured.errors).toEqual([]);
        expect(config.map_modes).toEqual(modesSnapshot);
        expect(configChanges).toHaveLength(1);
        expect(configChanges[0].map_modes?.map(mode => mode.template)).toEqual([
            ...defaultTemplates(baseConfig.vacuum_platform),
            roomsTemplate,
        ]);
        const roomsModes = configChanges[0].map_modes?.filter(mode => mode.template === roomsTemplate) ?? [];
        expect(roomsModes).toHaveLength(1);
        expect(roomsModes[0].predefined_selections).toHaveLength(1);
    });
});
