import { describe, expect, it } from "vitest";

import { EVENT_ROOM_CONFIG } from "../../src/const";
import type { EditorHandle, MockHass } from "../harness";
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

/** Adds the second vacuum's state and registry entry, leaving the camera unchanged. */
function withSecondVacuum(hass: MockHass): MockHass {
    const withVacuumState = withState(hass, SECOND_VACUUM, {
        ...hass.states["vacuum.roborock_s7"],
        entity_id: SECOND_VACUUM,
        attributes: { ...hass.states["vacuum.roborock_s7"].attributes, friendly_name: "Roborock S8" },
    }).hass;
    // Register the second vacuum through the router, not only in `hass.entities`: the card's
    // generators call `config/entity_registry/get` for it, and a hand-patched display registry
    // would leave that command answering from the first fixture.
    return withRegistryEntries(withVacuumState, {
        [SECOND_VACUUM]: {
            entity_id: SECOND_VACUUM,
            unique_id: "roborock_s8",
            device_id: "device-roborock-s8",
            platform: "xiaomi_miio",
            name: "Roborock S8",
        },
    });
}

function withSecondCamera(hass: MockHass): MockHass {
    return withState(
        hass,
        SECOND_CAMERA,
        cameraEntity({
            entity_id: SECOND_CAMERA,
            rooms: secondVacuumRooms(),
            calibration_points: syntheticCalibrationPoints(),
            entity_picture: "/api/camera_proxy/camera.vacuum_map_b?token=REDACTED_TOKEN",
        }),
    ).hass;
}

/** Records the room ids of every `config-changed` an editor emits. */
function recordConfigChanges(editor: EditorHandle): string[][] {
    const changes: string[][] = [];
    editor.element.addEventListener("config-changed", event => {
        changes.push(roomIdsOf((event as CustomEvent<{ config: XiaomiVacuumMapCardConfig }>).detail.config));
    });
    return changes;
}

describe("room-config events are scoped to a card (#944)", () => {
    it("only answers the editor that asked", async () => {
        useHarnessClock();
        const fixture = loadSyntheticFixture();
        const configA = fixtureConfig(fixture);
        const hassA = fixtureHass(fixture);
        const hassB = withSecondCamera(withSecondVacuum(hassA));
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
        // Snapshot the room ids inside the listener so each `config-changed` event is recorded
        // against the config it carried; a stored reference would make every entry show the value
        // of the latest change.
        const changesForA = recordConfigChanges(editorA);
        const changesForB = recordConfigChanges(editorB);

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

    it("accepts only its own answers when two editors share one entity and camera", async () => {
        useHarnessClock();
        const fixture = loadSyntheticFixture();
        const config = fixtureConfig(fixture);
        const hass = fixtureHass(fixture);

        // Same entity and camera everywhere: only the request id separates the two editors.
        const page = await mountPage([
            { kind: "card", config, hass, inEditorPreview: true },
            { kind: "card", config, hass, inEditorPreview: true },
            { kind: "editor", config, hass },
            { kind: "editor", config, hass },
        ]);
        const [editorA, editorB] = page.editors;

        let answerCount = 0;
        window.addEventListener(EVENT_ROOM_CONFIG, () => {
            answerCount++;
        });
        const changesForA = recordConfigChanges(editorA);
        const changesForB = recordConfigChanges(editorB);

        // Each request is answered by both mounted cards; two clicks produce four answers.
        findGenerateButton(editorA.shadowRoot).click();
        await settle(editorA.element);
        findGenerateButton(editorA.shadowRoot).click();
        await settle(editorA.element);

        expect({
            answerCount,
            editorAConfigs: changesForA,
            editorBConfigs: changesForB,
        }).toEqual({
            answerCount: 4,
            editorAConfigs: [ROOMS_A, ROOMS_A],
            editorBConfigs: [],
        });

        await page.cleanup();
    });

    it("answers from the card whose entity matches the request", async () => {
        useHarnessClock();
        const fixture = loadSyntheticFixture();
        const configA = fixtureConfig(fixture);
        const hassA = fixtureHass(fixture);
        // Same camera; only the entity differs, so only the entity check can separate the cards.
        const hassB = withSecondVacuum(hassA);
        const configB: XiaomiVacuumMapCardConfig = { ...configA, entity: SECOND_VACUUM };

        const page = await mountPage([
            { kind: "card", config: configA, hass: hassA, inEditorPreview: true },
            { kind: "card", config: configB, hass: hassB, inEditorPreview: true },
            { kind: "editor", config: configA, hass: hassA },
        ]);
        const [editor] = page.editors;

        const answeredBy: Array<string | undefined> = [];
        window.addEventListener(EVENT_ROOM_CONFIG, event => {
            answeredBy.push((event as Event & { roomConfig: RoomConfigEventData }).roomConfig.entity);
        });
        const changes = recordConfigChanges(editor);

        findGenerateButton(editor.shadowRoot).click();
        await settle(editor.element);

        expect({
            answeredBy,
            editorConfigs: changes,
        }).toEqual({
            answeredBy: [configA.entity],
            editorConfigs: [ROOMS_A],
        });

        await page.cleanup();
    });
});
