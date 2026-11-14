import { afterEach, describe, expect, it } from "vitest";

import { ACTIVE_ROOM_RUN_STORE_KEY } from "../../src/const";
import {
    ACTIVE_ROOM_RUN_START_GRACE_MS,
    ActiveRoomRun,
    advanceActiveRoomRun,
    loadActiveRoomRun,
} from "../../src/model/active-room-run";
import type { XiaomiVacuumMapCardConfig } from "../../src/types/types";
import type { CardHandle } from "../harness";
import { fixtureConfig, fixtureHass, loadSyntheticFixture, mountCard, settle, useHarnessClock, withState } from "../harness";

/**
 * The cleaning order stays on the map while the run it belongs to is in progress.
 *
 * `clean_selection_on_start` clears the selection when a run starts, which also removed the order
 * badges, so the user could not see the order the vacuum was working through. The card now keeps
 * the started run's order (dashed outline, same numbers) until the vacuum reports it is done.
 */

const VACUUM = "vacuum.roborock_s7";

function run(overrides: Partial<ActiveRoomRun> = {}): ActiveRoomRun {
    return { entity: VACUUM, roomIds: ["2", "0"], startedAt: 1_000, seenActive: false, ...overrides };
}

describe("advanceActiveRoomRun", () => {
    it("keeps a run that has not started yet within the grace period", () => {
        const pending = run();
        expect(advanceActiveRoomRun(pending, "docked", 1_000 + 30_000)).toBe(pending);
    });

    it("drops a run the vacuum never started", () => {
        expect(advanceActiveRoomRun(run(), "docked", 1_000 + ACTIVE_ROOM_RUN_START_GRACE_MS + 1)).toBeUndefined();
    });

    it("marks the run active once the vacuum works, and keeps it through pause and return", () => {
        const active = advanceActiveRoomRun(run(), "cleaning", 2_000);
        expect(active).toMatchObject({ seenActive: true, roomIds: ["2", "0"] });
        expect(advanceActiveRoomRun(active, "paused", 3_000)).toBe(active);
        expect(advanceActiveRoomRun(active, "returning", 4_000)).toBe(active);
    });

    it("ends the run the moment the vacuum is done after it was seen working", () => {
        // Locking the rooms while the vacuum sits on the dock left users unable to do anything.
        for (const state of ["docked", "idle", "error", "unavailable"]) {
            expect(advanceActiveRoomRun(run({ seenActive: true }), state, 5_000)).toBeUndefined();
        }
    });
});

function cardConfig(): XiaomiVacuumMapCardConfig {
    return {
        ...fixtureConfig(loadSyntheticFixture()),
        map_modes: [{ template: "vacuum_clean_segment" }],
        tiles: [],
        icons: [],
        persist_map_view: false,
    };
}

async function clickRoom(card: CardHandle, id: string): Promise<void> {
    const polygon = card.shadowRoot.querySelector(`.room-${id}-wrapper .room-outline`);
    if (!polygon) throw new Error(`room ${id} has no clickable outline`);
    polygon.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
    await settle(card.element);
}

async function runSelection(card: CardHandle): Promise<void> {
    const button = card.shadowRoot.querySelector(".map-actions-item.main");
    if (!button) throw new Error("the card has no run button");
    button.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
    await settle(card.element, 400);
}

function badges(card: CardHandle): Record<string, string> {
    const entries: Array<[string, string]> = [];
    for (const id of ["0", "1", "2"]) {
        const value = card.shadowRoot.querySelector(`.room-${id}-wrapper .room-order`)?.textContent?.trim();
        if (value) entries.push([id, value]);
    }
    return Object.fromEntries(entries);
}

function running(card: CardHandle): string[] {
    return ["0", "1", "2"].filter(id =>
        card.shadowRoot.querySelector(`.room-${id}-wrapper`)?.classList.contains("running"),
    );
}

function highlighted(card: CardHandle): string[] {
    return ["0", "1", "2"].filter(id =>
        card.shadowRoot.querySelector(`.room-${id}-wrapper`)?.classList.contains("selected"),
    );
}

async function setVacuumState(card: CardHandle, state: string): Promise<void> {
    await card.updateHass(withState(card.hass, VACUUM, { state }).hass);
    await settle(card.element);
}

describe("cleaning order during a run", () => {
    afterEach(() => window.localStorage.removeItem(ACTIVE_ROOM_RUN_STORE_KEY));

    async function startRun(): Promise<CardHandle> {
        useHarnessClock();
        const card = await mountCard(cardConfig(), fixtureHass(loadSyntheticFixture()));
        await card.fireMapLoad();
        await clickRoom(card, "2");
        await clickRoom(card, "0");
        await runSelection(card);
        return card;
    }

    it("keeps the order on the map after start, until the vacuum is done", async () => {
        const card = await startRun();

        // The selection is cleared, but the started run keeps its numbers and looks exactly as the
        // selection did: same highlight, same badges.
        expect((card.element as unknown as { selectedRooms: unknown[] }).selectedRooms).toHaveLength(0);
        expect(badges(card)).toEqual({ "2": "1", "0": "2" });
        expect(running(card)).toEqual(["0", "2"]);
        expect(highlighted(card)).toEqual(["0", "2"]);

        await setVacuumState(card, "cleaning");
        expect(badges(card)).toEqual({ "2": "1", "0": "2" });
        await setVacuumState(card, "returning");
        expect(badges(card)).toEqual({ "2": "1", "0": "2" });

        // Docked: the run is over at once, and the rooms are free again.
        await setVacuumState(card, "docked");
        expect(badges(card)).toEqual({});
        expect(running(card)).toEqual([]);
        expect(highlighted(card)).toEqual([]);
        expect(loadActiveRoomRun(VACUUM)).toBeUndefined();
    });

    it("locks the rooms while the run is in progress", async () => {
        const card = await startRun();
        await setVacuumState(card, "cleaning");

        // Neither a new room nor a room of the run can change the order.
        await clickRoom(card, "1");
        await clickRoom(card, "2");
        expect(badges(card)).toEqual({ "2": "1", "0": "2" });
        expect((card.element as unknown as { selectedRooms: unknown[] }).selectedRooms).toHaveLength(0);

        // Once the vacuum is done the rooms can be picked again, right away.
        await setVacuumState(card, "docked");
        await clickRoom(card, "1");
        expect(badges(card)).toEqual({ "1": "1" });
    });

    it("does not lock the rooms before the vacuum reports the start", async () => {
        // Polling integrations report the start tens of seconds late; meanwhile the order is shown
        // but a tap starts a new selection instead of being refused.
        const card = await startRun();
        expect(badges(card)).toEqual({ "2": "1", "0": "2" });

        await clickRoom(card, "1");

        expect(badges(card)).toEqual({ "1": "1" });
        expect(running(card)).toEqual([]);
        expect(loadActiveRoomRun(VACUUM)).toBeUndefined();
        // The dropped run does not come back when the vacuum then starts.
        await setVacuumState(card, "cleaning");
        expect(badges(card)).toEqual({ "1": "1" });
    });

    it("restores the run after a reload", async () => {
        const card = await startRun();
        await setVacuumState(card, "cleaning");
        card.element.remove();

        const reloaded = await mountCard(cardConfig(), withState(fixtureHass(loadSyntheticFixture()), VACUUM, { state: "cleaning" }).hass);
        await reloaded.fireMapLoad();

        expect(badges(reloaded)).toEqual({ "2": "1", "0": "2" });
    });
});
