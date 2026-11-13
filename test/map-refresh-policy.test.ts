import { describe, expect, it } from "vitest";

import {
    cameraRefreshKey,
    decideMapRefresh,
    MAP_REFRESH_INTERVAL_MS,
    type MapRefreshCameraState,
    type MapRefreshState,
} from "../src/model/map-refresh-policy";

const CAMERA: MapRefreshCameraState = {
    cameraId: "camera.vacuum_map",
    lastUpdated: "2026-11-01T10:00:00.000Z",
    entityPicture: "/api/camera_proxy/camera.vacuum_map?token=one",
};

const T0 = 1761981600000;

/** One decision at `now`, starting from `previous`, with the default interval and a visible tab. */
function decide(now: number, previous?: MapRefreshState, camera = CAMERA, hidden = false) {
    return decideMapRefresh({ camera, previous, now, hidden });
}

describe("map refresh policy", () => {
    it("produces a numeric version on the first decision", () => {
        const decision = decide(T0);

        expect(decision.changed).toBe(true);
        expect(decision.state.version).toBe(String(T0));
        expect(decision.state.version).toMatch(/^\d+$/);
        expect(decision.state.at).toBe(T0);
        expect(decision.state.cameraKey).toBe(cameraRefreshKey(CAMERA));
        expect(decision.state.entityPicture).toBe(CAMERA.entityPicture);
    });

    it("refreshes when the camera last_updated changes", () => {
        const first = decide(T0);
        const second = decide(T0 + 500, first.state, { ...CAMERA, lastUpdated: "2026-11-01T10:00:01.000Z" });

        expect(second.changed).toBe(true);
        expect(second.state.version).not.toBe(first.state.version);
        expect(second.state.cameraKey).not.toBe(first.state.cameraKey);
    });

    it("refreshes when the camera entity_picture changes", () => {
        const first = decide(T0);
        const second = decide(T0 + 500, first.state, { ...CAMERA, entityPicture: "/api/camera_proxy/x?token=two" });

        expect(second.changed).toBe(true);
        expect(second.state.version).not.toBe(first.state.version);
    });

    it("refreshes when the interval has elapsed with an unchanged camera", () => {
        const first = decide(T0);
        const second = decide(T0 + MAP_REFRESH_INTERVAL_MS, first.state);

        expect(second.changed).toBe(true);
        expect(second.state.version).not.toBe(first.state.version);
        expect(second.state.cameraKey).toBe(first.state.cameraKey);
    });

    it("keeps the URL when the interval has not elapsed and nothing changed", () => {
        const first = decide(T0);
        const second = decide(T0 + MAP_REFRESH_INTERVAL_MS - 1, first.state);

        expect(second.changed).toBe(false);
        expect(second.state).toBe(first.state);
        expect(second.state.version).toBe(first.state.version);
    });

    it("refreshes once when the camera changed and the interval elapsed together", () => {
        const first = decide(T0);
        const second = decide(T0 + MAP_REFRESH_INTERVAL_MS + 250, first.state, {
            ...CAMERA,
            lastUpdated: "2026-11-01T10:00:02.000Z",
        });

        expect(second.changed).toBe(true);
        expect(second.state.at).toBe(T0 + MAP_REFRESH_INTERVAL_MS + 250);
    });

    it("never refreshes for a render in which only an unrelated entity changed", () => {
        const first = decide(T0);
        // The card re-renders with the same camera context; the policy cannot see the vacuum.
        const renders = [1, 2, 3, 4].map(offset => decide(T0 + offset * 250, first.state));

        expect(renders.every(decision => !decision.changed)).toBe(true);
        expect(new Set(renders.map(decision => decision.state.version))).toEqual(new Set([first.state.version]));
    });

    it("freezes the URL while the document is hidden, even when the camera and interval changed", () => {
        const first = decide(T0);
        const changedCamera = { ...CAMERA, lastUpdated: "2026-11-01T10:00:03.000Z", entityPicture: "/api/camera_proxy/new" };
        const hiddenCamera = decide(T0 + MAP_REFRESH_INTERVAL_MS, first.state, changedCamera, true);

        expect(hiddenCamera.changed).toBe(false);
        expect(hiddenCamera.state).toBe(first.state);
        // Not just the version: the card builds the URL from the state, so the picture must freeze.
        expect(hiddenCamera.state.entityPicture).toBe(CAMERA.entityPicture);
    });

    it("refreshes once on becoming visible after the camera changed while hidden", () => {
        const first = decide(T0);
        const changedCamera = {
            ...CAMERA,
            lastUpdated: "2026-11-01T10:00:04.000Z",
            entityPicture: "/api/camera_proxy/visible",
        };
        const hidden = decide(T0 + 1000, first.state, changedCamera, true);
        const visible = decide(T0 + 1200, hidden.state, changedCamera);

        expect(visible.changed).toBe(true);
        expect(visible.state.version).not.toBe(first.state.version);
        expect(visible.state.cameraKey).not.toBe(first.state.cameraKey);
        expect(visible.state.entityPicture).toBe(changedCamera.entityPicture);
    });

    it("refreshes once on becoming visible after the interval elapsed while hidden", () => {
        const first = decide(T0);
        const hidden = decide(T0 + MAP_REFRESH_INTERVAL_MS + 500, first.state, CAMERA, true);
        const visible = decide(T0 + MAP_REFRESH_INTERVAL_MS + 600, hidden.state);

        expect(hidden.changed).toBe(false);
        expect(visible.changed).toBe(true);
        expect(visible.state.at).toBe(T0 + MAP_REFRESH_INTERVAL_MS + 600);
    });

    it("stays unchanged on becoming visible when nothing changed and no interval elapsed", () => {
        const first = decide(T0);
        const hidden = decide(T0 + 1000, first.state, CAMERA, true);
        const visible = decide(T0 + 1200, hidden.state);

        expect(hidden.changed).toBe(false);
        expect(visible.changed).toBe(false);
        expect(visible.state).toBe(first.state);
    });

    it("keeps versions unique when a change arrives in the same millisecond", () => {
        const first = decide(T0);
        const second = decide(T0, first.state, { ...CAMERA, lastUpdated: "2026-11-01T10:00:05.000Z" });
        const third = decide(T0, second.state, { ...CAMERA, lastUpdated: "2026-11-01T10:00:06.000Z" });

        expect(second.changed).toBe(true);
        expect(third.changed).toBe(true);
        expect(new Set([first.state.version, second.state.version, third.state.version]).size).toBe(3);
    });

    it("treats a different camera with the same state as a change", () => {
        const first = decide(T0);
        const second = decide(T0 + 100, first.state, { ...CAMERA, cameraId: "camera.other_map" });

        expect(second.changed).toBe(true);
    });

    it("uses the default interval when none is configured", () => {
        expect(MAP_REFRESH_INTERVAL_MS).toBe(5000);

        const first = decide(T0);
        expect(decide(T0 + 4999, first.state).changed).toBe(false);
        expect(decide(T0 + 5000, first.state).changed).toBe(true);
    });

    it("honours an explicit interval", () => {
        const first = decideMapRefresh({ camera: CAMERA, previous: undefined, now: T0, intervalMs: 1000, hidden: false });
        expect(first.changed).toBe(true);
        const beforeInterval = decideMapRefresh({
            camera: CAMERA,
            previous: first.state,
            now: T0 + 999,
            intervalMs: 1000,
            hidden: false,
        });
        const atInterval = decideMapRefresh({
            camera: CAMERA,
            previous: first.state,
            now: T0 + 1000,
            intervalMs: 1000,
            hidden: false,
        });
        expect(beforeInterval.changed).toBe(false);
        expect(atInterval.changed).toBe(true);
    });

    it("builds the camera key from the id, last_updated and entity_picture", () => {
        expect(cameraRefreshKey(undefined)).toBe("");
        expect(cameraRefreshKey(CAMERA)).toBe(
            `camera.vacuum_map|2026-11-01T10:00:00.000Z|/api/camera_proxy/camera.vacuum_map?token=one`,
        );
        expect(cameraRefreshKey({ cameraId: "camera.a" })).not.toBe(cameraRefreshKey({ cameraId: "camera.b" }));
        expect(cameraRefreshKey({ lastUpdated: "a" })).not.toBe(cameraRefreshKey({ lastUpdated: "b" }));
        expect(cameraRefreshKey({ entityPicture: "a" })).not.toBe(cameraRefreshKey({ entityPicture: "b" }));
    });
});
