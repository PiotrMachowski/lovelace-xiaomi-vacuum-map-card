/* eslint-disable @typescript-eslint/no-explicit-any */
import { state } from "lit/decorators";
import { CardPresetConfig } from "../types/types";
import { DISCONNECTED_IMAGE, DISCONNECTION_TIME } from "../const";
import { decideMapRefresh, MAP_REFRESH_INTERVAL_MS, MapRefreshState } from "../model/map-refresh-policy";
import type { XiaomiVacuumMapCard } from "../xiaomi-vacuum-map-card";

export function getMapSrc(card: XiaomiVacuumMapCard, config: CardPresetConfig): string {
    if (config.map_source.camera) {
        if (card.connected && isHassFresh(card)) {
            const camera = config.map_source.camera;
            const state = decideCardMapRefresh(card, camera);
            return `${card.hass.hassUrl(state.entityPicture)}&v=${state.version}`;
        }
        return DISCONNECTED_IMAGE;
    }
    if (config.map_source.image) {
        return `${config.map_source.image}`;
    }
    return DISCONNECTED_IMAGE;
}

/**
 * `true` while Home Assistant is still delivering `hass` to this card. It closes its websocket a
 * few minutes after a tab is hidden, so after a long hidden period the last update stops moving:
 * a render then would fall back to the disconnected placeholder and its `load` would run room
 * detection against that placeholder canvas while recording the live camera key. `_getMapSrc`
 * and the visibility handler share this test so they cannot disagree about the camera being
 * usable.
 */
export function isHassFresh(card: XiaomiVacuumMapCard): boolean {
    return !!card.lastHassUpdate && card.lastHassUpdate.getTime() + DISCONNECTION_TIME >= Date.now();
}

/**
 * Applies the refresh policy for one render and returns the state to build the URL from. The
 * decision lives in `mapRefreshState` between renders, so a render caused by the vacuum, a tile
 * or an icon update recomputes the same URL and Lit leaves the image alone.
 */
export function decideCardMapRefresh(card: XiaomiVacuumMapCard, camera: string): MapRefreshState {
    const entity = card.hass.states[camera];
    const now = Date.now();
    const hidden = document.hidden === true;
    const decision = decideMapRefresh({
        camera: {
            cameraId: camera,
            lastUpdated: entity?.last_updated ?? entity?.last_changed,
            entityPicture: entity?.attributes?.entity_picture as string | undefined,
        },
        previous: card.mapRefreshState,
        now,
        hidden,
    });
    card.mapRefreshState = decision.state;
    // Suppressed here only means "the interval has not elapsed": the policy cannot suppress a
    // visible decision for any other reason once it has a previous state. The render that would
    // have fetched the snapshot is replayed when the window ends instead of waiting for the
    // next render, which for a docked vacuum can be minutes later (MQTT/Valetudo cameras change
    // the image without a state write, so nothing else would cause one).
    if (!decision.changed && !hidden) {
        scheduleTrailingMapRefresh(card, decision.state, now);
    }
    return decision.state;
}

/**
 * Re-runs the held-back render exactly when the 5 s window ends. At most one callback exists at
 * a time, so a burst of renders shares the one at its boundary, and it is only created after a
 * render was suppressed: an idle card still has no timer and never polls the camera.
 */
export function scheduleTrailingMapRefresh(card: XiaomiVacuumMapCard, state: MapRefreshState, now: number): void {
    if (card.trailingMapRefreshPending || !card.connected) {
        return;
    }
    const delay = Math.max(0, state.at + MAP_REFRESH_INTERVAL_MS - now);
    card.trailingMapRefreshPending = true;
    card._scheduleDelayedCallback(() => {
        card.trailingMapRefreshPending = false;
        // A hidden tab is the visibility handler's case; it must not render or request on its
        // own, and the frozen URL would come out of this render unchanged anyway.
        if (document.hidden === true) {
            return;
        }
        card.requestUpdate();
    }, delay);
}

/**
 * A background tab must not keep asking the camera for snapshots. The policy freezes the URL
 * while hidden; the first render after the tab becomes visible again is where the frozen camera
 * change or the elapsed interval is picked up, as a single new request.
 *
 * If Home Assistant has already closed the websocket, this card has no usable `hass` and must
 * not request that render: it would show the disconnected placeholder, and the placeholder's
 * load would run the map image and room-colour detection against the wrong canvas. The
 * reconnect sets `hass`, which renders and applies the deferred refresh on its own.
 */
export function handleVisibilityChange(card: XiaomiVacuumMapCard): void {
    if (document.hidden) {
        return;
    }
    if (!isHassFresh(card)) {
        return;
    }
    card.requestUpdate();
}
