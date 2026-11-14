import { MapExtractorRoom, PointType } from "../types/types";
import { CoordinatesConverter } from "./map_objects/coordinates-converter";

interface PixelBounds {
    readonly left: number;
    readonly top: number;
    readonly right: number;
    readonly bottom: number;
}

interface RoomCandidate {
    readonly id: string;
    readonly bounds: PixelBounds;
    readonly colors: Map<number, number>;
    readonly coloredPixels: number;
}

export interface DetectedRoomColor {
    readonly id: string;
    readonly colorKey: number;
    readonly center: PointType;
    readonly outline: PointType[];
}

/**
 * The part of `ImageData` room detection reads. Declaring it lets PNG fixtures and other pure
 * pixel buffers go through `detectFromImageData` without a browser canvas, while a real
 * `ImageData` still satisfies it.
 */
export interface ImageDataLike {
    readonly width: number;
    readonly height: number;
    readonly data: Uint8ClampedArray;
}

export interface RoomColorDetection {
    readonly imageData: ImageDataLike;
    readonly regions: DetectedRoomColor[];
    readonly roomIdByColor: Map<number, string>;
    /**
     * The room under each image pixel, as an index into `labelRoomIds` (-1 for none). Unlike the
     * colour lookup it covers what the map draws over a room (cleaning paths, the robot, small
     * markers), so a tap there still selects the room. Use `RoomColorDetector.roomIdAt`.
     */
    readonly labels: Int16Array;
    readonly labelRoomIds: string[];
}

/**
 * Gaps up to twice this many pixels wide inside a room are closed: a cleaning path or the robot
 * drawn over the room's fill splits the colour mask, which made the room shrink to its largest
 * piece and left the path unclickable. Another room's colour is never claimed.
 */
const GAP_CLOSING_RADIUS = 4;

interface RoomArea {
    /** The window the area covers: the room's camera bounds plus the closing radius. */
    readonly bounds: PixelBounds;
    readonly width: number;
    readonly height: number;
    /** 1 where the pixel belongs to the room. */
    readonly mask: Uint8Array;
    /** Distance from the room's own colour, for pixels the closing claimed. */
    readonly distance: Uint8Array;
}

interface BoundaryEdge {
    readonly startX: number;
    readonly startY: number;
    readonly endX: number;
    readonly endY: number;
    readonly direction: number;
}

export class RoomColorDetector {
    public static getColorKey(red: number, green: number, blue: number): number {
        return ((red >> 3) << 10) | ((green >> 3) << 5) | (blue >> 3);
    }

    /** The id of the room drawn at an image pixel, including what is drawn over its fill. */
    public static roomIdAt(detection: RoomColorDetection, x: number, y: number): string | undefined {
        const { width, height } = detection.imageData;
        if (x < 0 || y < 0 || x >= width || y >= height) return undefined;
        const label = detection.labels[y * width + x];
        return label >= 0 ? detection.labelRoomIds[label] : undefined;
    }

    public static detect(
        image: HTMLImageElement | HTMLCanvasElement,
        rooms: Record<string, MapExtractorRoom>,
        converter: CoordinatesConverter,
    ): RoomColorDetection | undefined {
        const isCanvas = image instanceof HTMLCanvasElement;
        const imageWidth = isCanvas ? image.width : image.naturalWidth;
        const imageHeight = isCanvas ? image.height : image.naturalHeight;
        if ((!isCanvas && !image.complete) || !imageWidth || !imageHeight || !converter.calibrated) {
            return undefined;
        }

        const canvas = isCanvas ? image : document.createElement("canvas");
        if (!isCanvas) {
            canvas.width = imageWidth;
            canvas.height = imageHeight;
        }
        const context = canvas.getContext("2d");
        if (!context) return undefined;

        try {
            if (!isCanvas) context.drawImage(image, 0, 0);
            const imageData = context.getImageData(0, 0, imageWidth, imageHeight);
            return this.detectFromImageData(imageData, rooms, converter);
        } catch (_error) {
            // A remote image without canvas access cannot be segmented; callers keep their normal room config.
            return undefined;
        }
    }

    /**
     * Pure room detection over raw RGBA pixels. `detect` is the browser/canvas wrapper; callers
     * that already have pixel data (PNG fixtures in tests, or a future non-canvas source) use
     * this directly. `converter` must be calibrated, which `detect` checks.
     */
    public static detectFromImageData(
        imageData: ImageDataLike,
        rooms: Record<string, MapExtractorRoom>,
        converter: CoordinatesConverter,
    ): RoomColorDetection | undefined {
        const candidates = Object.keys(rooms)
            .map(id => this._getCandidate(id, rooms[id], imageData, converter))
            .filter((candidate): candidate is RoomCandidate => candidate !== undefined);
        const colorAssignments = this._assignColors(candidates);
        const regions: DetectedRoomColor[] = [];
        const roomIdByColor = new Map<number, string>();
        const roomColors = new Set(colorAssignments.values());
        const labels = new Int16Array(imageData.width * imageData.height).fill(-1);
        const labelDistance = new Uint8Array(imageData.width * imageData.height).fill(255);
        const labelRoomIds: string[] = [];

        colorAssignments.forEach((colorKey, id) => {
            const candidate = candidates.find(entry => entry.id === id);
            if (!candidate) return;
            const area = this._closeRoomArea(colorKey, roomColors, candidate.bounds, imageData);
            const region = this._extractRegion(id, colorKey, area);
            if (!region) return;
            regions.push(region);
            roomIdByColor.set(colorKey, id);
            const label = labelRoomIds.push(id) - 1;
            this._label(area, label, labels, labelDistance, imageData.width);
        });

        return regions.length > 0 ? { imageData, regions, roomIdByColor, labels, labelRoomIds } : undefined;
    }

    private static _getCandidate(
        id: string,
        room: MapExtractorRoom,
        imageData: ImageDataLike,
        converter: CoordinatesConverter,
    ): RoomCandidate | undefined {
        if (room.outline) return undefined;
        const vacuumOutline = [
            [room.x0, room.y0],
            [room.x1, room.y0],
            [room.x1, room.y1],
            [room.x0, room.y1],
        ];
        if (vacuumOutline.some(point => point[0] === undefined || point[1] === undefined)) return undefined;

        const mapped = vacuumOutline.map(point => converter.vacuumToMap(point[0] as number, point[1] as number));
        const bounds = this._getBounds(mapped, imageData.width, imageData.height);
        if (!bounds) return undefined;

        const colors = new Map<number, number>();
        let coloredPixels = 0;
        for (let y = bounds.top; y <= bounds.bottom; y++) {
            for (let x = bounds.left; x <= bounds.right; x++) {
                const offset = (y * imageData.width + x) * 4;
                if (imageData.data[offset + 3] < 128) continue;
                const red = imageData.data[offset];
                const green = imageData.data[offset + 1];
                const blue = imageData.data[offset + 2];
                const maximum = Math.max(red, green, blue);
                const minimum = Math.min(red, green, blue);
                if (maximum - minimum < 24 || maximum < 55) continue;
                const key = this.getColorKey(red, green, blue);
                colors.set(key, (colors.get(key) ?? 0) + 1);
                coloredPixels++;
            }
        }

        if (coloredPixels < 8 || colors.size === 0) return undefined;
        return { id, bounds, colors, coloredPixels };
    }

    private static _getBounds(points: PointType[], imageWidth: number, imageHeight: number): PixelBounds | undefined {
        const left = Math.max(0, Math.floor(Math.min(...points.map(point => point[0]))));
        const top = Math.max(0, Math.floor(Math.min(...points.map(point => point[1]))));
        const right = Math.min(imageWidth - 1, Math.ceil(Math.max(...points.map(point => point[0]))));
        const bottom = Math.min(imageHeight - 1, Math.ceil(Math.max(...points.map(point => point[1]))));
        if (right < left || bottom < top) return undefined;
        return { left, top, right, bottom };
    }

    private static _assignColors(candidates: RoomCandidate[]): Map<string, number> {
        const pairs: Array<{ id: string; colorKey: number; share: number; count: number }> = [];
        candidates.forEach(candidate => {
            candidate.colors.forEach((count, colorKey) => {
                if (count < Math.max(8, candidate.coloredPixels * 0.04)) return;
                pairs.push({
                    id: candidate.id,
                    colorKey,
                    share: count / candidate.coloredPixels,
                    count,
                });
            });
        });
        pairs.sort((a, b) => b.share - a.share || b.count - a.count);

        const assignedRooms = new Set<string>();
        const assignedColors = new Set<number>();
        const assignments = new Map<string, number>();
        pairs.forEach(pair => {
            if (pair.share < 0.08 || assignedRooms.has(pair.id) || assignedColors.has(pair.colorKey)) return;
            assignedRooms.add(pair.id);
            assignedColors.add(pair.colorKey);
            assignments.set(pair.id, pair.colorKey);
        });
        return assignments;
    }

    /**
     * The room's pixels after closing small gaps: its own colour, plus pixels of anything drawn over
     * it (a path, the robot) in gaps up to 2 * GAP_CLOSING_RADIUS wide. This is a morphological
     * closing with a square element: grow the colour mask by the radius, then shrink it back, so the
     * outer border does not grow. Another room's colour is never claimed. `distance` is how far a
     * claimed pixel is from the room's own colour (0 for its own pixels).
     */
    private static _closeRoomArea(
        colorKey: number,
        roomColors: Set<number>,
        roomBounds: PixelBounds,
        imageData: ImageDataLike,
    ): RoomArea {
        const radius = GAP_CLOSING_RADIUS;
        const bounds: PixelBounds = {
            left: Math.max(0, roomBounds.left - radius),
            top: Math.max(0, roomBounds.top - radius),
            right: Math.min(imageData.width - 1, roomBounds.right + radius),
            bottom: Math.min(imageData.height - 1, roomBounds.bottom + radius),
        };
        const width = bounds.right - bounds.left + 1;
        const height = bounds.bottom - bounds.top + 1;
        const own = new Uint8Array(width * height);
        const foreignRoom = new Uint8Array(width * height);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const imageOffset = ((bounds.top + y) * imageData.width + bounds.left + x) * 4;
                if (imageData.data[imageOffset + 3] < 128) continue;
                const key = this.getColorKey(
                    imageData.data[imageOffset],
                    imageData.data[imageOffset + 1],
                    imageData.data[imageOffset + 2],
                );
                if (key === colorKey) own[y * width + x] = 1;
                else if (roomColors.has(key)) foreignRoom[y * width + x] = 1;
            }
        }

        // Grow: Chebyshev distance to the room's own colour, up to the radius.
        const distance = this._chebyshevDistance(own, width, height, radius + 1);
        const grown = new Uint8Array(width * height);
        for (let index = 0; index < grown.length; index++) grown[index] = distance[index] <= radius ? 1 : 0;

        // Shrink back: keep a grown pixel only when no pixel outside the grown area (or outside the
        // window) is within the radius.
        const outside = new Uint8Array(width * height);
        for (let index = 0; index < outside.length; index++) outside[index] = grown[index] ? 0 : 1;
        const toOutside = this._chebyshevDistance(outside, width, height, radius + 1);
        const mask = new Uint8Array(width * height);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const index = y * width + x;
                if (own[index]) {
                    mask[index] = 1;
                    continue;
                }
                if (!grown[index] || foreignRoom[index]) continue;
                const toEdge = Math.min(x + 1, y + 1, width - x, height - y);
                if (Math.min(toOutside[index], toEdge) > radius) mask[index] = 1;
            }
        }
        return { bounds, width, height, mask, distance };
    }

    /** Chebyshev (8-neighbour) distance to the nearest set pixel, capped at `cap`. */
    private static _chebyshevDistance(source: Uint8Array, width: number, height: number, cap: number): Uint8Array {
        const distance = new Uint8Array(source.length).fill(cap);
        const queue = new Int32Array(source.length);
        let head = 0;
        let tail = 0;
        for (let index = 0; index < source.length; index++) {
            if (!source[index]) continue;
            distance[index] = 0;
            queue[tail++] = index;
        }
        while (head < tail) {
            const index = queue[head++];
            const next = distance[index] + 1;
            if (next >= cap) continue;
            const x = index % width;
            const y = (index - x) / width;
            for (let neighborY = Math.max(0, y - 1); neighborY <= Math.min(height - 1, y + 1); neighborY++) {
                for (let neighborX = Math.max(0, x - 1); neighborX <= Math.min(width - 1, x + 1); neighborX++) {
                    const neighbor = neighborY * width + neighborX;
                    if (distance[neighbor] <= next) continue;
                    distance[neighbor] = next;
                    queue[tail++] = neighbor;
                }
            }
        }
        return distance;
    }

    /** Writes a room's area into the image-wide label map; the nearer room wins a shared pixel. */
    private static _label(
        area: RoomArea,
        label: number,
        labels: Int16Array,
        labelDistance: Uint8Array,
        imageWidth: number,
    ): void {
        for (let y = 0; y < area.height; y++) {
            for (let x = 0; x < area.width; x++) {
                const index = y * area.width + x;
                if (!area.mask[index]) continue;
                const imageIndex = (area.bounds.top + y) * imageWidth + area.bounds.left + x;
                if (area.distance[index] < labelDistance[imageIndex]) {
                    labels[imageIndex] = label;
                    labelDistance[imageIndex] = area.distance[index];
                }
            }
        }
    }

    private static _extractRegion(id: string, colorKey: number, area: RoomArea): DetectedRoomColor | undefined {
        const { bounds, width, height, mask } = area;

        const visited = new Uint8Array(mask.length);
        const queue = new Int32Array(mask.length);
        let largestComponent = new Int32Array(0);
        let largestX = 0;
        let largestY = 0;

        for (let start = 0; start < mask.length; start++) {
            if (!mask[start] || visited[start]) continue;
            let head = 0;
            let tail = 0;
            let sumX = 0;
            let sumY = 0;
            queue[tail++] = start;
            visited[start] = 1;

            while (head < tail) {
                const index = queue[head++];
                const x = index % width;
                const y = Math.floor(index / width);
                sumX += x + 0.5;
                sumY += y + 0.5;
                for (let neighborY = Math.max(0, y - 1); neighborY <= Math.min(height - 1, y + 1); neighborY++) {
                    for (let neighborX = Math.max(0, x - 1); neighborX <= Math.min(width - 1, x + 1); neighborX++) {
                        const neighbor = neighborY * width + neighborX;
                        if (!mask[neighbor] || visited[neighbor]) continue;
                        visited[neighbor] = 1;
                        queue[tail++] = neighbor;
                    }
                }
            }

            if (tail > largestComponent.length) {
                largestComponent = queue.slice(0, tail);
                largestX = sumX / tail;
                largestY = sumY / tail;
            }
        }

        if (largestComponent.length < 8) return undefined;
        const componentMask = new Uint8Array(mask.length);
        largestComponent.forEach(index => (componentMask[index] = 1));
        const outline = this._getOutline(componentMask, width, height, bounds.left, bounds.top);
        if (outline.length < 3) return undefined;
        return {
            id,
            colorKey,
            center: [bounds.left + largestX, bounds.top + largestY],
            outline,
        };
    }

    private static _getOutline(
        mask: Uint8Array,
        width: number,
        height: number,
        offsetX: number,
        offsetY: number,
    ): PointType[] {
        const edges: BoundaryEdge[] = [];
        const outgoing = new Map<number, number[]>();
        const vertexKey = (x: number, y: number): number => y * (width + 1) + x;
        const addEdge = (startX: number, startY: number, endX: number, endY: number, direction: number): void => {
            const edgeId = edges.length;
            edges.push({ startX, startY, endX, endY, direction });
            const key = vertexKey(startX, startY);
            outgoing.set(key, [...(outgoing.get(key) ?? []), edgeId]);
        };
        const filled = (x: number, y: number): boolean =>
            x >= 0 && x < width && y >= 0 && y < height && mask[y * width + x] === 1;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (!filled(x, y)) continue;
                if (!filled(x, y - 1)) addEdge(x, y, x + 1, y, 0);
                if (!filled(x + 1, y)) addEdge(x + 1, y, x + 1, y + 1, 1);
                if (!filled(x, y + 1)) addEdge(x + 1, y + 1, x, y + 1, 2);
                if (!filled(x - 1, y)) addEdge(x, y + 1, x, y, 3);
            }
        }

        const used = new Uint8Array(edges.length);
        let largestLoop: PointType[] = [];
        let largestArea = 0;
        for (let start = 0; start < edges.length; start++) {
            if (used[start]) continue;
            const first = edges[start];
            const loop: PointType[] = [[first.startX, first.startY]];
            let current = start;
            let closed = false;
            let steps = 0;
            while (!used[current] && steps <= edges.length) {
                steps++;
                used[current] = 1;
                const edge = edges[current];
                loop.push([edge.endX, edge.endY]);
                if (edge.endX === first.startX && edge.endY === first.startY) {
                    closed = true;
                    break;
                }
                const nextEdges = (outgoing.get(vertexKey(edge.endX, edge.endY)) ?? []).filter(edgeId => !used[edgeId]);
                if (nextEdges.length === 0) break;
                nextEdges.sort((left, right) => {
                    const leftTurn = (edges[left].direction - edge.direction + 4) % 4;
                    const rightTurn = (edges[right].direction - edge.direction + 4) % 4;
                    const priority = (turn: number): number => (turn === 1 ? 0 : turn === 0 ? 1 : turn === 3 ? 2 : 3);
                    return priority(leftTurn) - priority(rightTurn);
                });
                current = nextEdges[0];
            }
            if (!closed || loop.length < 4) continue;
            const area = Math.abs(this._polygonArea(loop));
            if (area > largestArea) {
                largestArea = area;
                largestLoop = loop;
            }
        }

        return this._simplifyClosed(largestLoop, 2.5).map(point => [point[0] + offsetX, point[1] + offsetY]);
    }

    private static _polygonArea(points: PointType[]): number {
        let area = 0;
        points.forEach((point, index) => {
            const next = points[(index + 1) % points.length];
            area += point[0] * next[1] - next[0] * point[1];
        });
        return area / 2;
    }

    private static _simplifyClosed(points: PointType[], tolerance: number): PointType[] {
        if (points.length < 5) return points.slice(0, -1);
        const ring = points.slice(0, -1);
        let split = 1;
        let distance = 0;
        ring.forEach((point, index) => {
            const dx = point[0] - ring[0][0];
            const dy = point[1] - ring[0][1];
            const currentDistance = dx * dx + dy * dy;
            if (currentDistance > distance) {
                split = index;
                distance = currentDistance;
            }
        });
        const first = this._simplifyOpen(ring.slice(0, split + 1), tolerance);
        const second = this._simplifyOpen([...ring.slice(split), ring[0]], tolerance);
        return [...first.slice(0, -1), ...second.slice(0, -1)];
    }

    private static _simplifyOpen(points: PointType[], tolerance: number): PointType[] {
        if (points.length <= 2) return points;
        const keep = new Uint8Array(points.length);
        const stack: Array<[number, number]> = [[0, points.length - 1]];
        const threshold = tolerance * tolerance;
        keep[0] = 1;
        keep[points.length - 1] = 1;
        while (stack.length > 0) {
            const [start, end] = stack.pop() as [number, number];
            const first = points[start];
            const last = points[end];
            const dx = last[0] - first[0];
            const dy = last[1] - first[1];
            const lengthSquared = dx * dx + dy * dy;
            let farthest = -1;
            let farthestDistance = threshold;
            for (let index = start + 1; index < end; index++) {
                const point = points[index];
                const position = lengthSquared === 0
                    ? 0
                    : Math.max(0, Math.min(1, ((point[0] - first[0]) * dx + (point[1] - first[1]) * dy) / lengthSquared));
                const nearestX = first[0] + position * dx;
                const nearestY = first[1] + position * dy;
                const distanceX = point[0] - nearestX;
                const distanceY = point[1] - nearestY;
                const currentDistance = distanceX * distanceX + distanceY * distanceY;
                if (currentDistance > farthestDistance) {
                    farthestDistance = currentDistance;
                    farthest = index;
                }
            }
            if (farthest >= 0) {
                keep[farthest] = 1;
                stack.push([start, farthest], [farthest, end]);
            }
        }
        return points.filter((_point, index) => keep[index] === 1);
    }
}
