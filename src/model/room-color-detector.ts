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

export interface RoomColorDetection {
    readonly imageData: ImageData;
    readonly regions: DetectedRoomColor[];
    readonly roomIdByColor: Map<number, string>;
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
            const candidates = Object.keys(rooms)
                .map(id => this._getCandidate(id, rooms[id], imageData, converter))
                .filter((candidate): candidate is RoomCandidate => candidate !== undefined);
            const colorAssignments = this._assignColors(candidates);
            const regions: DetectedRoomColor[] = [];
            const roomIdByColor = new Map<number, string>();

            colorAssignments.forEach((colorKey, id) => {
                const candidate = candidates.find(entry => entry.id === id);
                if (!candidate) return;
                const region = this._extractRegion(id, colorKey, candidate.bounds, imageData);
                if (!region) return;
                regions.push(region);
                roomIdByColor.set(colorKey, id);
            });

            return regions.length > 0 ? { imageData, regions, roomIdByColor } : undefined;
        } catch (_error) {
            // A remote image without canvas access cannot be segmented; callers keep their normal room config.
            return undefined;
        }
    }

    private static _getCandidate(
        id: string,
        room: MapExtractorRoom,
        imageData: ImageData,
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

    private static _extractRegion(
        id: string,
        colorKey: number,
        bounds: PixelBounds,
        imageData: ImageData,
    ): DetectedRoomColor | undefined {
        const width = bounds.right - bounds.left + 1;
        const height = bounds.bottom - bounds.top + 1;
        const mask = new Uint8Array(width * height);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const imageOffset = ((bounds.top + y) * imageData.width + bounds.left + x) * 4;
                const pixelOffset = y * width + x;
                if (
                    imageData.data[imageOffset + 3] >= 128 &&
                    this.getColorKey(
                        imageData.data[imageOffset],
                        imageData.data[imageOffset + 1],
                        imageData.data[imageOffset + 2],
                    ) === colorKey
                ) {
                    mask[pixelOffset] = 1;
                }
            }
        }

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
