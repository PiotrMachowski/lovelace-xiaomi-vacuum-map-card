import { HassEntity } from "home-assistant-js-websocket/dist/types";

import { HomeAssistantFixed } from "./types/fixes";

type HassWithEntityNames = HomeAssistantFixed & {
    formatEntityName?: (stateObj: HassEntity, name: string | undefined) => string;
};

/**
 * `hass.formatEntityName` only accepts the `(stateObj, undefined)` call this card makes from Home
 * Assistant 2026.4. Earlier frontends ship the same helper with an incompatible signature: 2025.10
 * takes a bare type string and iterates it, and 2025.11 through 2026.3 only accept structured
 * items. Calling it there is not a fallback, it is a crash - on 2025.10 `ensureArray(undefined)`
 * throws `TypeError: undefined is not iterable`, which rejects the tiles promise (tiles and modes
 * are never set) and throws inside `Tile.render()`. Feature detection is therefore not enough and
 * the frontend version has to be checked too, which is what upstream #957 (`44b122e`) adds.
 */
const supportsEntityNames = (hass: HomeAssistantFixed | undefined): boolean => {
    // A hass can report a recent version without carrying the helper (the test harness, or a hass
    // that has not finished initialising), and calling it then throws - so the version gate alone
    // is not enough either.
    if (!hass || typeof (hass as HassWithEntityNames).formatEntityName !== "function") return false;
    // Numeric year.month comparison, not a string compare: as text "2026.10.3" sorts below "2026.4",
    // so a string comparison would wrongly disable the resolver for every 2026.10+ frontend.
    const [major, minor] = (hass.config?.version ?? "").split(".", 2);
    return Number(major) > 2026 || (Number(major) === 2026 && Number(minor) >= 4);
};

/**
 * Resolves an entity's display name from its registry context (entity, device, area, floor), so
 * tile labels match what the built-in cards show.
 *
 * The formatter is only called when the frontend version and the function presence both allow it;
 * every other case - 2025.10 through 2026.3, a hass without the helper, a throw, or an empty
 * result - falls back to the friendly name and then, at the call sites, to the entity id.
 *
 * Adapted from upstream PR #957. Its `entityNamesChanged` re-render hook is not carried here;
 * without it, a registry-only rename can leave a tile label stale until an unrelated entity update
 * renders the card (see `ROADMAP.md`, known limitations).
 */
export function computeEntityName(
    hass: HomeAssistantFixed | undefined,
    stateObj: HassEntity | undefined,
): string | undefined {
    if (!stateObj) return undefined;
    const formatter = (hass as HassWithEntityNames | undefined)?.formatEntityName;
    if (supportsEntityNames(hass) && typeof formatter === "function") {
        try {
            // Fork-only hardening: the version gate is a snapshot of today's signatures, so a future
            // frontend change must degrade to the friendly name instead of breaking tile rendering.
            const name = formatter.call(hass, stateObj, undefined);
            if (name) return name;
        } catch {
            // Fall through to the friendly name.
        }
    }
    return stateObj.attributes?.friendly_name;
}
