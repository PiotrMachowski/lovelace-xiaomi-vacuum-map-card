import type { RoomConfig, RoomConfigEventData } from "../types/types";
import { MapExtractorRoom } from "../types/types";
import { cameraRefreshKey } from "../model/map-refresh-policy";
import { Room } from "../model/map_objects/room";
import { RoomColorDetector } from "../model/room-color-detector";
import { findStaleRoomIds } from "../model/room-config";
import { MapMode } from "../model/map_mode/map-mode";
import { SelectionType } from "../model/map_mode/selection-type";
import type { XiaomiVacuumMapCard } from "../xiaomi-vacuum-map-card";
import { setCurrentMode } from "./selection";

/** The live `rooms` attribute of the preset's camera, or undefined when it exposes none. */
export function getLiveRooms(card: XiaomiVacuumMapCard): Record<string, MapExtractorRoom> | undefined {
    const camera = card._getCurrentPreset()?.map_source?.camera;
    return camera
        ? (card.hass?.states[camera]?.attributes["rooms"] as Record<string, MapExtractorRoom> | undefined)
        : undefined;
}

/**
 * The live room ids of the preset's camera, or `undefined` when it reports no rooms metadata.
 * Used as the second, mode-independent guard in `_getSelection`.
 */
export function getLiveRoomIds(card: XiaomiVacuumMapCard): Set<string> | undefined {
    const rooms = getLiveRooms(card);
    const ids = rooms ? Object.keys(rooms) : [];
    return ids.length > 0 ? new Set(ids) : undefined;
}

/**
 * The current ROOM mode's configured ids that the live camera metadata no longer contains.
 * An empty list when the mode is not a ROOM mode or the camera exposes no metadata.
 *
 * The audit is deliberately recomputed from the current `hass` instead of trusting the room
 * objects: camera metadata can shift while a selection made against the old metadata is still
 * held, and that stale id must not reach the service call (issue #928).
 */
export function getStaleRoomIds(card: XiaomiVacuumMapCard, mode: MapMode | undefined): string[] {
    if (mode?.selectionType !== SelectionType.ROOM) return [];
    const configuredIds = (mode.predefinedSelections as RoomConfig[])
        .filter(room => room && room.id !== undefined)
        .map(room => room.id);
    return findStaleRoomIds(configuredIds, getLiveRooms(card));
}

export function getRoomsConfig(card: XiaomiVacuumMapCard, requestId?: string): RoomConfigEventData | undefined {
    const config = card._getCurrentPreset();
    const rooms = card.hass.states[config.map_source?.camera ?? ""]?.attributes["rooms"] as Record<
        string,
        MapExtractorRoom
    >;
    const roomsConfig = new Array<RoomConfig>();
    if (rooms) {
        const mode = card.modes.filter(m => m.selectionType === SelectionType.ROOM).reverse()[0];
        const modeIndex = mode ? card.modes.indexOf(mode) : -1;
        for (const room_id in rooms) {
            if (!rooms.hasOwnProperty(room_id)) continue;
            const room = rooms[room_id];
            const hasBounds = [room.x0, room.y0, room.x1, room.y1].every(value => typeof value === "number");
            if (!room.outline && !hasBounds) continue;
            const outline = room.outline ?? [
                [room.x0, room.y0],
                [room.x1, room.y0],
                [room.x1, room.y1],
                [room.x0, room.y1],
            ];
            const keepFloat = outline.toString().includes(".");
            const formatCoord = (v: number, divide = 1): number =>
                keepFloat ? v / divide : Math.round(v / divide);
            const x = outline.reduce((a, v) => a + (v[0] ?? 0), 0);
            const y = outline.reduce((a, v) => a + (v[1] ?? 0), 0);
            const region = card.roomColorDetection?.regions.find(candidate => candidate.id === room_id);
            const detectedCenter = region && card.coordinatesConverter
                ? card.coordinatesConverter.mapToVacuum(region.center[0], region.center[1])
                : undefined;

            const roomConfig = {
                id: room_id,
                icon: {
                    name: room.icon ?? "mdi:broom",
                    x: room.x ?? detectedCenter?.[0] ?? formatCoord(x, outline.length),
                    y: room.y ?? detectedCenter?.[1] ?? formatCoord(y, outline.length),
                },
                label: {
                    text: room.name ?? `Room ${room_id}`,
                    x: room.x ?? detectedCenter?.[0] ?? formatCoord(x, outline.length),
                    y: room.y ?? detectedCenter?.[1] ?? formatCoord(y, outline.length),
                    offset_y: 35,
                },
                outline: outline,
            } as RoomConfig;
            roomsConfig.push(roomConfig);
        }
        return {
            modeIndex: modeIndex,
            rooms: roomsConfig,
            entity: config.entity,
            camera: config.map_source?.camera,
            requestId: requestId,
        };
    }
    return undefined;
}

export function adjustRoomId(roomId: string | number, config: MapMode): string | number {
    if (config.idType === "number") {
        const roomIdAsNumber = +roomId;
        return isNaN(roomIdAsNumber) ? roomId : roomIdAsNumber;
    }
    return roomId;
}

export function detectRoomColors(card: XiaomiVacuumMapCard): void {
    const preset = card._getCurrentPreset();
    const camera = preset?.map_source?.camera;
    const entity = camera ? card.hass.states[camera] : undefined;
    const rooms = entity?.attributes?.rooms as Record<string, MapExtractorRoom> | undefined;
    const image = card._getMapCanvas();
    if (!camera || !entity || !rooms || !image?.width || !image.height) {
        const hadDetection = card.roomColorDetection !== undefined;
        card.roomColorDetection = undefined;
        card.lastRoomColorDetectionKey = undefined;
        if (hadDetection) card._refreshRoomsAfterColorDetection();
        return;
    }

    const detectionKey = cameraRefreshKey({
        cameraId: camera,
        lastUpdated: entity.last_updated ?? entity.last_changed,
        entityPicture: entity.attributes.entity_picture as string | undefined,
    });
    if (detectionKey === card.lastRoomColorDetectionKey) return;
    card.lastRoomColorDetectionKey = detectionKey;

    const previousDetection = card.roomColorDetection;
    card.roomColorDetection = card.coordinatesConverter
        ? RoomColorDetector.detect(image, rooms, card.coordinatesConverter)
        : undefined;
    if (!card.roomColorDetection && !previousDetection) return;

    card._refreshRoomsAfterColorDetection();
}

export function refreshRoomsAfterColorDetection(card: XiaomiVacuumMapCard): void {
    if (card._getCurrentMode()?.selectionType === SelectionType.ROOM) {
        const selectedRoomIds = card.selectedRooms.map(room => String(room.toVacuum()));
        setCurrentMode(card, card.selectedMode, false, selectedRoomIds);
        card.requestUpdate();
    }
}

export function handleRoomColorClick(card: XiaomiVacuumMapCard, event: MouseEvent): void {
    if (card._getCurrentMode()?.selectionType !== SelectionType.ROOM || !card.roomColorDetection || !card.realScale) {
        return;
    }
    if (event.target instanceof Element && event.target.closest(".clickable")) return;

    const point = card._getMousePosition(event);
    const x = Math.floor(point.x / card.realScale);
    const y = Math.floor(point.y / card.realScale);
    // The label map, not the pixel's colour: a tap on a cleaning path or the robot drawn over a
    // room still selects that room.
    const roomId = RoomColorDetector.roomIdAt(card.roomColorDetection, x, y);
    if (roomId === undefined) return;
    const room = card.selectableRooms.find(candidate => String(candidate.toVacuum()) === roomId);
    if (room) void room.click();
}
