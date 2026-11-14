/* eslint-disable @typescript-eslint/no-explicit-any */
import { svg, SVGTemplateResult } from "lit";
import { property } from "lit/decorators";
import { forwardHaptic } from "custom-card-helpers";
import type { PredefinedPointConfig, RoomConfig } from "../types/types";
import { PredefinedZoneConfig, VariablesStorage } from "../types/types";
import { EVENT_SELECTION_CHANGED } from "../const";
import { ManualRectangle } from "../model/map_objects/manual-rectangle";
import { Context } from "../model/map_objects/context";
import { PredefinedPoint } from "../model/map_objects/predefined-point";
import { PredefinedMultiRectangle } from "../model/map_objects/predefined-multi-rectangle";
import { Room } from "../model/map_objects/room";
import { MapMode } from "../model/map_mode/map-mode";
import { SelectionType } from "../model/map_mode/selection-type";
import { RepeatsType } from "../model/map_mode/repeats-type";
import { MapObject } from "../model/map_objects/map-object";
import type { XiaomiVacuumMapCard } from "../xiaomi-vacuum-map-card";
import { adjustRoomId } from "./rooms";
import { calculateBasicScale } from "./map-view";
import { dismissActiveRoomRun } from "./active-run";
import { getActiveRoomOrder } from "./active-run";
import { getLiveRoomIds } from "./rooms";
import { getRoomsConfig } from "./rooms";
import { getStaleRoomIds } from "./rooms";
import { runSelection } from "./run";

export function createContext(card: XiaomiVacuumMapCard): Context {
    return new Context(
        () => card.mapScale,
        () => card.realScale,
        event => card._getMousePosition(event),
        () => card.requestUpdate(),
        () => selectionChanged(card),
        () => card.coordinatesConverter,
        () => card.selectedManualRectangles,
        () => card.selectedPredefinedRectangles,
        () => card.selectedRooms,
        () => card.selectedPredefinedPoints,
        () => card._getCurrentMode()?.coordinatesRounding ?? false,
        () => card._getCurrentMode()?.coordinatesToMetersDivider ?? 1,
        () => card._getCurrentMode()?.maxSelections ?? 0,
        property => card._getCssProperty(property),
        () => runImmediately(card),
        string => card._localize(string),
        entity => card._hass.states[entity].state,
        entity => card._hass.callService("homeassistant", "toggle", {"entity_id": entity}),
        () => getActiveRoomOrder(card),
        () => getActiveRoomOrder(card).length > 0 && card.activeRoomRun?.seenActive === true,
        () => dismissActiveRoomRun(card),
    );
}

export function setCurrentMode(card: XiaomiVacuumMapCard, newModeIndex: number, manual = true, preserveSelectedRoomIds?: string[]): void {
    const newMode = card.modes[newModeIndex];
    card.selectedManualRectangles = [];
    card.selectedManualPoint = undefined;
    card.selectedManualPath.clear();
    card.selectedPredefinedRectangles = [];
    card.selectedRooms = [];
    card.selectedPredefinedPoints = [];
    card.selectablePredefinedRectangles = [];
    card.selectableRooms = [];
    card.selectablePredefinedPoints = [];

    switch (newMode?.selectionType) {
        case SelectionType.PREDEFINED_RECTANGLE:
            const zonesFromEntities = PredefinedMultiRectangle.getFromEntities(newMode, card.hass, () =>
                createContext(card),
            );
            const manualZones = newMode.predefinedSelections
                .map(ps => ps as PredefinedZoneConfig)
                .filter(pzc => typeof pzc.zones !== "string")
                .map(pzc => new PredefinedMultiRectangle(pzc, createContext(card)));
            card.selectablePredefinedRectangles = zonesFromEntities.concat(manualZones);
            card.selectedPredefinedRectangles = card.selectablePredefinedRectangles.filter(s => s.selected);
            card.entitiesToManuallyUpdate = newMode.predefinedSelections
                .filter(s => s.state_entity)
                .map(s => s.state_entity as string);
            break;
        case SelectionType.ROOM:
            const configuredRooms = newMode.predefinedSelections.map(ps => ps as RoomConfig);
            const extractedRooms = getRoomsConfig(card)?.rooms;
            const staleRoomIds = new Set(getStaleRoomIds(card, newMode));
            const configuredRoomsById = new Map(configuredRooms.map(room => [String(room.id), room]));
            // A configured id the camera no longer reports is still drawn, from its configured
            // (now wrong) outline, so the warning has something to point at. It is marked stale
            // and cannot be selected; `_getSelection` is the second guard for a selection that
            // predates a re-map.
            const staleRooms = [...staleRoomIds]
                .map(id => configuredRoomsById.get(id))
                .filter((room): room is RoomConfig => room !== undefined);
            const roomConfigs = extractedRooms?.length ? [...extractedRooms, ...staleRooms] : configuredRooms;
            const detectedRegions = new Map(
                (card.roomColorDetection?.regions ?? []).map(region => [region.id, region]),
            );
            card.selectableRooms = roomConfigs.map(room => {
                const configured = configuredRoomsById.get(String(room.id));
                const region = detectedRegions.get(String(room.id));
                const center = room.label ? [room.label.x, room.label.y] : undefined;
                const config: RoomConfig = {
                    ...configured,
                    ...room,
                    icon: configured?.icon
                        ? { ...configured.icon, x: center?.[0] ?? configured.icon.x, y: center?.[1] ?? configured.icon.y }
                        : undefined,
                    label: region && room.label
                        ? { ...room.label, offset_x: 0, offset_y: 0 }
                        : room.label ?? configured?.label,
                    variables: configured?.variables,
                    default_state: configured?.default_state,
                    state_entity: configured?.state_entity,
                };
                return new Room(config, createContext(card), {
                    imageOutline: region?.outline,
                    selected: preserveSelectedRoomIds?.includes(String(room.id)),
                    stale: staleRoomIds.has(String(room.id)),
                });
            });
            // A rebuild keeps the click order of the rooms it preserves: the order is the
            // cleaning order sent to the platform, and the rebuilt list is in room-id order.
            const preservedOrder = (room: Room): number => {
                const index = preserveSelectedRoomIds?.indexOf(String(room.toVacuum())) ?? -1;
                return index < 0 ? Number.MAX_SAFE_INTEGER : index;
            };
            card.selectedRooms = card.selectableRooms
                .filter(s => s.selected)
                .sort((a, b) => preservedOrder(a) - preservedOrder(b));
            card.entitiesToManuallyUpdate = newMode.predefinedSelections
                .filter(s => s.state_entity)
                .map(s => s.state_entity as string);
            break;
        case SelectionType.PREDEFINED_POINT:
            const pointsFromEntities = PredefinedPoint.getFromEntities(newMode, card.hass, () =>
                createContext(card),
            );
            const manualPoints = newMode.predefinedSelections
                .map(ps => ps as PredefinedPointConfig)
                .filter(ppc => typeof ppc.position !== "string")
                .map(ppc => new PredefinedPoint(ppc, createContext(card)));
            card.selectablePredefinedPoints = pointsFromEntities.concat(manualPoints);
            card.selectedPredefinedPoints = card.selectablePredefinedPoints.filter(s => s.selected);
            card.entitiesToManuallyUpdate = newMode.predefinedSelections
                .filter(s => s.state_entity)
                .map(s => s.state_entity as string);
            break;
    }
    if (card.selectedMode != newModeIndex && manual) forwardHaptic("selection");
    card.selectedMode = newModeIndex;
    selectionChanged(card);
}

/**
 * The selected rooms that may be sent. The configured-id audit cannot see a room that was
 * picked from the detected metadata in a template-only mode. Its `stale` flag was captured when
 * the room was built, so the id is also checked against the live metadata here; otherwise a
 * selection held across an id shift would still be sent. Undefined metadata means the camera
 * reports no rooms, where the configured fallback must keep working.
 */
export function getUsableSelectedRooms(card: XiaomiVacuumMapCard, mode: MapMode): Room[] {
    const staleRoomIds = new Set(getStaleRoomIds(card, mode));
    const liveRoomIds = getLiveRoomIds(card);
    return card.selectedRooms.filter(room => {
        const id = String(room.toVacuum());
        return !room.stale && !staleRoomIds.has(id) && (!liveRoomIds || liveRoomIds.has(id));
    });
}

export function getSelection(card: XiaomiVacuumMapCard, mode: MapMode | undefined): { selection: unknown[]; variables: VariablesStorage } {
    if (!mode) {
        return { selection: [], variables: {} };
    }
    const repeats = mode.repeatsType === RepeatsType.INTERNAL ? card.repeats : null;
    let selection: unknown[] = [];
    let variables: VariablesStorage = {};
    const variablesExtractor = (mos: Array<MapObject | undefined>): VariablesStorage => ({
        ...(mos[0]?.variables ?? {}),
        variables: mos.map(r => r?.variables ?? {}),
    });
    switch (mode.selectionType) {
        case SelectionType.MANUAL_RECTANGLE:
            selection = card.selectedManualRectangles.map(r => r.toVacuum(repeats));
            variables = variablesExtractor(card.selectedManualRectangles);
            break;
        case SelectionType.PREDEFINED_RECTANGLE:
            selection = card.selectedPredefinedRectangles
                .map(r => r.toVacuum(repeats))
                .reduce((a, v) => a.concat(v), [] as unknown[]);
            variables = card.selectedPredefinedRectangles[0]?.variables ?? {};
            variables = variablesExtractor(card.selectedPredefinedRectangles);
            break;
        case SelectionType.ROOM:
            const usableRooms = getUsableSelectedRooms(card, mode);
            const selectedRooms = usableRooms
                .map(r => r.toVacuum())
                .map(r => adjustRoomId(r, mode));
            selection = [...selectedRooms, ...(repeats && selectedRooms.length > 0 ? [repeats] : [])];
            variables = variablesExtractor(usableRooms);
            break;
        case SelectionType.MANUAL_PATH:
            selection = card.selectedManualPath.toVacuum(repeats);
            variables = card.selectedManualPath.variables ?? {};
            variables = variablesExtractor([card.selectedManualPath]);
            break;
        case SelectionType.MANUAL_POINT:
            selection = card.selectedManualPoint?.toVacuum(repeats) ?? [];
            variables = variablesExtractor([card.selectedManualPoint]);
            break;
        case SelectionType.PREDEFINED_POINT:
            selection = card.selectedPredefinedPoints
                .map(p => p.toVacuum(repeats))
                .reduce((a, v) => a.concat(v), [] as unknown[]);
            variables = variablesExtractor(card.selectedPredefinedPoints);
            break;
    }
    if (mode.repeatsType === RepeatsType.REPEAT) {
        selection = Array(card.repeats)
            .fill(0)
            .flatMap(() => selection);
    }
    return { selection, variables };
}

export async function runImmediately(card: XiaomiVacuumMapCard): Promise<boolean> {
    if (card._getCurrentMode()?.runImmediately ?? false) {
        await runSelection(card, false);
        return true;
    }
    return false;
}

export function selectionChanged(card: XiaomiVacuumMapCard): void {
    const currentMode = card._getCurrentMode();
    const { selection } = card._getSelection(currentMode);

    if (card.isInEditor) {
        const event = new Event(EVENT_SELECTION_CHANGED);
        (event as any).selection = selection ?? "[]";
        window.dispatchEvent(event);
    }
}

export function drawSelection(card: XiaomiVacuumMapCard): SVGTemplateResult | null {
    switch (card._getCurrentMode()?.selectionType) {
        case SelectionType.MANUAL_RECTANGLE:
            return svg`${card.selectedManualRectangles.map(r => r.render())}`;
        case SelectionType.PREDEFINED_RECTANGLE:
            return svg`${card.selectablePredefinedRectangles.map(r => r.render())}`;
        case SelectionType.ROOM:
            return svg`${card.selectableRooms.map(r => r.render())}`;
        case SelectionType.MANUAL_PATH:
            return svg`${card.selectedManualPath?.render()}`;
        case SelectionType.MANUAL_POINT:
            return svg`${card.selectedManualPoint?.render()}`;
        case SelectionType.PREDEFINED_POINT:
            return svg`${card.selectablePredefinedPoints.map(p => p.render())}`;
        default:
            return null;
    }
}

export function addRectangle(card: XiaomiVacuumMapCard): void {
    const preset = card._getCurrentPreset();
    const currentMode = card._getCurrentMode();
    const marginTop = preset.map_source.crop?.top ?? 0;
    const marginBottom = preset.map_source.crop?.bottom ?? 0;
    const marginLeft = preset.map_source.crop?.left ?? 0;
    const marginRight = preset.map_source.crop?.right ?? 0;
    calculateBasicScale(card);
    if (!currentMode || card.selectedManualRectangles.length >= currentMode.maxSelections) {
        forwardHaptic("failure");
        return;
    }
    const actualHeight = card.realImageHeight * card.realScale - marginTop - marginBottom;
    const actualWidth = card.realImageWidth * card.realScale - marginLeft - marginRight;
    const name = (card.selectedManualRectangles.length + 1).toString();
    const x = (actualWidth / 3 + marginLeft - card.mapX) / card.mapScale;
    const y = (actualHeight / 3 + marginTop - card.mapY) / card.mapScale;
    const width = actualWidth / 3 / card.mapScale;
    const height = actualHeight / 3 / card.mapScale;
    card.selectedManualRectangles.push(new ManualRectangle(x, y, width, height, name, createContext(card)));
    selectionChanged(card);
    forwardHaptic("selection");
    card.requestUpdate();
}
