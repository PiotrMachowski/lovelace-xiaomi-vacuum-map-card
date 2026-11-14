/* eslint-disable @typescript-eslint/no-explicit-any */
import { ActionHandlerEvent, forwardHaptic } from "custom-card-helpers";
import { ActionHandlerFunction } from "../types/types";
import { EVENT_SERVICE_CALL } from "../const";
import { saveActiveRoomRun } from "../model/active-room-run";
import type { ServiceCall } from "../model/map_mode/service-call";
import { SelectionType } from "../model/map_mode/selection-type";
import type { XiaomiVacuumMapCard } from "../xiaomi-vacuum-map-card";
import { getUsableSelectedRooms } from "./selection";
import { selectionChanged } from "./selection";
import { setCurrentMode } from "./selection";

export async function handleServiceCallGet(card: XiaomiVacuumMapCard): Promise<void> {
    const currentPreset = card._getCurrentPreset();
    const currentMode = card._getCurrentMode();
    const { selection, variables } = card._getSelection(currentMode);
    if ((selection as any[]).length == 0 || !currentMode) {
        card._showToast("popups.no_selection", "mdi:close", false);
        forwardHaptic("failure");
    } else {
        let serviceCall: ServiceCall;
        try {
            serviceCall = await currentMode.getServiceCall(
                card.hass,
                currentPreset.entity,
                selection,
                card.repeats,
                { ...card.internalVariables, ...variables },
            );
        } catch (e) {
            card._showToast("popups.failed", "mdi:close", false, (e as Error)?.message);
            forwardHaptic("failure");
            return;
        }
        const event = new Event(EVENT_SERVICE_CALL);
        (event as any).serviceCall = JSON.stringify(serviceCall, null, 2);
        window.dispatchEvent(event);
    }
}

export async function runSelection(card: XiaomiVacuumMapCard, debug: boolean): Promise<void> {
    const currentPreset = card._getCurrentPreset();
    const currentMode = card._getCurrentMode();
    const { selection, variables } = card._getSelection(currentMode);
    if ((selection as any[]).length == 0 || !currentMode) {
        card._showToast("popups.no_selection", "mdi:close", false);
        forwardHaptic("failure");
    } else {
        const repeats = card.repeats;
        const entity = currentPreset.entity;
        const runRoomIds =
            currentMode.selectionType === SelectionType.ROOM
                ? getUsableSelectedRooms(card, currentMode).map(room => String(room.toVacuum()))
                : [];
        let serviceCall: ServiceCall;
        try {
            serviceCall = await currentMode.getServiceCall(card.hass, currentPreset.entity, selection, repeats, {
                ...card.internalVariables,
                ...variables,
            });
        } catch (e) {
            // Nothing was sent, so the selection stays for another attempt.
            card._showToast("popups.failed", "mdi:close", false, (e as Error)?.message);
            forwardHaptic("failure");
            return;
        }
        if (debug || (card.config.debug ?? false)) {
            const message = JSON.stringify(serviceCall, null, 2);
            card._showToast("popups.success", "mdi:check", true);
            console.log(message);
            window.alert(message);
            forwardHaptic("success");
        } else {
            card.hass
                .callService(serviceCall.domain, serviceCall.service, serviceCall.serviceData, serviceCall.target)
                .then(
                    () => {
                        card._showToast("popups.success", "mdi:check", true);
                        forwardHaptic("success");
                        if (runRoomIds.length > 0) {
                            card.activeRoomRunEntity = entity;
                            card.activeRoomRun = {
                                entity,
                                roomIds: runRoomIds,
                                startedAt: Date.now(),
                                seenActive: false,
                            };
                            saveActiveRoomRun(entity, card.activeRoomRun);
                            card.requestUpdate();
                        }
                    },
                    e => {
                        card._showToast("popups.failed", "mdi:close", false, e.message);
                        forwardHaptic("failure");
                    },
                );
        }
    }
    if (currentPreset.clean_selection_on_start ?? true) {
        setCurrentMode(card, card.selectedMode);
    }
    selectionChanged(card);
}

export function handleRunAction(card: XiaomiVacuumMapCard): ActionHandlerFunction {
    return async (ev?: ActionHandlerEvent): Promise<void> => {
        if (card.hass && ev?.detail?.action) {
            switch (ev.detail.action) {
                case "tap":
                    await runSelection(card, false);
                    break;
                case "hold":
                    await runSelection(card, true);
                    break;
                case "double_tap":
                    console.log(
                        JSON.stringify(
                            {
                                ...card._getCurrentPreset(),
                                additional_presets: undefined,
                                title: undefined,
                                type: undefined,
                            },
                            null,
                            2,
                        ),
                    );
                    window.alert("Configuration available in browser's console");
                    forwardHaptic("success");
                    break;
            }
        }
    };
}
