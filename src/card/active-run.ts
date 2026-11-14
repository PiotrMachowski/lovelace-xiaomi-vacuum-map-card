import { state } from "lit/decorators";
import { advanceActiveRoomRun, loadActiveRoomRun, saveActiveRoomRun } from "../model/active-room-run";
import { SelectionType } from "../model/map_mode/selection-type";
import type { XiaomiVacuumMapCard } from "../xiaomi-vacuum-map-card";

/** The order of the run in progress for the current vacuum, while a ROOM mode is shown. */
export function getActiveRoomOrder(card: XiaomiVacuumMapCard): string[] {
    const run = card.activeRoomRun;
    if (!run || card._getCurrentMode()?.selectionType !== SelectionType.ROOM) return [];
    return run.entity === card._getCurrentPreset()?.entity ? run.roomIds : [];
}

/** Forgets the run on the map, e.g. when the user starts a new selection before it began. */
export function dismissActiveRoomRun(card: XiaomiVacuumMapCard): void {
    if (!card.activeRoomRun) return;
    saveActiveRoomRun(card.activeRoomRun.entity, undefined);
    card.activeRoomRun = undefined;
    card.requestUpdate();
}

/**
 * Loads the stored run for the current vacuum and advances it with the vacuum's state, so the
 * badges disappear once the vacuum is done. Called on every hass update.
 */
export function advanceCardActiveRun(card: XiaomiVacuumMapCard): void {
    const entity = card._getCurrentPreset()?.entity;
    if (!entity) return;
    if (card.activeRoomRunEntity !== entity) {
        // Storage is read once per vacuum, so a reload keeps showing a run in progress.
        card.activeRoomRunEntity = entity;
        card.activeRoomRun = loadActiveRoomRun(entity);
    }
    const current = card.activeRoomRun;
    const next = advanceActiveRoomRun(current, card._hass?.states[entity]?.state, Date.now());
    if (next === current) return;
    card.activeRoomRun = next;
    saveActiveRoomRun(entity, next);
    card.requestUpdate();
}
