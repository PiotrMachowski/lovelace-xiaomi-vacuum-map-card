/**
 * Decides the cache-buster appended to the camera-backed map image URL.
 *
 * The card re-renders whenever any watched entity changes, which includes the vacuum, tiles and
 * icons. Rebuilding `src` on each of those renders asked the camera for a fresh snapshot several
 * times per second and raced the map-view restore against an image that never finished loading.
 * This module keeps that decision out of the card: it only looks at the camera entity, the clock
 * and the document visibility, so an unrelated entity update cannot request a new snapshot.
 *
 * The module is pure: no DOM, no Lit, no timers. The caller carries `MapRefreshState` between
 * calls and builds the URL from `state.entityPicture` and `state.version`.
 */

/**
 * How long a camera snapshot URL stays usable. Until this elapses, renders reuse the same URL even
 * when the camera entity has not changed. Five seconds is a starting point; the real vacuum needs
 * to confirm it before this becomes user-facing configuration.
 */
export const MAP_REFRESH_INTERVAL_MS = 5000;

/** The parts of a camera entity state that can justify a new snapshot. */
export interface MapRefreshCameraState {
    /** Entity id, so two cameras can never share a version by coincidence. */
    cameraId?: string;
    /** `state.last_updated` of the camera entity. */
    lastUpdated?: string;
    /** `state.attributes.entity_picture` of the camera entity. */
    entityPicture?: string;
}

/** The caller-owned memory between decisions. */
export interface MapRefreshState {
    /** Identity of the camera state `version` was produced for. */
    cameraKey: string;
    /** The numeric string appended as `&v=`; never reused for a refresh. */
    version: string;
    /** Clock time of the decision that produced this version, in milliseconds. */
    at: number;
    /**
     * `attributes.entity_picture` at the time of the decision. The card builds the URL from this
     * rather than from the live state: while the document is hidden the whole URL must stay frozen,
     * not just the version, or a camera attribute change would still reload the image.
     */
    entityPicture?: string;
}

export interface MapRefreshDecision {
    /**
     * `true` when the URL must change. `false` is the "unchanged" decision: keep appending
     * `state.version`, which is the previous version unchanged.
     */
    changed: boolean;
    /** State to pass as `previous` on the next call. */
    state: MapRefreshState;
}

export interface MapRefreshInput {
    /** The camera entity state, when the preset has a camera map source. */
    camera?: MapRefreshCameraState;
    /** The last decision, if the card has produced one. */
    previous?: MapRefreshState;
    /** Current clock time in milliseconds. */
    now: number;
    /** Refresh interval in milliseconds; defaults to `MAP_REFRESH_INTERVAL_MS`. */
    intervalMs?: number;
    /** `document.hidden` at the time of the decision. */
    hidden: boolean;
}

/**
 * A stable identity for the camera state. `last_updated` and `entity_picture` are the two fields
 * that change when the camera has a new map, and the camera id keeps different cameras apart.
 *
 * Room-colour detection uses the same key. Sharing it means a policy refresh caused by the interval
 * cannot re-run room detection for an unchanged camera, and a new camera state cannot be seen by
 * one of them and missed by the other.
 */
export function cameraRefreshKey(camera?: MapRefreshCameraState): string {
    if (!camera) {
        return "";
    }
    return [camera.cameraId ?? "", camera.lastUpdated ?? "", camera.entityPicture ?? ""].join("|");
}

/**
 * Produces the next version, guaranteed to differ from `previous`. `now` is normally enough, but a
 * camera change can arrive in the same millisecond as the previous decision, and two renders in one
 * millisecond must still not reuse a cache-buster.
 */
function nextVersion(now: number, previous?: MapRefreshState): string {
    const candidate = Number.isFinite(now) ? Math.floor(now) : 0;
    const previousVersion = previous ? Number(previous.version) : NaN;
    if (!previous || !Number.isFinite(previousVersion) || candidate > previousVersion) {
        return String(candidate);
    }
    return String(previousVersion + 1);
}

function refresh(
    cameraKey: string,
    now: number,
    camera?: MapRefreshCameraState,
    previous?: MapRefreshState,
): MapRefreshDecision {
    return {
        changed: true,
        state: {
            cameraKey,
            version: nextVersion(now, previous),
            at: Number.isFinite(now) ? Math.floor(now) : 0,
            entityPicture: camera?.entityPicture,
        },
    };
}

function unchanged(previous: MapRefreshState): MapRefreshDecision {
    return { changed: false, state: previous };
}

/**
 * The whole policy, as a table:
 *
 * | previous | hidden | camera identity changed | interval elapsed | result    |
 * | ---      | ---    | ---                     | ---              | ---       |
 * | none     | any    | -                       | -                | refresh   |
 * | any      | yes    | any                     | any              | unchanged |
 * | any      | no     | yes                     | any              | refresh   |
 * | any      | no     | no                      | yes              | refresh   |
 * | any      | no     | no                      | no               | unchanged |
 *
 * A hidden document freezes the version, even when the camera changed, so a dashboard in a
 * background tab does not keep polling the camera. The frozen state is what lets the first visible
 * decision notice the camera change or the elapsed interval afterwards.
 */
export function decideMapRefresh(input: MapRefreshInput): MapRefreshDecision {
    const { previous, hidden } = input;
    const cameraKey = cameraRefreshKey(input.camera);
    const now = Number.isFinite(input.now) ? input.now : 0;

    // The first decision after mount (or after a preset gained a camera) has nothing to reuse.
    // This is not a "change" of an existing URL, it creates the first cache-buster.
    if (!previous) {
        return refresh(cameraKey, now, input.camera, undefined);
    }
    if (hidden) {
        return unchanged(previous);
    }
    if (cameraKey !== previous.cameraKey) {
        return refresh(cameraKey, now, input.camera, previous);
    }
    const intervalMs = input.intervalMs ?? MAP_REFRESH_INTERVAL_MS;
    if (now - previous.at >= intervalMs) {
        return refresh(cameraKey, now, input.camera, previous);
    }
    return unchanged(previous);
}
