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
import { captureSelection, restoreSelection, SelectionSnapshot } from "../model/selection-rebuild";
import { getWatchedEntitiesForMapMode } from "../utils";
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

/**
 * Shows the mode at `newModeIndex` and builds its selectable objects.
 *
 * Without `keep` the selection starts fresh (a mode switch, the clear action, a run with
 * `clean_selection_on_start`): manual shapes are removed and predefined objects take their
 * `default_state` or `state_entity` state. With `keep` (a rebuild, see `rebuildSelection`) the
 * user's selection survives: manual shapes stay, predefined objects that still exist keep their
 * selection and its order, and only objects that disappeared leave it.
 */
export function setCurrentMode(card: XiaomiVacuumMapCard, newModeIndex: number, manual = true, keep?: SelectionSnapshot): void {
    const newMode = card.modes[newModeIndex];
    const snapshot = keep && keep.selectionType === newMode?.selectionType ? keep : undefined;
    if (!snapshot) {
        card.selectedManualRectangles = [];
        card.selectedManualPoint = undefined;
        card.selectedManualPath.clear();
    }
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
            card.selectedPredefinedRectangles = restoreSelection(card.selectablePredefinedRectangles, snapshot);
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
                    stale: staleRoomIds.has(String(room.id)),
                });
            });
            // A rebuild keeps the click order of the rooms that still exist: the order is the
            // cleaning order sent to the platform, and the rebuilt list is in room-id order.
            card.selectedRooms = restoreSelection(card.selectableRooms, snapshot);
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
            card.selectedPredefinedPoints = restoreSelection(card.selectablePredefinedPoints, snapshot);
            break;
    }
    // Every entity a selectable object is built from: a `state_entity` and the source of
    // entity-backed zones and points. A change of any of them rebuilds the mode.
    card.entitiesToManuallyUpdate = newMode ? [...getWatchedEntitiesForMapMode(newMode)] : [];
    card.builtRoomIdsKey = getLiveRoomIdsKey(card);
    if (card.selectedMode != newModeIndex && manual) forwardHaptic("selection");
    card.selectedMode = newModeIndex;
    selectionChanged(card);
    // The selected objects were replaced; without this the map keeps drawing the old ones until
    // an unrelated update arrives.
    card.requestUpdate();
}

/** The current selection, so a rebuild can keep it. Undefined when no mode is shown. */
export function captureCurrentSelection(card: XiaomiVacuumMapCard): SelectionSnapshot | undefined {
    const mode = card._getCurrentMode();
    if (!mode) return undefined;
    switch (mode.selectionType) {
        case SelectionType.PREDEFINED_RECTANGLE:
            return captureSelection(mode.selectionType, card.selectablePredefinedRectangles, card.selectedPredefinedRectangles);
        case SelectionType.ROOM:
            return captureSelection(mode.selectionType, card.selectableRooms, card.selectedRooms);
        case SelectionType.PREDEFINED_POINT:
            return captureSelection(mode.selectionType, card.selectablePredefinedPoints, card.selectedPredefinedPoints);
        default:
            return { selectionType: mode.selectionType, selectedKeys: [], knownKeys: new Set() };
    }
}

/**
 * Rebuilds the current mode's selectable objects from the current hass and config, keeping the
 * user's selection. Used for every rebuild the user did not ask for: an entity behind a selection
 * changed, the camera's rooms or colours changed.
 */
export function rebuildSelection(card: XiaomiVacuumMapCard): void {
    setCurrentMode(card, card.selectedMode, false, captureCurrentSelection(card));
}

/** The live camera room ids as one comparable value; undefined without metadata. */
function getLiveRoomIdsKey(card: XiaomiVacuumMapCard): string | undefined {
    if (!card.hass || !card.currentPreset) return undefined;
    const ids = getLiveRoomIds(card);
    return ids ? JSON.stringify([...ids].sort()) : undefined;
}

/**
 * Called after every card update. Rebuilds the current mode, keeping the selection, when an entity
 * a selectable object is built from changed (`entitiesChanged`) or, in a ROOM mode, when the
 * camera's room ids changed. Colour detection also rebuilds the rooms on a camera refresh, but it
 * is unavailable without a canvas or calibration; a room that left the metadata must still leave
 * the selection and its badge, and a new room must appear.
 */
export function updateSelectables(card: XiaomiVacuumMapCard, entitiesChanged: boolean): void {
    const roomsChanged =
        card._getCurrentMode()?.selectionType === SelectionType.ROOM && getLiveRoomIdsKey(card) !== card.builtRoomIdsKey;
    if (entitiesChanged || roomsChanged) rebuildSelection(card);
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
