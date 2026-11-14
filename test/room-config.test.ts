import { describe, expect, it } from "vitest";

import { findStaleRoomIds } from "../src/model/room-config";
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

describe("room-config stale-room audit (#928)", () => {
    it("reports every configured id as live when the camera still has it", () => {
        expect(findStaleRoomIds(["0", "1", "2"], roomsOf(BEFORE))).toEqual([]);
    });

    it("reports one stale id after a re-map that shifted the ids", () => {
        // Room "2" no longer exists; the shifted map only has 3, 4 and 5.
        expect(findStaleRoomIds(["3", "4", "2"], roomsOf(AFTER))).toEqual(["2"]);
    });

    it("does not match a room by name: the same names under new ids leave the old ids stale", () => {
        expect(Object.values(roomsOf(BEFORE)).map(room => (room as { name?: string }).name)).toEqual(
            Object.values(roomsOf(AFTER)).map(room => (room as { name?: string }).name),
        );

        expect(findStaleRoomIds(["0", "1", "2"], roomsOf(AFTER))).toEqual(["0", "1", "2"]);
    });

    it("reports every configured id as stale when none of them survives", () => {
        expect(findStaleRoomIds(["0", "1", "2"], roomsOf(AFTER))).toEqual(["0", "1", "2"]);
    });

    it("keeps the configured order and only the stale ids", () => {
        expect(findStaleRoomIds(["5", "0", "3", "1"], roomsOf(AFTER))).toEqual(["0", "1"]);
    });

    it("does not warn when the camera exposes no rooms metadata", () => {
        expect(findStaleRoomIds(["0", "1", "2"], undefined)).toEqual([]);
        expect(findStaleRoomIds(["0", "1", "2"], null)).toEqual([]);
    });

    it("does not warn on empty metadata: an empty map is not proof that an id is stale", () => {
        expect(findStaleRoomIds(["0", "1", "2"], {})).toEqual([]);
    });

    it("compares numeric and string ids equally and reports a duplicate once", () => {
        expect(findStaleRoomIds([3, "3", 9], roomsOf(AFTER))).toEqual(["9"]);
    });
});
