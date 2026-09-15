import { HassEntity } from "home-assistant-js-websocket";
import { HomeAssistantFixed } from "./types/fixes";

/**
 * hass.formatEntityName only accepts this shape from HA 2026.4. Earlier versions
 * expose the same helper with an incompatible signature - bare type strings in
 * 2025.10, and only structured items between 2025.11 and 2026.3 - so feature
 * detection is not enough and the version has to be checked.
 */
const supportsEntityNames = (hass: HomeAssistantFixed | undefined): boolean => {
    const [major, minor] = (hass?.config?.version ?? "").split(".", 2);
    return Number(major) > 2026 || (Number(major) === 2026 && Number(minor) >= 4);
};

type HassWithEntityNames = HomeAssistantFixed & {
    formatEntityName: (stateObj: HassEntity, name: undefined) => string;
};

/**
 * formatEntityName resolves against the entity/device/area/floor registries, and
 * HA swaps the real formatter in asynchronously once translations load. Neither
 * shows up as an entity state change, so without this a rename (or that swap)
 * leaves tile labels stale until an unrelated update forces a render.
 */
const NAME_SOURCES = ["formatEntityName", "entities", "devices", "areas", "floors"] as const;

export const entityNamesChanged = (
    oldHass: HomeAssistantFixed | undefined,
    newHass: HomeAssistantFixed | undefined,
): boolean => {
    if (!oldHass || !newHass) return false;
    const before = oldHass as unknown as Record<string, unknown>;
    const after = newHass as unknown as Record<string, unknown>;
    return NAME_SOURCES.some((key) => before[key] !== after[key]);
};

/**
 * Resolves an entity's display name from its registry context (entity, device,
 * area, floor), so labels match what the built-in cards show. Falls back to the
 * friendly name on Home Assistant versions without the helper.
 */
export const computeEntityName = (
    hass: HomeAssistantFixed | undefined,
    stateObj: HassEntity | undefined,
): string | undefined => {
    if (!stateObj) return undefined;
    if (hass && supportsEntityNames(hass)) {
        return (hass as HassWithEntityNames).formatEntityName(stateObj, undefined) || undefined;
    }
    return stateObj.attributes?.friendly_name;
};
