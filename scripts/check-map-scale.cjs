const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const helperPath = path.join(__dirname, "../src/model/map-scale.ts");
const source = fs.readFileSync(helperPath, "utf8");
const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 },
}).outputText;
const helperModule = { exports: {} };
new Function("exports", "require", "module", compiled)(helperModule.exports, require, helperModule);
const { calculateRealScale } = helperModule.exports;

const expectedScale = 600 / 1200;
for (const zoom of [0.5, 1, 1.5, 2.5]) {
    for (const rotation of [0, 45, 90]) {
        const radians = (rotation * Math.PI) / 180;
        const canvas = {
            width: 1200,
            height: 800,
            offsetWidth: 600,
            offsetHeight: 400,
            getBoundingClientRect() {
                const rotatedWidth =
                    Math.abs(Math.cos(radians)) * this.offsetWidth + Math.abs(Math.sin(radians)) * this.offsetHeight;
                return { width: rotatedWidth * zoom };
            },
        };
        const actualScale = calculateRealScale(canvas, 1200);
        const mapPixel = 251.75;
        const imagePosition = mapPixel * expectedScale * zoom;
        const overlayPosition = mapPixel * actualScale * zoom;
        assert.ok(
            Math.abs(actualScale - expectedScale) < 1e-9,
            `base image scale changed at zoom ${zoom} and rotation ${rotation}: ${actualScale}`,
        );
        assert.ok(
            Math.abs(overlayPosition - imagePosition) < 1e-9,
            `overlay point drifted ${overlayPosition - imagePosition}px at zoom ${zoom} and rotation ${rotation}`,
        );
    }
}

process.stdout.write("Map scale remains independent of zoom and rotation.\n");
