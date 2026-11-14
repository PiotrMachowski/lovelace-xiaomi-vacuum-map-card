/**
 * Stale-room detection for configured ROOM selections (issue #928).
 *
 * Room ids come from the camera's `rooms` metadata. Integrations may re-number segments after a
 * map edit (Dreame documents that deleted segment ids are not reused and new segments get the next
 * highest id), so a `predefined_selections` list copied from an earlier map can point at rooms that
 * no longer exist - or, worse, at different rooms once an old id is reused by another map.
 *
 * The card deliberately does not remap by name: a room that was both renamed and re-numbered would
 * then be cleaned silently under the wrong id. It warns instead and leaves the corrected
 * selection to the user. Keeping the comparison pure makes it testable without a card, a camera
 * or a canvas.
 */

/** The live camera `rooms` attribute. `undefined` means the camera exposes no metadata at all. */
export type LiveRoomMetadata = Record<string, unknown> | undefined | null;

/**
 * Configured ROOM ids the live camera metadata no longer contains, in configured order, once each.
 *
 * - Missing, `null` or empty metadata is "unknown", not "all stale": the card still falls back to
 *   the configured rooms when the integration exposes no metadata, so warning there would be noise.
 *   The result is empty in that case.
 * - Duplicate configured ids are reported once.
 * - Ids are compared in their string form because camera metadata is keyed by strings while a
 *   configuration may spell the same id as a number. Comparing by name is intentionally impossible
 *   here.
 */
export function findStaleRoomIds(
    configuredIds: readonly (string | number)[],
    liveRooms: LiveRoomMetadata,
): string[] {
    const liveRoomIds = liveRooms ? Object.keys(liveRooms) : [];
    if (liveRoomIds.length === 0) return [];
    const liveRoomIdSet = new Set(liveRoomIds);

    const staleIds: string[] = [];
    for (const configuredId of configuredIds) {
        const id = String(configuredId);
        if (!liveRoomIdSet.has(id) && !staleIds.includes(id)) staleIds.push(id);
    }
    return staleIds;
}
