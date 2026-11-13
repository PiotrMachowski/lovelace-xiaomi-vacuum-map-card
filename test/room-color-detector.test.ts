import { readFileSync } from "node:fs";

import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";

import { CoordinatesConverter } from "../src/model/map_objects/coordinates-converter";
import { ImageDataLike, RoomColorDetector } from "../src/model/room-color-detector";
import type { PointType } from "../src/types/types";
import { loadSyntheticFixture, extractorRoom, syntheticCalibrationPoints, syntheticRooms } from "./harness";

/** Flat colours painted by test/fixtures/synthetic/generate.cjs. */
const ROOM_COLORS: Record<string, [number, number, number]> = {
    "0": [230, 25, 75],
    "1": [60, 180, 75],
    "2": [67, 99, 216],
};

function syntheticImageData(): ImageDataLike {
    const fixture = loadSyntheticFixture();
    const png = PNG.sync.read(readFileSync(fixture.mapPngPath));
    return {
        width: png.width,
        height: png.height,
        data: new Uint8ClampedArray(png.data),
    };
}

function boundsOf(points: PointType[]): { left: number; top: number; right: number; bottom: number } {
    return {
        left: Math.min(...points.map(point => point[0])),
        top: Math.min(...points.map(point => point[1])),
        right: Math.max(...points.map(point => point[0])),
        bottom: Math.max(...points.map(point => point[1])),
    };
}

describe("RoomColorDetector.detectFromImageData", () => {
    it("detects the three synthetic rooms straight from decoded PNG pixels", () => {
        const imageData = syntheticImageData();
        const rooms = syntheticRooms();
        const converter = new CoordinatesConverter(syntheticCalibrationPoints());
        expect(converter.calibrated).toBe(true);

        const detection = RoomColorDetector.detectFromImageData(imageData, rooms, converter);

        expect(detection).toBeDefined();
        const result = detection!;
        expect(result.imageData).toBe(imageData);
        expect(result.regions.map(region => region.id).sort()).toEqual(["0", "1", "2"]);

        const expectedCenters: Record<string, PointType> = {
            "0": [50, 45],
            "1": [135, 45],
            "2": [50, 110],
        };
        for (const region of result.regions) {
            const expected = expectedCenters[region.id];
            expect(region.center[0]).toBeCloseTo(expected[0], 0);
            expect(region.center[1]).toBeCloseTo(expected[1], 0);

            // The outline is the coloured rectangle's border, in image pixels.
            const room = rooms[region.id];
            const topLeft = converter.vacuumToMap(room.x0 as number, room.y0 as number);
            const bottomRight = converter.vacuumToMap(room.x1 as number, room.y1 as number);
            expect(boundsOf(region.outline)).toEqual({
                left: topLeft[0],
                top: topLeft[1],
                right: bottomRight[0],
                bottom: bottomRight[1],
            });

            const [red, green, blue] = ROOM_COLORS[region.id];
            const colorKey = RoomColorDetector.getColorKey(red, green, blue);
            expect(region.colorKey).toBe(colorKey);
            expect(result.roomIdByColor.get(colorKey)).toBe(region.id);
        }
    });

    it("ignores rooms whose camera bounds contain no saturated pixels", () => {
        const imageData = syntheticImageData();
        const converter = new CoordinatesConverter(syntheticCalibrationPoints());
        const rooms = {
            ...syntheticRooms(),
            "9": extractorRoom(1200, 1000, 1900, 1400, "Empty wall"),
        };

        const detection = RoomColorDetector.detectFromImageData(imageData, rooms, converter);

        expect(detection?.regions.map(region => region.id).sort()).toEqual(["0", "1", "2"]);
    });
});
