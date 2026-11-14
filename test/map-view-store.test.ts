import { describe, expect, it } from "vitest";

import { getMapView, MapView, resolveMapView, setMapView } from "../src/model/map-view-store";

const NEUTRAL: MapView = { scale: 1, x: 0, y: 0, rotation: 90 };

describe("map view storage", () => {
    it("round-trips a view through localStorage under the unchanged key", () => {
        setMapView("card|0|camera.map|", { scale: 2, x: 12, y: 34, rotation: -90, locked: true });

        expect(getMapView("card|0|camera.map|")).toEqual({
            scale: 2,
            x: 12,
            y: 34,
            // persisted angles stay comparable: -90 is stored as 270
            rotation: 270,
            locked: true,
        });
        expect(JSON.parse(window.localStorage.getItem("xiaomi-vacuum-map-card.map-view") ?? "{}")).toHaveProperty([
            "card|0|camera.map|",
        ]);
    });

    it("keeps a stored view when a configured default exists too", () => {
        const stored: MapView = { scale: 2.5, x: -10, y: 20, rotation: 180 };

        expect(resolveMapView(stored, { scale: 1, x: 0, y: 0, rotation: 0 }, NEUTRAL)).toBe(stored);
    });

    it("uses the configured default when nothing is stored", () => {
        expect(resolveMapView(undefined, { scale: 2.5, x: 40, y: -30, rotation: 270 }, NEUTRAL)).toEqual({
            scale: 2.5,
            x: 40,
            y: -30,
            rotation: 270,
        });
    });

    it("fills fields a partial configured default leaves out from the neutral view", () => {
        expect(resolveMapView(undefined, { scale: 2.5 }, NEUTRAL)).toEqual({
            scale: 2.5,
            x: 0,
            y: 0,
            // the neutral rotation is the preset's map_rotation, so a default zoom keeps the angle
            rotation: 90,
        });
        expect(resolveMapView(undefined, { x: 15 }, NEUTRAL)).toEqual({ scale: 1, x: 15, y: 0, rotation: 90 });
    });

    it("normalizes a configured rotation like a stored one", () => {
        expect(resolveMapView(undefined, { rotation: 450 }, NEUTRAL)?.rotation).toBe(90);
        expect(resolveMapView(undefined, { rotation: -90 }, NEUTRAL)?.rotation).toBe(270);
    });

    it("returns undefined with neither a stored view nor a default, so the neutral view stands", () => {
        expect(resolveMapView(undefined, undefined, NEUTRAL)).toBeUndefined();
    });
});
