import { describe, expect, it } from "vitest";

import { calculateRealScale } from "../src/model/map-scale";

/**
 * Port of the former scripts/check-map-scale.cjs. The base image scale must stay tied to the
 * canvas's untransformed layout width, so pinch-zoom and rotation are applied once to both the
 * image and the SVG overlays.
 */
function scaledCanvas(zoom: number, rotation: number): HTMLCanvasElement {
    const width = 1200;
    const height = 800;
    const offsetWidth = 600;
    const offsetHeight = 400;
    const radians = (rotation * Math.PI) / 180;
    // getBoundingClientRect() includes the transforms a browser would apply. calculateRealScale
    // must not read it; only offsetWidth is part of the contract.
    return {
        width,
        height,
        offsetWidth,
        offsetHeight,
        getBoundingClientRect: () => ({
            width:
                (Math.abs(Math.cos(radians)) * offsetWidth + Math.abs(Math.sin(radians)) * offsetHeight) *
                zoom,
        }),
    } as unknown as HTMLCanvasElement;
}

describe("calculateRealScale", () => {
    it("remains independent of zoom and rotation", () => {
        const expectedScale = 600 / 1200;
        for (const zoom of [0.5, 1, 1.5, 2.5]) {
            for (const rotation of [0, 45, 90]) {
                const actualScale = calculateRealScale(scaledCanvas(zoom, rotation), 1200);
                const mapPixel = 251.75;
                const imagePosition = mapPixel * expectedScale * zoom;
                const overlayPosition = mapPixel * actualScale * zoom;

                expect(
                    actualScale,
                    `base image scale changed at zoom ${zoom} and rotation ${rotation}: ${actualScale}`,
                ).toBeCloseTo(expectedScale, 9);
                expect(
                    overlayPosition - imagePosition,
                    `overlay point drifted at zoom ${zoom} and rotation ${rotation}: ${overlayPosition - imagePosition}px`,
                ).toBeCloseTo(0, 9);
            }
        }
        process.stdout.write("Map scale remains independent of zoom and rotation.\n");
    });
});
