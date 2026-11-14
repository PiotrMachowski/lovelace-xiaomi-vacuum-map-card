import { ACTIVE_ROOM_RUN_STORE_KEY } from "../const";

/**
 * The room run the card started last, so the cleaning order stays on the map while the vacuum
 * works through it. The selection itself is cleared on start (`clean_selection_on_start`), so
 * without this record the order badges vanished the moment the run began.
 */
export interface ActiveRoomRun {
    /** The vacuum entity the run was sent to. */
    entity: string;
    /** Room ids in cleaning order (click order). */
    roomIds: string[];
    /** Epoch milliseconds when the service call succeeded. */
    startedAt: number;
    /** True once the vacuum has reported a working state after the start. */
    seenActive: boolean;
}

/** Vacuum states that mean a run is still in progress, including the trip back between rooms. */
export const ACTIVE_VACUUM_STATES: ReadonlySet<string> = new Set(["cleaning", "paused", "returning"]);

/**
 * How long a run may wait for the vacuum to report a working state. Integrations that poll (for
 * example xiaomi_miot) report the start tens of seconds late, so the badges must survive that gap,
 * but a command the vacuum never acted on must not leave them on the map forever.
 */
export const ACTIVE_ROOM_RUN_START_GRACE_MS = 3 * 60 * 1000;

/**
 * Advances a run with the vacuum's current state. Returns the same object when nothing changed,
 * an updated copy when the run first becomes active, and undefined when the run is over: the
 * vacuum left the working states after it was seen working (docked, idle, error...), or it never
 * started within the start grace period. A run ends the moment the vacuum is done, so the rooms
 * are never locked while it sits on the dock.
 */
export function advanceActiveRoomRun(
    run: ActiveRoomRun | undefined,
    vacuumState: string | undefined,
    now: number,
): ActiveRoomRun | undefined {
    if (!run) return undefined;
    if (vacuumState !== undefined && ACTIVE_VACUUM_STATES.has(vacuumState)) {
        return run.seenActive ? run : { ...run, seenActive: true };
    }
    if (run.seenActive) return undefined;
    return now - run.startedAt > ACTIVE_ROOM_RUN_START_GRACE_MS ? undefined : run;
}

type ActiveRoomRunStorage = Record<string, ActiveRoomRun>;

function read(): ActiveRoomRunStorage {
    try {
        const raw = window.localStorage.getItem(ACTIVE_ROOM_RUN_STORE_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
        return {};
    }
}

function isActiveRoomRun(value: unknown): value is ActiveRoomRun {
    const run = value as ActiveRoomRun | undefined;
    return (
        !!run &&
        typeof run.entity === "string" &&
        Array.isArray(run.roomIds) &&
        run.roomIds.every(id => typeof id === "string") &&
        typeof run.startedAt === "number" &&
        typeof run.seenActive === "boolean"
    );
}

/** The stored run for a vacuum, kept per browser so a reload keeps showing the order. */
export function loadActiveRoomRun(entity: string): ActiveRoomRun | undefined {
    const run = read()[entity];
    return isActiveRoomRun(run) && run.entity === entity ? run : undefined;
}

/** Stores or, with `undefined`, removes the run for a vacuum. Storage failures are ignored. */
export function saveActiveRoomRun(entity: string, run: ActiveRoomRun | undefined): void {
    try {
        const storage = read();
        if (run) storage[entity] = run;
        else delete storage[entity];
        if (Object.keys(storage).length === 0) window.localStorage.removeItem(ACTIVE_ROOM_RUN_STORE_KEY);
        else window.localStorage.setItem(ACTIVE_ROOM_RUN_STORE_KEY, JSON.stringify(storage));
    } catch {
        // Private windows and blocked storage only lose the badges across a reload.
    }
}
