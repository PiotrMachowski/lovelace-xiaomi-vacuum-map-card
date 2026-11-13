import { HassEntity } from "home-assistant-js-websocket/dist/types";

import { HomeAssistantFixed } from "./types/fixes";

type HassWithEntityNames = HomeAssistantFixed & {
    formatEntityName?: (stateObj: HassEntity, name: string | undefined) => string;
};

/**
 * Resolves an entity's display name from its registry context (entity, device, area, floor), so
 * tile labels match what the built-in cards show. `formatEntityName` only exists on newer Home
 * Assistant frontends, so older `hass` objects fall back to the friendly name.
 *
 * Adapted from upstream PR #957. Its `entityNamesChanged` re-render hook is not carried here;
 * without it, a registry-only rename can leave a tile label stale until an unrelated entity
 * update renders the card.
 */
export function computeEntityName(
    hass: HomeAssistantFixed | undefined,
    stateObj: HassEntity | undefined,
): string | undefined {
    if (!stateObj) return undefined;
    const formatter = (hass as HassWithEntityNames | undefined)?.formatEntityName;
    if (typeof formatter === "function") {
        const name = formatter.call(hass, stateObj, undefined);
        if (name) return name;
    }
    return stateObj.attributes?.friendly_name;
}
