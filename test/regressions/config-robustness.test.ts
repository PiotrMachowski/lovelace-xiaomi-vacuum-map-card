import { describe, expect, it, vi } from "vitest";

import { validateConfig } from "../../src/config-validators";
import { MapMode } from "../../src/model/map_mode/map-mode";
import { SelectionType } from "../../src/model/map_mode/selection-type";
import type { Context } from "../../src/model/map_objects/context";
import { PredefinedMultiRectangle } from "../../src/model/map_objects/predefined-multi-rectangle";
import { PredefinedPoint } from "../../src/model/map_objects/predefined-point";
import type {
    CalibrationPoint,
    MapModeConfig,
    PredefinedPointConfig,
    PredefinedZoneConfig,
    RoomConfig,
    XiaomiVacuumMapCardConfig,
} from "../../src/types/types";
import {
    fixtureConfig,
    fixtureHass,
    loadSyntheticFixture,
    mountCard,
    useHarnessClock,
    withState,
    type MockHass,
} from "../harness";

const MISSING_ID = "Missing room id";
const MISSING_MAP = "Each calibration point must contain map coordinates";
const MISSING_VACUUM = "Each calibration point must contain vacuum coordinates";
const MISSING_COORDINATE = "Map and vacuum calibration points must contain both x and y coordinate";
const INVALID_POINT_COUNT = "Exactly 3 or 4 calibration points required";

const VALID_ROOM: RoomConfig = {
    id: "0",
    icon: { name: "mdi:broom", x: 50, y: 45 },
    label: { text: "Kitchen", x: 50, y: 45 },
    outline: [
        [20, 20],
        [80, 20],
        [80, 70],
        [20, 70],
    ],
};

function roomsMode(selections: unknown[]): MapModeConfig {
    return {
        name: "Rooms",
        icon: "mdi:floor-plan",
        selection_type: "ROOM",
        service_call_schema: { service: "vacuum.send_command" },
        predefined_selections: selections as RoomConfig[],
    };
}

function zonesMode(selections: unknown[]): MapModeConfig {
    return {
        name: "Zones",
        icon: "mdi:shape",
        selection_type: "PREDEFINED_RECTANGLE",
        service_call_schema: { service: "vacuum.send_command" },
        predefined_selections: selections as PredefinedZoneConfig[],
    };
}

function pointsMode(selections: unknown[]): MapModeConfig {
    return {
        name: "Points",
        icon: "mdi:map-marker",
        selection_type: "PREDEFINED_POINT",
        service_call_schema: { service: "vacuum.send_command" },
        predefined_selections: selections as PredefinedPointConfig[],
    };
}

/**
 * The fixture preset is valid on its own, so every extra error a test sees comes from the
 * `map_modes` / `calibration_points` under test.
 */
function cardConfig(overrides: Partial<XiaomiVacuumMapCardConfig>): XiaomiVacuumMapCardConfig {
    return { ...fixtureConfig(loadSyntheticFixture()), ...overrides };
}

function validCalibrationPoint(index: number): CalibrationPoint {
    return {
        map: { x: index * 10, y: index * 5 },
        vacuum: { x: index * 100, y: index * 50 },
    };
}

function calibrationPoints(...first: unknown[]): CalibrationPoint[] {
    return [...first, validCalibrationPoint(1), validCalibrationPoint(2)] as CalibrationPoint[];
}

function parsedMode(mode: MapModeConfig): MapMode {
    return new MapMode("Xiaomi Miio", mode, "en");
}

function fakeContext(): Context {
    // `getFromEntities` only passes the context through to the constructors; nothing in the
    // parsing path reads it, and the tests below only assert on the parsed items.
    return {} as Context;
}

function rectanglesFrom(mode: MapModeConfig, hass: MockHass): PredefinedMultiRectangle[] {
    return PredefinedMultiRectangle.getFromEntities(parsedMode(mode), hass, fakeContext);
}

function pointsFrom(mode: MapModeConfig, hass: MockHass): PredefinedPoint[] {
    return PredefinedPoint.getFromEntities(parsedMode(mode), hass, fakeContext);
}

describe("validation reports incomplete predefined selections instead of crashing", () => {
    it("reports a room without an id (#937)", () => {
        const roomWithoutId = { ...VALID_ROOM, id: undefined };
        const config = cardConfig({ map_modes: [roomsMode([roomWithoutId])] });

        expect(() => validateConfig(config)).not.toThrow();
        // Upstream #937 reports the missing id and skips the format check: there is no id to
        // format. Reporting both would print "Invalid room id: undefined".
        expect(validateConfig(config)).toEqual([MISSING_ID]);
    });

    it("reports an invalid room id format (#937)", () => {
        const invalidRoom = { ...VALID_ROOM, id: "kitchen.0" };
        const config = cardConfig({ map_modes: [roomsMode([invalidRoom])] });

        expect(() => validateConfig(config)).not.toThrow();
        expect(validateConfig(config)).toEqual(["Invalid room id: kitchen.0"]);
    });

    it("reports a predefined selection without zones (#937)", () => {
        const config = cardConfig({ map_modes: [zonesMode([{ zones: undefined }])] });

        expect(() => validateConfig(config)).not.toThrow();
        expect(validateConfig(config)).toEqual(["Missing zones configuration"]);
    });

    it("reports a calibration point without vacuum coordinates (#940)", () => {
        const config = cardConfig({
            calibration_source: { calibration_points: calibrationPoints({ map: { x: 1 } }) },
        });

        expect(() => validateConfig(config)).not.toThrow();
        expect(validateConfig(config)).toEqual([MISSING_VACUUM, MISSING_COORDINATE]);
    });

    it("reports a calibration point without any coordinates (#940)", () => {
        const config = cardConfig({
            calibration_source: { calibration_points: calibrationPoints({}) },
        });

        expect(() => validateConfig(config)).not.toThrow();
        expect(validateConfig(config)).toEqual([MISSING_MAP, MISSING_VACUUM]);
    });

    it("keeps a too-short calibration at the point-count error (#940)", () => {
        // The one-point form from the bug report never reaches the coordinate checks: the count
        // check returns first. It must still not throw.
        const config = cardConfig({
            calibration_source: { calibration_points: [{ map: { x: 1 } }] as unknown as CalibrationPoint[] },
        });

        expect(() => validateConfig(config)).not.toThrow();
        expect(validateConfig(config)).toEqual([INVALID_POINT_COUNT]);
    });

    it("still accepts a complete room and calibration", () => {
        expect(validateConfig(cardConfig({ map_modes: [roomsMode([VALID_ROOM])] }))).toEqual([]);
        const calibration = [validCalibrationPoint(0), validCalibrationPoint(1), validCalibrationPoint(2)];
        expect(validateConfig(cardConfig({ calibration_source: { calibration_points: calibration } }))).toEqual([]);
        const fourPoints = [...calibration, validCalibrationPoint(3)];
        expect(validateConfig(cardConfig({ calibration_source: { calibration_points: fourPoints } }))).toEqual([]);
    });
});

describe("invalid dynamic predefined selections are ignored (#938)", () => {
    it("ignores rectangle zones that reference a missing entity", () => {
        const hass = fixtureHass(loadSyntheticFixture());

        expect(() => rectanglesFrom(zonesMode([{ zones: "sensor.missing_zones" }]), hass)).not.toThrow();
        expect(rectanglesFrom(zonesMode([{ zones: "sensor.missing_zones" }]), hass)).toEqual([]);
    });

    it("ignores rectangle zones that reference a missing attribute", () => {
        const fixture = loadSyntheticFixture();
        const { hass } = withState(fixtureHass(fixture), "sensor.dynamic_zones", {
            state: "[[0, 0, 10, 10]]",
            attributes: {},
        });

        expect(() => rectanglesFrom(zonesMode([{ zones: "sensor.dynamic_zones.attributes.zones" }]), hass)).not.toThrow();
        expect(rectanglesFrom(zonesMode([{ zones: "sensor.dynamic_zones.attributes.zones" }]), hass)).toEqual([]);
    });

    it("ignores rectangle zones whose value is not a list", () => {
        const fixture = loadSyntheticFixture();
        const { hass } = withState(fixtureHass(fixture), "sensor.dynamic_zones", {
            state: "not json",
            attributes: {},
        });

        expect(rectanglesFrom(zonesMode([{ zones: "sensor.dynamic_zones" }]), hass)).toEqual([]);
    });

    it("ignores points that reference a missing entity", () => {
        const hass = fixtureHass(loadSyntheticFixture());

        expect(() => pointsFrom(pointsMode([{ position: "input_text.missing_points" }]), hass)).not.toThrow();
        expect(pointsFrom(pointsMode([{ position: "input_text.missing_points" }]), hass)).toEqual([]);
    });

    it("keeps valid dynamic rectangles and points", () => {
        const fixture = loadSyntheticFixture();
        let hass = fixtureHass(fixture);
        hass = withState(hass, "sensor.dynamic_zones", {
            state: "[[0, 0, 10, 10], [20, 20, 30, 30]]",
            attributes: {},
        }).hass;
        hass = withState(hass, "input_text.dynamic_points", {
            state: "[[1, 2], [3, 4]]",
            attributes: {},
        }).hass;

        const rectangles = rectanglesFrom(zonesMode([{ zones: "sensor.dynamic_zones" }]), hass);
        expect(rectangles.map(rectangle => rectangle.toVacuum(null))).toEqual([
            [[0, 0, 10, 10]],
            [[20, 20, 30, 30]],
        ]);

        const points = pointsFrom(pointsMode([{ position: "input_text.dynamic_points" }]), hass);
        expect(points).toHaveLength(2);
    });
});

describe("the card shows the validation error instead of throwing", () => {
    it("mounts with a room that has no id", async () => {
        useHarnessClock();
        const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
        const config = cardConfig({ map_modes: [roomsMode([{ ...VALID_ROOM, id: undefined }])] });

        const card = await mountCard(config, fixtureHass(loadSyntheticFixture()));

        const error = card.shadowRoot.querySelector("pre");
        expect(error?.textContent).toContain(MISSING_ID);
        errors.mockRestore();
    });

    it("mounts with a calibration point that has no coordinates", async () => {
        useHarnessClock();
        const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
        const config = cardConfig({
            calibration_source: { calibration_points: calibrationPoints({}) },
        });

        const card = await mountCard(config, fixtureHass(loadSyntheticFixture()));

        const error = card.shadowRoot.querySelector("pre");
        expect(error?.textContent).toContain(MISSING_MAP);
        errors.mockRestore();
    });

    it("keeps rendering a mode whose dynamic selection has no usable value", async () => {
        useHarnessClock();
        const config = cardConfig({
            // The entity exists and is valid, so the card renders; only the attribute that should
            // hold the zones is missing. The mode must come up empty instead of breaking. The crash
            // itself is only observable in the parsing tests above: the card resolves the mode in
            // an unawaited promise chain, so before #938 this mount rendered and then failed with
            // an unhandled rejection.
            map_modes: [zonesMode([{ zones: "sensor.roborock_s7_status.attributes.zones" }])],
        });

        const card = await mountCard(config, fixtureHass(loadSyntheticFixture()));

        expect(card.shadowRoot.querySelector("ha-card")).not.toBeNull();
        expect(card.element._getCurrentMode()?.selectionType).toBe(SelectionType.PREDEFINED_RECTANGLE);
        expect(card.shadowRoot.querySelectorAll("polygon.predefined-rectangle")).toHaveLength(0);
    });

    it("reports a dynamic selection that references a missing entity as an invalid entity", async () => {
        useHarnessClock();
        const config = cardConfig({
            map_modes: [zonesMode([{ zones: "sensor.missing_zones" }])],
        });

        const card = await mountCard(config, fixtureHass(loadSyntheticFixture()));

        // The entity is watched, so the card's own invalid-entities warning is the right place to
        // report it. What matters here is that rendering reaches the warning instead of throwing.
        const warning = card.shadowRoot.querySelector("hui-warning");
        expect(warning?.textContent).toContain("Invalid entities:");
        expect(warning?.textContent).toContain("sensor.missing_zones");
    });
});
