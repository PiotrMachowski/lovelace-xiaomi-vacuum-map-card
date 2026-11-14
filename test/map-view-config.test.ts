import { describe, expect, it } from "vitest";

import { validateConfig } from "../src/config-validators";
import { validateMapViewConfig } from "../src/config-validators";
import type { MapViewConfig, XiaomiVacuumMapCardConfig } from "../src/types/types";
import { fixtureConfig, loadSyntheticFixture } from "./harness";

/** A configuration that passes every existing check, so only `map_view` can add an error. */
function validConfig(mapView?: unknown): XiaomiVacuumMapCardConfig {
    return { ...fixtureConfig(loadSyntheticFixture()), map_view: mapView as MapViewConfig | undefined };
}

describe("map_view validation", () => {
    it("accepts a complete default view", () => {
        expect(validateConfig(validConfig({ scale: 2.5, x: 40, y: -30, rotation: 90 }))).toEqual([]);
    });

    it("accepts a partial default view, because every field is optional", () => {
        expect(validateConfig(validConfig({ scale: 2.5 }))).toEqual([]);
        expect(validateConfig(validConfig({}))).toEqual([]);
        expect(validateConfig(validConfig(undefined))).toEqual([]);
    });

    it("reports a scale that is not a positive finite number", () => {
        expect(validateMapViewConfig({ scale: 0 })).toEqual([["validation.map_view.invalid", "{0}", "scale"]]);
        expect(validateMapViewConfig({ scale: -1 })).toEqual([["validation.map_view.invalid", "{0}", "scale"]]);
        expect(validateMapViewConfig({ scale: Number.NaN })).toEqual([["validation.map_view.invalid", "{0}", "scale"]]);
        expect(validateMapViewConfig({ scale: Number.POSITIVE_INFINITY })).toEqual([
            ["validation.map_view.invalid", "{0}", "scale"],
        ]);
    });

    it("reports a non-numeric offset or rotation instead of applying it", () => {
        expect(validateMapViewConfig({ x: "40" } as unknown as MapViewConfig)).toEqual([
            ["validation.map_view.invalid", "{0}", "x"],
        ]);
        expect(validateMapViewConfig({ y: null } as unknown as MapViewConfig)).toEqual([
            ["validation.map_view.invalid", "{0}", "y"],
        ]);
        expect(validateMapViewConfig({ rotation: "90" } as unknown as MapViewConfig)).toEqual([
            ["validation.map_view.invalid", "{0}", "rotation"],
        ]);
    });

    it("reports a map_view that is not an object instead of throwing", () => {
        for (const value of ["2.5", 2.5, null, [1, 2, 3], true]) {
            expect(validateMapViewConfig(value as unknown as MapViewConfig)).toEqual([
                ["validation.map_view.invalid", "{0}", "map_view"],
            ]);
        }
    });

    it("turns the message into a config error the card displays", () => {
        expect(validateConfig(validConfig({ scale: 0 }))).toEqual(["Invalid map_view value: scale"]);
        expect(validateConfig(validConfig("nope"))).toEqual(["Invalid map_view value: map_view"]);
    });
});
