import * as pako from "pako";
import { HomeAssistantFixed } from "../types/fixes";
import { CalibrationPoint, MapExtractorRoom } from "../types/types";

/**
 * Valetudo's "RawMapData" JSON structure, the same data Hypfer/lovelace-valetudo-map-card
 * decodes. Valetudo does not publish a rendered map image: its MQTT map camera serves a
 * placeholder PNG that carries this JSON, zlib-compressed, in a "zTXt" chunk.
 */
export interface ValetudoRawMapLayer {
    type: "floor" | "segment" | "wall";
    pixels: number[];
    compressedPixels?: number[];
    metaData: {
        area?: number;
        segmentId?: string;
        name?: string;
        active?: boolean;
    };
    dimensions: {
        x: { min: number; max: number; mid?: number; avg?: number };
        y: { min: number; max: number; mid?: number; avg?: number };
        pixelCount?: number;
    };
}

export interface ValetudoRawMapEntity {
    type:
        | "charger_location"
        | "robot_position"
        | "go_to_target"
        | "path"
        | "predicted_path"
        | "virtual_wall"
        | "no_go_area"
        | "no_mop_area"
        | "active_zone"
        | string;
    points: number[];
    metaData?: { angle?: number };
}

export interface ValetudoRawMapData {
    metaData: { version: number; nonce?: string };
    size: { x: number; y: number };
    pixelSize: number;
    layers: ValetudoRawMapLayer[];
    entities: ValetudoRawMapEntity[];
}

export type ValetudoOverlayLayer = "no_go_area" | "no_mop_area" | "virtual_wall" | "active_zone" | "carpet";

export const VALETUDO_OVERLAY_LAYERS: ValetudoOverlayLayer[] = [
    "no_go_area",
    "no_mop_area",
    "virtual_wall",
    "active_zone",
    "carpet",
];

export const VALETUDO_DEFAULT_OVERLAY_LAYERS: ValetudoOverlayLayer[] = [
    "no_go_area",
    "no_mop_area",
    "virtual_wall",
    "active_zone",
];

export interface ValetudoRenderOptions {
    floorColor?: string;
    wallColor?: string;
    segmentColors?: string[];
    pathColor?: string;
    scale?: number;
    layers?: ValetudoOverlayLayer[];
}

const AREA_STYLES: Record<"no_go_area" | "no_mop_area" | "active_zone", { fill: string; stroke: string }> = {
    no_go_area: { fill: "rgba(255, 62, 62, 0.35)", stroke: "#FF3E3E" },
    no_mop_area: { fill: "rgba(166, 110, 255, 0.35)", stroke: "#A66EFF" },
    active_zone: { fill: "rgba(64, 220, 120, 0.25)", stroke: "#40DC78" },
};
const VIRTUAL_WALL_COLOR = "#FF3E3E";
const CARPET_HATCH_COLOR = "rgba(255, 255, 255, 0.35)";

/** Position in vacuum coordinates (mm), the same system as the calibration points. */
export interface ValetudoMarker {
    x: number;
    y: number;
    /** Degrees clockwise; 0 means the icon as drawn (same convention as Hypfer/lovelace-valetudo-map-card). */
    angle?: number;
}

export interface ValetudoRenderResult {
    dataUrl: string;
    calibrationPoints: CalibrationPoint[];
    rooms: Record<string, MapExtractorRoom>;
    robot?: ValetudoMarker;
    charger?: ValetudoMarker;
    goToTarget?: ValetudoMarker;
}

export interface ValetudoMapSnapshot {
    fingerprint: string;
    /** Undefined when the map is unchanged since the fingerprint passed to fetchValetudoMap(). */
    data?: ValetudoRawMapData;
}

const DEFAULT_OPTIONS: Required<ValetudoRenderOptions> = {
    floorColor: "#3C4048",
    wallColor: "#7B90A0",
    segmentColors: ["#19A1A1", "#7AC037", "#DF5618", "#F9A825", "#7D5BA6", "#4285F4", "#E91E63", "#00897B"],
    pathColor: "rgba(255,255,255,0.9)",
    scale: 3,
    layers: VALETUDO_DEFAULT_OVERLAY_LAYERS,
};

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function readUint32(bytes: Uint8Array, offset: number): number {
    return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

/**
 * Extracts zTXt (compressed text) chunks from a PNG file. Valetudo stores
 * its raw map JSON under the "ValetudoMap" keyword.
 */
function extractCompressedTextChunks(buffer: ArrayBuffer): { keyword: string; data: Uint8Array }[] {
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < PNG_SIGNATURE.length; i++) {
        if (bytes[i] !== PNG_SIGNATURE[i]) {
            throw new Error("Not a valid PNG file - is this entity really a Valetudo map camera?");
        }
    }
    const chunks: { keyword: string; data: Uint8Array }[] = [];
    let offset = 8;
    while (offset + 8 <= bytes.length) {
        const length = readUint32(bytes, offset);
        const type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
        const dataStart = offset + 8;
        if (type === "IEND") {
            break;
        }
        if (type === "zTXt") {
            const chunkData = bytes.slice(dataStart, dataStart + length);
            let keywordEnd = 0;
            while (keywordEnd < chunkData.length && chunkData[keywordEnd] !== 0) {
                keywordEnd++;
            }
            const keyword = String.fromCharCode(...Array.from(chunkData.slice(0, keywordEnd)));
            // chunkData[keywordEnd] = null separator, chunkData[keywordEnd + 1] = compression method (0 = zlib)
            const compressed = chunkData.slice(keywordEnd + 2);
            chunks.push({ keyword, data: compressed });
        }
        offset = dataStart + length + 4; // + 4 to skip the CRC32 trailer
    }
    return chunks;
}

function extractValetudoMapChunk(buffer: ArrayBuffer): Uint8Array {
    const chunk = extractCompressedTextChunks(buffer).find(c => c.keyword === "ValetudoMap");
    if (!chunk) {
        throw new Error("No embedded Valetudo map data found in camera image");
    }
    return chunk.data;
}

// FNV-1a over the still-compressed chunk: an unchanged map skips inflate + render entirely.
function fingerprint(bytes: Uint8Array): string {
    let hash = 0x811c9dc5;
    for (let i = 0; i < bytes.length; i++) {
        hash ^= bytes[i];
        hash = Math.imul(hash, 0x01000193);
    }
    return `${bytes.length}:${(hash >>> 0).toString(16)}`;
}

function parseValetudoMapChunk(compressed: Uint8Array): ValetudoRawMapData {
    const inflated = pako.inflate(compressed);
    const json = new TextDecoder("utf-8").decode(inflated);
    const data = JSON.parse(json) as ValetudoRawMapData;
    // Map format v2 may RLE-encode pixel arrays as repeated [xStart, y, count] triples.
    data.layers.forEach(layer => {
        if ((!layer.pixels || layer.pixels.length === 0) && layer.compressedPixels?.length) {
            const pixels: number[] = [];
            for (let i = 0; i < layer.compressedPixels.length; i += 3) {
                const xStart = layer.compressedPixels[i];
                const y = layer.compressedPixels[i + 1];
                const count = layer.compressedPixels[i + 2];
                for (let j = 0; j < count; j++) {
                    pixels.push(xStart + j, y);
                }
            }
            layer.pixels = pixels;
            delete layer.compressedPixels;
        }
    });
    return data;
}

interface BoundingBox {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}

function computeBoundingBox(data: ValetudoRawMapData): BoundingBox {
    const relevant = data.layers.filter(l => l.type === "floor" || l.type === "wall" || l.type === "segment");
    const box: BoundingBox = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    relevant.forEach(l => {
        box.minX = Math.min(box.minX, l.dimensions.x.min);
        box.minY = Math.min(box.minY, l.dimensions.y.min);
        box.maxX = Math.max(box.maxX, l.dimensions.x.max);
        box.maxY = Math.max(box.maxY, l.dimensions.y.max);
    });
    if (!isFinite(box.minX) || !isFinite(box.minY) || !isFinite(box.maxX) || !isFinite(box.maxY)) {
        return { minX: 0, minY: 0, maxX: data.size.x, maxY: data.size.y };
    }
    return box;
}

/**
 * Returns the outer boundary of a set of grid pixels as a polygon of pixel-corner
 * coordinates. Each exposed pixel side becomes a directed edge (clockwise with y
 * pointing down), edges are chained into closed loops, and the loop enclosing the
 * largest area is kept: that is the outer outline. Holes (furniture) are dropped,
 * so a click anywhere inside the room selects it.
 */
function traceOutline(pixels: number[]): [number, number][] {
    const KEY_STRIDE = 1 << 16;
    const key = (x: number, y: number): number => y * KEY_STRIDE + x;
    const filled = new Set<number>();
    for (let i = 0; i < pixels.length; i += 2) {
        filled.add(key(pixels[i], pixels[i + 1]));
    }

    const outgoing = new Map<number, number[]>();
    const addEdge = (x1: number, y1: number, x2: number, y2: number): void => {
        const from = key(x1, y1);
        const list = outgoing.get(from);
        if (list) {
            list.push(key(x2, y2));
        } else {
            outgoing.set(from, [key(x2, y2)]);
        }
    };
    for (let i = 0; i < pixels.length; i += 2) {
        const x = pixels[i];
        const y = pixels[i + 1];
        if (!filled.has(key(x, y - 1))) addEdge(x, y, x + 1, y);
        if (!filled.has(key(x + 1, y))) addEdge(x + 1, y, x + 1, y + 1);
        if (!filled.has(key(x, y + 1))) addEdge(x + 1, y + 1, x, y + 1);
        if (!filled.has(key(x - 1, y))) addEdge(x, y + 1, x, y);
    }

    let best: [number, number][] = [];
    let bestArea = 0;
    outgoing.forEach((_, start) => {
        while ((outgoing.get(start)?.length ?? 0) > 0) {
            const loop: [number, number][] = [];
            let current = start;
            let next: number | undefined;
            while ((next = outgoing.get(current)?.pop()) !== undefined) {
                loop.push([current % KEY_STRIDE, Math.floor(current / KEY_STRIDE)]);
                current = next;
                if (current === start) break;
            }
            let area = 0;
            for (let i = 0; i < loop.length; i++) {
                const [x1, y1] = loop[i];
                const [x2, y2] = loop[(i + 1) % loop.length];
                area += x1 * y2 - x2 * y1;
            }
            if (Math.abs(area) > bestArea) {
                bestArea = Math.abs(area);
                best = loop;
            }
        }
    });

    // Drop vertices in the middle of straight runs.
    return best.filter((point, i) => {
        const prev = best[(i + best.length - 1) % best.length];
        const next = best[(i + 1) % best.length];
        return (point[0] - prev[0]) * (next[1] - point[1]) !== (point[1] - prev[1]) * (next[0] - point[0]);
    });
}

function findMarker(data: ValetudoRawMapData, type: string): ValetudoMarker | undefined {
    const entity = data.entities.find(e => e.type === type);
    if (!entity || entity.points.length < 2) {
        return undefined;
    }
    return { x: entity.points[0], y: entity.points[1], angle: entity.metaData?.angle };
}

/**
 * Renders a Valetudo RawMapData structure to a canvas (floor/walls/segments
 * as filled pixels, path as a line) and returns it as a data: URL, along with
 * calibration points computed directly from the map's own pixelSize/bounding
 * box (so no manual calibration is needed), a `rooms` map compatible with this
 * card's ROOM selection mode, and robot/charger/go-to positions. Those are left
 * off the bitmap so the card can draw them as fixed-size overlay icons.
 */
export function renderValetudoMap(
    data: ValetudoRawMapData,
    options?: ValetudoRenderOptions,
): ValetudoRenderResult {
    const opts = { ...DEFAULT_OPTIONS, ...options, layers: options?.layers ?? DEFAULT_OPTIONS.layers };
    const box = computeBoundingBox(data);
    const padding = 2;
    const gridWidth = box.maxX - box.minX + 1 + padding * 2;
    const gridHeight = box.maxY - box.minY + 1 + padding * 2;
    const offsetX = box.minX - padding;
    const offsetY = box.minY - padding;

    const canvas = document.createElement("canvas");
    canvas.width = gridWidth * opts.scale;
    canvas.height = gridHeight * opts.scale;
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    // No background fill: the transparent canvas lets the card's themed zoomer background show through.
    ctx.imageSmoothingEnabled = false;

    const paintPixels = (pixels: number[] | undefined, color: string) => {
        if (!pixels || pixels.length === 0) {
            return;
        }
        ctx.fillStyle = color;
        for (let i = 0; i < pixels.length; i += 2) {
            const x = (pixels[i] - offsetX) * opts.scale;
            const y = (pixels[i + 1] - offsetY) * opts.scale;
            ctx.fillRect(x, y, opts.scale, opts.scale);
        }
    };

    data.layers.filter(l => l.type === "floor").forEach(l => paintPixels(l.pixels, opts.floorColor));

    const segments = data.layers.filter(l => l.type === "segment");
    const rooms: Record<string, MapExtractorRoom> = {};
    segments.forEach((l, i) => {
        const color = opts.segmentColors[i % opts.segmentColors.length];
        paintPixels(l.pixels, color);
        const segmentId = l.metaData.segmentId ?? String(i + 1);
        // Pixel (px, py) spans [px, px + 1] in grid units, i.e. [px, px + 1] * pixelSize mm.
        const center = (d: { min: number; max: number; mid?: number; avg?: number }): number =>
            ((d.avg ?? d.mid ?? (d.min + d.max) / 2) + 0.5) * data.pixelSize;
        rooms[segmentId] = {
            name: l.metaData.name,
            icon: undefined,
            x: center(l.dimensions.x),
            y: center(l.dimensions.y),
            x0: l.dimensions.x.min * data.pixelSize,
            y0: l.dimensions.y.min * data.pixelSize,
            x1: (l.dimensions.x.max + 1) * data.pixelSize,
            y1: (l.dimensions.y.max + 1) * data.pixelSize,
            outline: traceOutline(l.pixels).map(([x, y]) => [x * data.pixelSize, y * data.pixelSize]),
        };
    });

    // Grid coordinates are pixelSize mm each; entity point coordinates are already in mm.
    const toGrid = (mmX: number, mmY: number): [number, number] => [
        (mmX / data.pixelSize - offsetX) * opts.scale,
        (mmY / data.pixelSize - offsetY) * opts.scale,
    ];
    const tracePoints = (points: number[]): void => {
        ctx.beginPath();
        for (let i = 0; i < points.length; i += 2) {
            const [x, y] = toGrid(points[i], points[i + 1]);
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
    };
    const enabledEntities = (type: ValetudoOverlayLayer): ValetudoRawMapEntity[] =>
        opts.layers.includes(type) ? data.entities.filter(e => e.type === type) : [];
    const thinLine = Math.max(1, opts.scale / 2);
    ctx.lineJoin = "round";

    // Carpets sit on the floor, under the walls.
    const carpets = enabledEntities("carpet");
    if (carpets.length > 0) {
        const tile = document.createElement("canvas");
        tile.width = tile.height = opts.scale * 3;
        const tileCtx = tile.getContext("2d") as CanvasRenderingContext2D;
        tileCtx.strokeStyle = CARPET_HATCH_COLOR;
        tileCtx.beginPath();
        tileCtx.moveTo(0, tile.height);
        tileCtx.lineTo(tile.width, 0);
        tileCtx.stroke();
        ctx.fillStyle = ctx.createPattern(tile, "repeat") ?? CARPET_HATCH_COLOR;
        carpets.forEach(carpet => {
            tracePoints(carpet.points);
            ctx.closePath();
            ctx.fill();
        });
    }

    data.layers.filter(l => l.type === "wall").forEach(l => paintPixels(l.pixels, opts.wallColor));

    (["active_zone", "no_mop_area", "no_go_area"] as const).forEach(type => {
        enabledEntities(type).forEach(area => {
            tracePoints(area.points);
            ctx.closePath();
            ctx.fillStyle = AREA_STYLES[type].fill;
            ctx.fill();
            ctx.strokeStyle = AREA_STYLES[type].stroke;
            ctx.lineWidth = thinLine;
            ctx.stroke();
        });
    });

    ctx.strokeStyle = VIRTUAL_WALL_COLOR;
    ctx.lineWidth = opts.scale;
    ctx.lineCap = "round";
    enabledEntities("virtual_wall").forEach(wall => {
        tracePoints(wall.points);
        ctx.stroke();
    });

    ctx.strokeStyle = opts.pathColor;
    ctx.lineWidth = thinLine;
    data.entities
        .filter(e => e.type === "path" || e.type === "predicted_path")
        .forEach(path => {
            tracePoints(path.points);
            ctx.stroke();
        });

    // Calibration: 3 points, computed directly from pixelSize - no manual entry needed.
    // Grid (canvas, pre-scale) point (gx, gy) <-> vacuum mm point (mmX, mmY):
    //   mmX = (gx + offsetX) * pixelSize ; mmY = (gy + offsetY) * pixelSize
    const gridToMap = (gx: number, gy: number): { x: number; y: number } => ({
        x: gx * opts.scale,
        y: gy * opts.scale,
    });
    const gridToVacuum = (gx: number, gy: number): { x: number; y: number } => ({
        x: (gx + offsetX) * data.pixelSize,
        y: (gy + offsetY) * data.pixelSize,
    });
    const calibrationGridPoints: [number, number][] = [
        [0, 0],
        [gridWidth, 0],
        [0, gridHeight],
    ];
    const calibrationPoints: CalibrationPoint[] = calibrationGridPoints.map(([gx, gy]) => ({
        map: gridToMap(gx, gy),
        vacuum: gridToVacuum(gx, gy),
    }));

    return {
        dataUrl: canvas.toDataURL("image/png"),
        calibrationPoints,
        rooms,
        robot: findMarker(data, "robot_position"),
        charger: findMarker(data, "charger_location"),
        goToTarget: findMarker(data, "go_to_target"),
    };
}

/**
 * Fetches a Valetudo camera entity's current snapshot and extracts the
 * embedded map JSON - a plain HTTP GET of a small PNG, decoded in the
 * browser, same technique as Hypfer/lovelace-valetudo-map-card.
 */
export async function fetchValetudoMap(
    hass: HomeAssistantFixed,
    cameraEntityId: string,
    previousFingerprint?: string,
): Promise<ValetudoMapSnapshot> {
    const state = hass.states[cameraEntityId];
    if (!state) {
        throw new Error(`Entity not found: ${cameraEntityId}`);
    }
    const picturePath = state.attributes["entity_picture"];
    if (!picturePath) {
        throw new Error(`Entity ${cameraEntityId} has no entity_picture - is it a camera?`);
    }
    // fetchWithAuth prefixes the HA base URL itself, so it takes the relative entity_picture as is.
    const response = await hass.fetchWithAuth(picturePath);
    if (!response.ok) {
        throw new Error(`Failed to fetch camera image: ${response.status} ${response.statusText}`);
    }
    const chunk = extractValetudoMapChunk(await response.arrayBuffer());
    const currentFingerprint = fingerprint(chunk);
    if (currentFingerprint === previousFingerprint) {
        return { fingerprint: currentFingerprint };
    }
    return { fingerprint: currentFingerprint, data: parseValetudoMapChunk(chunk) };
}
