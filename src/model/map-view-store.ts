import { MAP_VIEW_STORE_KEY, MAP_VIEW_STORE_LIMIT } from "../const";

export interface MapView {
    scale: number;
    x: number;
    y: number;
    rotation: number;
    locked?: boolean;
}

interface StoredMapView {
    s: number;
    x: number;
    y: number;
    r?: number;
    l?: boolean;
    ts: number;
}

type MapViewStorage = Record<string, StoredMapView>;

export function hashString(value: string): string {
    let hash = 5381;
    for (let i = 0; i < value.length; i++) {
        hash = (hash << 5) + hash + value.charCodeAt(i);
        hash |= 0;
    }
    return (hash >>> 0).toString(36);
}

function read(): MapViewStorage {
    try {
        const raw = window.localStorage.getItem(MAP_VIEW_STORE_KEY);
        if (!raw) {
            return {};
        }
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as MapViewStorage) : {};
    } catch (e) {
        return {};
    }
}

function write(storage: MapViewStorage): void {
    try {
        const keys = Object.keys(storage);
        if (keys.length > MAP_VIEW_STORE_LIMIT) {
            keys.map(key => [key, storage[key]] as [string, StoredMapView])
                .sort(([, a], [, b]) => (a.ts ?? 0) - (b.ts ?? 0))
                .slice(0, keys.length - MAP_VIEW_STORE_LIMIT)
                .forEach(([key]) => delete storage[key]);
        }
        window.localStorage.setItem(MAP_VIEW_STORE_KEY, JSON.stringify(storage));
    } catch (e) {
        // storage unavailable or full - persisting the map view is best effort
    }
}

export function getMapView(key: string): MapView | undefined {
    const entry = read()[key];
    if (!entry || typeof entry !== "object") {
        return undefined;
    }
    const scale = Number(entry.s);
    const x = Number(entry.x);
    const y = Number(entry.y);
    const rotation = Number(entry.r ?? 0);
    if (!Number.isFinite(scale) || !Number.isFinite(x) || !Number.isFinite(y) || scale <= 0) {
        return undefined;
    }
    return {
        scale,
        x,
        y,
        rotation: Number.isFinite(rotation) ? normalizeAngle(rotation) : 0,
        locked: typeof entry.l === "boolean" ? entry.l : undefined,
    };
}

export function setMapView(key: string, view: MapView): void {
    const storage = read();
    storage[key] = {
        s: view.scale,
        x: view.x,
        y: view.y,
        r: view.rotation,
        l: view.locked,
        ts: new Date().getTime(),
    };
    write(storage);
}

/** Keeps an angle in [0, 360) so stored values stay comparable however many turns were made. */
export function normalizeAngle(degrees: number): number {
    const normalized = degrees % 360;
    return normalized < 0 ? normalized + 360 : normalized;
}
