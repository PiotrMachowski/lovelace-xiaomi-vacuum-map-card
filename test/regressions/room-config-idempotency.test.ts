import { describe, expect, it } from "vitest";

import { PlatformGenerator } from "../../src/model/generators/platform-generator";
import type { MapModeConfig, RoomConfig, XiaomiVacuumMapCardConfig } from "../../src/types/types";
import {
    fireRoomConfig,
    fixtureConfig,
    fixtureHass,
    loadSyntheticFixture,
    mountEditor,
    mountPage,
    settle,
    useHarnessClock,
} from "../harness";

function rooms(prefix: string): RoomConfig[] {
    return [
        {
            id: "0",
            icon: { name: "mdi:broom", x: 40, y: 40 },
            label: { text: `${prefix} kitchen`, x: 40, y: 40 },
            outline: [
                [10, 10],
                [70, 10],
                [70, 60],
                [10, 60],
            ],
        },
    ];
}

function findGenerateButton(root: ShadowRoot): HTMLElement {
    const button = Array.from(root.querySelectorAll("ha-button")).find(candidate =>
        (candidate.textContent ?? "").includes("Generate rooms config"),
    );
    if (!button) throw new Error("editor did not render the Generate rooms config button");
    return button as HTMLElement;
}

async function generateRooms(editor: { element: { updateComplete?: Promise<unknown> }; shadowRoot: ShadowRoot }): Promise<void> {
    findGenerateButton(editor.shadowRoot).click();
    await settle(editor.element);
}

function templatesOf(config: XiaomiVacuumMapCardConfig | undefined): Array<string | undefined> {
    return (config?.map_modes ?? []).map((mode: MapModeConfig) => mode.template);
}

describe("editor room-config generation is idempotent", () => {
    it("generating twice leaves one ROOM mode and one copy of each default mode", async () => {
        useHarnessClock();
        const fixture = loadSyntheticFixture();
        const baseConfig = fixtureConfig(fixture);
        const roomsTemplate = PlatformGenerator.getRoomsTemplate(baseConfig.vacuum_platform as string);
        expect(roomsTemplate).toBeDefined();
        const defaults = PlatformGenerator.generateDefaultModes(baseConfig.vacuum_platform as string).map(
            mode => mode.template,
        );

        // No `map_modes` at all: the editor must build the platform defaults plus the ROOM mode.
        // `map_locked` is the "lock flag"; generating rooms must preserve it.
        const config: XiaomiVacuumMapCardConfig = { ...baseConfig, map_locked: true };
        const page = await mountPage([
            { kind: "card", config, hass: fixtureHass(fixture), inEditorPreview: true },
            { kind: "editor", config, hass: fixtureHass(fixture) },
        ]);
        const [editor] = page.editors;
        const changes: XiaomiVacuumMapCardConfig[] = [];
        editor.element.addEventListener("config-changed", event => {
            changes.push((event as CustomEvent<{ config: XiaomiVacuumMapCardConfig }>).detail.config);
        });

        await generateRooms(editor);
        await generateRooms(editor);

        expect(changes).toHaveLength(2);
        for (const changed of changes) {
            expect(changed.map_locked).toBe(true);
            expect(templatesOf(changed)).toEqual([...defaults, roomsTemplate]);
            const roomModes = (changed.map_modes ?? []).filter(mode => mode.template === roomsTemplate);
            expect(roomModes).toHaveLength(1);
            expect((roomModes[0].predefined_selections ?? []).map(selection => String((selection as RoomConfig).id))).toEqual(
                ["0", "1", "2"],
            );
        }
    });

    it("replaces the ROOM mode by template even when the answer points at another index", async () => {
        useHarnessClock();
        const fixture = loadSyntheticFixture();
        const baseConfig = fixtureConfig(fixture);
        const roomsTemplate = PlatformGenerator.getRoomsTemplate(baseConfig.vacuum_platform as string);
        expect(roomsTemplate).toBeDefined();
        const [defaultTemplate] = PlatformGenerator.generateDefaultModes(baseConfig.vacuum_platform as string);

        const modes: MapModeConfig[] = [
            { template: defaultTemplate },
            { template: roomsTemplate, predefined_selections: [] },
        ];
        const config: XiaomiVacuumMapCardConfig = { ...baseConfig, map_modes: modes };
        const editor = await mountEditor(config, fixtureHass(fixture));
        const changes: XiaomiVacuumMapCardConfig[] = [];
        editor.element.addEventListener("config-changed", event => {
            changes.push((event as CustomEvent<{ config: XiaomiVacuumMapCardConfig }>).detail.config);
        });

        fireRoomConfig({ modeIndex: 0, rooms: rooms("wrong index"), entity: baseConfig.entity });
        await settle(editor.element);

        expect(changes).toHaveLength(1);
        const emitted = changes[0].map_modes ?? [];
        const roomModes = emitted.filter(mode => mode.template === roomsTemplate);
        expect(roomModes).toHaveLength(1);
        expect(roomModes[0].predefined_selections).toEqual(rooms("wrong index"));
        // The unrelated default mode was not replaced.
        expect(emitted[0].template).toBe(defaultTemplate);
        expect(emitted[0].predefined_selections).toBeUndefined();
        expect(emitted).not.toBe(config.map_modes);
    });

    it("collapses duplicate ROOM modes left by an earlier broken generation", async () => {
        useHarnessClock();
        const fixture = loadSyntheticFixture();
        const baseConfig = fixtureConfig(fixture);
        const roomsTemplate = PlatformGenerator.getRoomsTemplate(baseConfig.vacuum_platform as string);
        expect(roomsTemplate).toBeDefined();
        const [defaultTemplate] = PlatformGenerator.generateDefaultModes(baseConfig.vacuum_platform as string);

        const config: XiaomiVacuumMapCardConfig = {
            ...baseConfig,
            map_modes: [
                { template: roomsTemplate, predefined_selections: rooms("old first") },
                { template: defaultTemplate },
                { template: roomsTemplate, predefined_selections: rooms("old duplicate") },
            ],
        };
        const editor = await mountEditor(config, fixtureHass(fixture));
        const changes: XiaomiVacuumMapCardConfig[] = [];
        editor.element.addEventListener("config-changed", event => {
            changes.push((event as CustomEvent<{ config: XiaomiVacuumMapCardConfig }>).detail.config);
        });

        fireRoomConfig({ modeIndex: 0, rooms: rooms("new"), entity: baseConfig.entity });
        await settle(editor.element);

        expect(changes).toHaveLength(1);
        const emitted = changes[0].map_modes ?? [];
        expect(emitted.map(mode => mode.template)).toEqual([roomsTemplate, defaultTemplate]);
        expect(emitted[0].predefined_selections).toEqual(rooms("new"));
    });
});
