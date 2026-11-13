import { Connection } from "home-assistant-js-websocket";

import { HomeAssistantFixed } from "./types/fixes";
import { EntityRegistryEntry } from "./types/types";

/**
 * Home Assistant core's answer to `config/entity_registry/get_entries`: a plain object keyed by
 * entity id, with `null` for a requested id that has no registry entry. It is not
 * `{ entries: [...] }`.
 */
type EntityRegistryEntries = Record<string, EntityRegistryEntry | null>;

/** A registry entry that exists and is enabled; the generators ignore disabled entities. */
function isEnabledEntry(entry: EntityRegistryEntry | null | undefined): entry is EntityRegistryEntry {
    return entry != null && entry.disabled_by == null;
}

/**
 * Registry lookups, memoized per `(hass.connection, vacuum entity id)`.
 *
 * Why this key: the connection is stable for a whole page and is replaced on a reload or a
 * websocket reconnect, so the cache is page-scoped - two cards, or the icon and tile generators of
 * one card, share one lookup per vacuum on that page, and a second page starts empty. The vacuum's
 * entity id keys the inner map so two vacuums never share an answer. The `WeakMap` also releases a
 * closed page's cache with its connection once nothing else holds it.
 *
 * Only a successful result is kept. A failed lookup is removed from the map so the next caller
 * retries instead of inheriting an empty list for the lifetime of the page: a websocket may still
 * be connecting, and caching the failure would permanently hide a vacuum's sensors after one
 * transient error.
 */
const registryCache = new WeakMap<Connection, Map<string, Promise<EntityRegistryEntry[]>>>();

function cacheFor(connection: Connection): Map<string, Promise<EntityRegistryEntry[]>> {
    let cache = registryCache.get(connection);
    if (!cache) {
        cache = new Map();
        registryCache.set(connection, cache);
    }
    return cache;
}

/**
 * Returns the enabled registry entries of the device that owns `entity`, deduplicating concurrent
 * and repeated calls from the icon and tile generators.
 *
 * The candidate ids come from `hass.entities` (the display registry) filtered by `device_id`, so
 * the full multi-megabyte `config/entity_registry/list` payload is never downloaded on a current
 * Home Assistant. Only one `config/entity_registry/get_entries` call is made, with those candidate
 * ids. If that command is unavailable, the pre-`get_entries` path (`/list` plus one `/get` per
 * entity) runs instead; see `loadFromFullRegistry`.
 */
export function getAllEntitiesFromTheSameDevice(
    hass: HomeAssistantFixed,
    entity: string,
): Promise<EntityRegistryEntry[]> {
    const deviceId = hass.entities?.[entity]?.device_id;
    // Nothing to collect: the entity is not in the display registry (so it has no device) or the
    // display registry has not loaded yet. This answer is deliberately not cached - a card rendered
    // before the display registry arrives would otherwise keep an empty sensor list for the page.
    if (!deviceId) return Promise.resolve([]);

    const cache = cacheFor(hass.connection);
    const cached = cache.get(entity);
    if (cached) return cached;

    const pending = loadEntitiesForDevice(hass, deviceId).catch(() => {
        // Not cached: the next call retries (see `registryCache`).
        cache.delete(entity);
        return [];
    });
    cache.set(entity, pending);
    return pending;
}

async function loadEntitiesForDevice(
    hass: HomeAssistantFixed,
    deviceId: string,
): Promise<EntityRegistryEntry[]> {
    const candidateIds = Object.values(hass.entities)
        .filter(entry => entry.device_id === deviceId)
        .map(entry => entry.entity_id);
    try {
        const entries = await hass.callWS<EntityRegistryEntries>({
            type: "config/entity_registry/get_entries",
            entity_ids: candidateIds,
        });
        // Read the response by the ids that were requested: this keeps the display-registry order
        // (the generator output depends on it) and drops anything the server returned for another
        // device.
        return candidateIds.map(entityId => entries[entityId]).filter(isEnabledEntry);
    } catch {
        return loadFromFullRegistry(hass, deviceId);
    }
}

/**
 * Fallback for a Home Assistant without a working `config/entity_registry/get_entries`: download the
 * registry and fetch each entry of the device. This is the original implementation and is only
 * reached after `get_entries` rejects, so a current install never pays for the full registry.
 */
async function loadFromFullRegistry(
    hass: HomeAssistantFixed,
    deviceId: string,
): Promise<EntityRegistryEntry[]> {
    const registry = await hass.callWS<{ entity_id: string; device_id?: string }[]>({
        type: "config/entity_registry/list",
    });
    const entityIds = registry
        .filter(entry => entry.device_id === deviceId)
        .map(entry => entry.entity_id);
    const entries = await Promise.all(
        entityIds.map(entityId =>
            hass.callWS<EntityRegistryEntry>({
                type: "config/entity_registry/get",
                entity_id: entityId,
            }),
        ),
    );
    return entries.filter(isEnabledEntry);
}
