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

/** One configured ROOM `predefined_selections` entry. */
export interface ConfiguredRoomSelection {
    readonly id: string | number;
    /**
     * Whether the configuration selects the room by default (or it is selected right now). The
     * audit reports these separately so the card can name what it excludes from a service call.
     */
    readonly selected: boolean;
}

/** The live camera `rooms` attribute. `undefined` means the camera exposes no metadata at all. */
export type LiveRoomMetadata = Record<string, unknown> | undefined | null;

export interface RoomConfigStatus {
    /** Configured ids the live metadata still contains, in configured order. */
    readonly liveIds: string[];
    /** Configured ids the live metadata no longer contains, in configured order. */
    readonly staleIds: string[];
    /** The stale ids that were selected: they must not reach a service call. */
    readonly staleSelectedIds: string[];
    /**
     * True when the camera exposes no rooms metadata (absent, `null` or an empty object). Nothing
     * can be proven stale without live metadata, so the card neither warns nor excludes anything.
     */
    readonly metadataMissing: boolean;
    /** True when at least one configured id is absent from the live metadata. */
    readonly hasStaleRooms: boolean;
}

function noMetadata(): RoomConfigStatus {
    return {
        liveIds: [],
        staleIds: [],
        staleSelectedIds: [],
        metadataMissing: true,
        hasStaleRooms: false,
    };
}

/**
 * Compares the configured ROOM selections with the camera metadata currently reported for the
 * same camera.
 *
 * - Missing or empty metadata is "unknown", not "all stale": the card still falls back to the
 *   configured rooms when the integration exposes no metadata, so warning there would be noise.
 * - Duplicate configured ids are reported once. An id selected by any duplicate counts as
 *   selected.
 * - Ids are compared in their string form because camera metadata is keyed by strings while a
 *   configuration may spell the same id as a number. Comparing by name is intentionally impossible
 *   here.
 */
export function auditRoomSelection(
    configured: readonly ConfiguredRoomSelection[],
    liveRooms: LiveRoomMetadata,
): RoomConfigStatus {
    const liveRoomIds = liveRooms ? Object.keys(liveRooms) : [];
    if (liveRoomIds.length === 0) return noMetadata();
    const liveRoomIdSet = new Set(liveRoomIds);

    const liveIds: string[] = [];
    const staleIds: string[] = [];
    const staleSelectedIds: string[] = [];
    const seen = new Set<string>();

    for (const selection of configured) {
        const id = String(selection.id);
        if (seen.has(id)) {
            if (selection.selected && !liveRoomIdSet.has(id) && !staleSelectedIds.includes(id)) {
                staleSelectedIds.push(id);
            }
            continue;
        }
        seen.add(id);
        if (liveRoomIdSet.has(id)) {
            liveIds.push(id);
        } else {
            staleIds.push(id);
            if (selection.selected) staleSelectedIds.push(id);
        }
    }

    return {
        liveIds,
        staleIds,
        staleSelectedIds,
        metadataMissing: false,
        hasStaleRooms: staleIds.length > 0,
    };
}
