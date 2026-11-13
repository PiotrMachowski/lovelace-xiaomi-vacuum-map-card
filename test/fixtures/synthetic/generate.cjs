/*
 * Regenerates test/fixtures/synthetic/map.png.
 *
 * The fixture is committed, but it is generated rather than hand-drawn so the geometry in
 * map.png, camera.json and the room-detection assertions can be reviewed together. Run:
 *
 *   node test/fixtures/synthetic/generate.cjs
 *
 * The image is 200x150 CSS-free bitmap with three flat, saturated rooms on white so the
 * RoomColorDetector can segment them without a browser canvas.
 */
const fs = require("node:fs");
const path = require("node:path");
const { PNG } = require("pngjs");

const WIDTH = 200;
const HEIGHT = 150;
const BACKGROUND = [255, 255, 255, 255];

const ROOMS = [
    // id, colour, x0, y0, x1, y1 (inclusive pixel bounds)
    { id: "0", color: [230, 25, 75, 255], left: 20, top: 20, right: 79, bottom: 69 },
    { id: "1", color: [60, 180, 75, 255], left: 100, top: 20, right: 169, bottom: 69 },
    { id: "2", color: [67, 99, 216, 255], left: 20, top: 90, right: 79, bottom: 129 },
];

const png = new PNG({ width: WIDTH, height: HEIGHT });

const setPixel = (x, y, rgba) => {
    const offset = (y * WIDTH + x) * 4;
    png.data[offset] = rgba[0];
    png.data[offset + 1] = rgba[1];
    png.data[offset + 2] = rgba[2];
    png.data[offset + 3] = rgba[3];
};

for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
        setPixel(x, y, BACKGROUND);
    }
}

for (const room of ROOMS) {
    for (let y = room.top; y <= room.bottom; y++) {
        for (let x = room.left; x <= room.right; x++) {
            setPixel(x, y, room.color);
        }
    }
}

const target = path.join(__dirname, "map.png");
fs.writeFileSync(target, PNG.sync.write(png, { colorType: 6 }));
process.stdout.write(`Wrote ${path.relative(process.cwd(), target)} (${WIDTH}x${HEIGHT}).\n`);
