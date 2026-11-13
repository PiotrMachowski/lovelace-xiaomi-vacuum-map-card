import { describe, expect, it } from "vitest";

import { EVENT_ROOM_CONFIG } from "../../src/const";
import type { MapExtractorRoom, RoomConfig, RoomConfigEventData, XiaomiVacuumMapCardConfig } from "../../src/types/types";
import {
    cameraEntity,
    extractorRoom,
    fixtureConfig,
    fixtureHass,
    fixtureStates,
    loadSyntheticFixture,
    mountPage,
    settle,
    syntheticCalibrationPoints,
    useHarnessClock,
    withRegistryEntries,
    withState,
} from "../harness";

const SECOND_CAMERA = "camera.vacuum_map_b";
const SECOND_VACUUM = "vacuum.roborock_s8";

const ROOMS_A = ["0", "1", "2"];
const ROOMS_B = ["7", "8"];

function secondVacuumRooms(): Record<string, MapExtractorRoom> {
    return {
        "7": extractorRoom(100, 100, 300, 300, "Office"),
        "8": extractorRoom(400, 400, 600, 600, "Hallway"),
    };
}

function roomIdsOf(config: XiaomiVacuumMapCardConfig | undefined): string[] {
    return (config?.map_modes ?? []).flatMap(mode =>
        (mode.predefined_selections ?? []).map(selection => String((selection as RoomConfig).id)),
    );
}

function findGenerateButton(root: ShadowRoot): HTMLElement {
    const button = Array.from(root.querySelectorAll("ha-button")).find(candidate =>
        (candidate.textContent ?? "").includes("Generate rooms config"),
    );
    if (!button) throw new Error("editor did not render the Generate rooms config button");
    return button as HTMLElement;
}

describe("room-config events are scoped to a card (#944)", () => {
    it("only answers the editor that asked", async () => {
        useHarnessClock();
        const fixture = loadSyntheticFixture();
        const configA = fixtureConfig(fixture);
        const hassA = fixtureHass(fixture);

        const hassBWithVacuum = withState(hassA, SECOND_VACUUM, {
            ...fixture.states["vacuum.roborock_s7"],
            entity_id: SECOND_VACUUM,
            attributes: { ...fixture.states["vacuum.roborock_s7"].attributes, friendly_name: "Roborock S8" },
        }).hass;
        // Register the second vacuum through the router, not only in `hass.entities`: the card's
        // generators call `config/entity_registry/get` for it, and a hand-patched display registry
        // would leave that command answering from the first fixture.
        const hassBWithRegistry = withRegistryEntries(hassBWithVacuum, {
            [SECOND_VACUUM]: {
                entity_id: SECOND_VACUUM,
                unique_id: "roborock_s8",
                device_id: "device-roborock-s8",
                platform: "xiaomi_miio",
                name: "Roborock S8",
            },
        });
        const hassB = withState(
            hassBWithRegistry,
            SECOND_CAMERA,
            cameraEntity({
                entity_id: SECOND_CAMERA,
                rooms: secondVacuumRooms(),
                calibration_points: syntheticCalibrationPoints(),
                entity_picture: "/api/camera_proxy/camera.vacuum_map_b?token=REDACTED_TOKEN",
            }),
        ).hass;
        const configB: XiaomiVacuumMapCardConfig = {
            ...configA,
            entity: SECOND_VACUUM,
            map_source: { camera: SECOND_CAMERA },
        };

        const page = await mountPage([
            { kind: "card", config: configA, hass: hassA, inEditorPreview: true },
            { kind: "card", config: configB, hass: hassB, inEditorPreview: true },
            { kind: "editor", config: configA, hass: hassA },
            { kind: "editor", config: configB, hass: hassB },
        ]);
        const [editorA, editorB] = page.editors;

        const roomConfigEvents: RoomConfigEventData[] = [];
        window.addEventListener(EVENT_ROOM_CONFIG, event => {
            roomConfigEvents.push((event as Event & { roomConfig: RoomConfigEventData }).roomConfig);
        });
        // Snapshot the room ids inside the listener: the editor mutates `map_modes` in place, so a
        // stored config reference would later show the final array for every change and misattribute
        // rooms from a later answer to the first one.
        const changesForA: string[][] = [];
        const changesForB: string[][] = [];
        editorA.element.addEventListener("config-changed", event => {
            changesForA.push(roomIdsOf((event as CustomEvent<{ config: XiaomiVacuumMapCardConfig }>).detail.config));
        });
        editorB.element.addEventListener("config-changed", event => {
            changesForB.push(roomIdsOf((event as CustomEvent<{ config: XiaomiVacuumMapCardConfig }>).detail.config));
        });

        // Press "Generate rooms config" in editor A. Editor B never asks for anything.
        findGenerateButton(editorA.shadowRoot).click();
        await settle(editorA.element);

        // Desired behaviour: exactly one card answers, and only editor A accepts the answer.
        // The single assertion records every observable part of the leak, so the failure output
        // shows both the extra card answer and the rooms editor A ended up with.
        expect({
            answeredWithRooms: roomConfigEvents.map(event =>
                (event.rooms ?? []).map(room => String(room.id)),
            ),
            editorAConfigs: changesForA,
            editorBConfigs: changesForB,
        }).toEqual({
            answeredWithRooms: [ROOMS_A],
            editorAConfigs: [ROOMS_A],
            editorBConfigs: [],
        });

        await page.cleanup();
    });
});
