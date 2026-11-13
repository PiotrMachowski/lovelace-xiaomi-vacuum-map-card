import { describe, expect, it } from "vitest";

import type { ConfiguredRoomSelection } from "../src/model/room-config";
import { auditRoomSelection } from "../src/model/room-config";
import { loadSyntheticFixture, loadSyntheticShiftedRoomIdsCamera } from "./harness";

/**
 * Pure stale-room detection (issue #928).
 *
 * The fixtures are the synthetic camera before a re-map (`0,1,2`) and the same rooms after a
 * simulated re-map that shifted every id to `3,4,5`. Names and geometry are identical, so a
 * name-based comparison would report the old ids as live; these tests exist to prove the audit
 * only ever compares ids.
 */

const BEFORE = loadSyntheticFixture().camera;
const AFTER = loadSyntheticShiftedRoomIdsCamera();

function roomsOf(camera: typeof BEFORE): Record<string, unknown> {
    return camera.attributes.rooms as Record<string, unknown>;
}

function selectedIds(ids: string[]): ConfiguredRoomSelection[] {
    return ids.map(id => ({ id, selected: true }));
}

function ids(ids: string[]): ConfiguredRoomSelection[] {
    return ids.map(id => ({ id, selected: false }));
}

describe("room-config stale-room audit (#928)", () => {
    it("reports every configured id as live when the camera still has it", () => {
        const status = auditRoomSelection(selectedIds(["0", "1", "2"]), roomsOf(BEFORE));

        expect(status.metadataMissing).toBe(false);
        expect(status.hasStaleRooms).toBe(false);
        expect(status.liveIds).toEqual(["0", "1", "2"]);
        expect(status.staleIds).toEqual([]);
        expect(status.staleSelectedIds).toEqual([]);
    });

    it("reports one stale id after a re-map that shifted the ids", () => {
        // Room "2" no longer exists; the shifted map only has 3, 4 and 5.
        const status = auditRoomSelection(
            [
                { id: "3", selected: true },
                { id: "4", selected: false },
                { id: "2", selected: true },
            ],
            roomsOf(AFTER),
        );

        expect(status.hasStaleRooms).toBe(true);
        expect(status.liveIds).toEqual(["3", "4"]);
        expect(status.staleIds).toEqual(["2"]);
        expect(status.staleSelectedIds).toEqual(["2"]);
    });

    it("does not match a room by name: the same names under new ids leave the old ids stale", () => {
        expect(Object.values(roomsOf(BEFORE)).map(room => (room as { name?: string }).name)).toEqual(
            Object.values(roomsOf(AFTER)).map(room => (room as { name?: string }).name),
        );

        const status = auditRoomSelection(ids(["0", "1", "2"]), roomsOf(AFTER));

        expect(status.staleIds).toEqual(["0", "1", "2"]);
        expect(status.liveIds).toEqual([]);
    });

    it("reports every configured id as stale when none of them survives", () => {
        const status = auditRoomSelection(selectedIds(["0", "1", "2"]), roomsOf(AFTER));

        expect(status.hasStaleRooms).toBe(true);
        expect(status.liveIds).toEqual([]);
        expect(status.staleIds).toEqual(["0", "1", "2"]);
        expect(status.staleSelectedIds).toEqual(["0", "1", "2"]);
    });

    it("keeps a selection that mixes live and stale ids ordered and split", () => {
        const status = auditRoomSelection(
            [
                { id: "5", selected: true },
                { id: "0", selected: false },
                { id: "3", selected: false },
                { id: "1", selected: true },
            ],
            roomsOf(AFTER),
        );

        expect(status.liveIds).toEqual(["5", "3"]);
        expect(status.staleIds).toEqual(["0", "1"]);
        expect(status.staleSelectedIds).toEqual(["1"]);
    });

    it("does not warn when the camera exposes no rooms metadata", () => {
        const status = auditRoomSelection(selectedIds(["0", "1", "2"]), undefined);

        expect(status.metadataMissing).toBe(true);
        expect(status.hasStaleRooms).toBe(false);
        expect(status.staleIds).toEqual([]);
    });

    it("does not warn on empty metadata: an empty map is not proof that an id is stale", () => {
        const status = auditRoomSelection(selectedIds(["0", "1", "2"]), {});

        expect(status.metadataMissing).toBe(true);
        expect(status.hasStaleRooms).toBe(false);
        expect(status.staleIds).toEqual([]);
    });

    it("compares numeric and string ids equally and reports a duplicate once", () => {
        const status = auditRoomSelection(
            [
                { id: 3, selected: false },
                { id: "3", selected: true },
                { id: 9, selected: false },
            ],
            roomsOf(AFTER),
        );

        expect(status.liveIds).toEqual(["3"]);
        expect(status.staleIds).toEqual(["9"]);
        expect(status.staleSelectedIds).toEqual([]);
    });
});
