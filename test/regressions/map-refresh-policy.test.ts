import { describe, expect, it, vi } from "vitest";

import { setMapView } from "../../src/model/map-view-store";
import type { XiaomiVacuumMapCardConfig } from "../../src/types/types";
import type { CardHandle, FixtureBundle, HarnessClock, MockHass } from "../harness";
import {
    fixtureConfig,
    fixtureHass,
    loadSyntheticFixture,
    mountCard,
    useHarnessClock,
    withState,
} from "../harness";

interface MapRefreshFixture {
    card: CardHandle;
    clock: HarnessClock;
    cameraId: string;
    vacuumId: string;
    config: XiaomiVacuumMapCardConfig;
    bundle: FixtureBundle;
}

function setUp(): Omit<MapRefreshFixture, "card"> {
    const clock = useHarnessClock();
    const bundle = loadSyntheticFixture();
    const vacuumId = Object.keys(bundle.states).find(entityId => entityId.startsWith("vacuum."));
    if (!vacuumId) throw new Error("the synthetic fixture has no vacuum entity");
    return {
        clock,
        bundle,
        cameraId: bundle.camera.entity_id,
        vacuumId,
        config: fixtureConfig(bundle),
    };
}

function imageSrc(card: CardHandle): string {
    const image = card.shadowRoot.getElementById("map-image-source") as HTMLImageElement | null;
    if (!image) throw new Error("the card has no #map-image-source element");
    return image.getAttribute("src") ?? "";
}

/**
 * Applies a new hass without advancing the fake clock. `updateHass` from the harness settles with
 * `advanceTimersByTimeAsync(150)`, which would silently add 150 ms to every update and blur the
 * interval boundaries these tests measure.
 */
async function applyHass(card: CardHandle, hass: MockHass): Promise<void> {
    card.element.hass = hass;
    await card.element.updateComplete;
    await Promise.resolve();
}

interface SrcTracker {
    count: number;
    times: number[];
    check: (now: number) => void;
    current: () => string;
}

/** Counts transitions of the rendered `src` attribute, not renders. */
function trackSrc(card: CardHandle): SrcTracker {
    let previous = imageSrc(card);
    const times: number[] = [];
    return {
        get count(): number {
            return times.length;
        },
        times,
        check(now: number): void {
            const current = imageSrc(card);
            if (current !== previous) {
                times.push(now);
                previous = current;
            }
        },
        current: (): string => previous,
    };
}

function vacuumPatch(index: number, step: number): { state: string; last_updated: string } {
    return {
        state: index % 2 === 0 ? "cleaning" : "docked",
        last_updated: new Date(Date.parse("2026-11-01T10:00:00.000Z") + index * step).toISOString(),
    };
}

async function mountRefreshingCard(): Promise<MapRefreshFixture> {
    const base = setUp();
    const card = await mountCard(base.config, fixtureHass(base.bundle));
    return { ...base, card };
}

describe("map refresh policy in the card", () => {
    it("keeps the map src stable across 50 vacuum updates in 10 s", async () => {
        const { card, clock, vacuumId } = await mountRefreshingCard();
        const tracker = trackSrc(card);
        const step = 200;
        let hass = card.hass;
        let elapsed = 0;

        for (let update = 1; update <= 50; update++) {
            await clock.advance(step);
            elapsed += step;
            hass = withState(hass, vacuumId, vacuumPatch(update, step)).hass;
            await applyHass(card, hass);
            tracker.check(elapsed);
        }

        // The fake clock lands on two refreshes (one just after the 5 s boundary and one at the
        // final update), inside the roadmap's accepted 1-2 band. Never one per vacuum update.
        expect(tracker.count).toBeGreaterThanOrEqual(1);
        expect(tracker.count).toBeLessThanOrEqual(2);
    });

    it("changes the map src exactly once for one camera state change", async () => {
        const { card, clock, cameraId } = await mountRefreshingCard();
        const tracker = trackSrc(card);
        const camera = card.hass.states[cameraId];
        const next = withState(card.hass, cameraId, {
            last_updated: "2026-11-01T10:00:02.000Z",
            attributes: { ...camera.attributes, entity_picture: "/api/camera_proxy/camera.vacuum_map?token=two" },
        }).hass;

        await clock.advance(1000);
        await applyHass(card, next);
        tracker.check(1000);
        expect(tracker.count).toBe(1);

        // A later render with the same camera state keeps the URL: no second request.
        await clock.advance(1000);
        await applyHass(card, next);
        tracker.check(2000);
        expect(tracker.count).toBe(1);
        expect(imageSrc(card)).toContain("token=two");
    });

    it("changes the map src once per interval when the camera does not change", async () => {
        const { card, clock, vacuumId } = await mountRefreshingCard();
        const tracker = trackSrc(card);
        let hass = card.hass;
        let elapsed = 0;

        for (let update = 1; update <= 100; update++) {
            await clock.advance(100);
            elapsed += 100;
            hass = withState(hass, vacuumId, vacuumPatch(update, 100)).hass;
            await applyHass(card, hass);
            tracker.check(elapsed);
        }

        // 10 s with a 5 s interval: exactly two refreshes, and none in between.
        expect(tracker.count).toBe(2);
        expect(tracker.times[1] - tracker.times[0]).toBeGreaterThanOrEqual(5000);
    });

    it("pauses the map refresh while the document is hidden and refreshes once when visible", async () => {
        const { card, clock, cameraId, vacuumId } = await mountRefreshingCard();
        const tracker = trackSrc(card);
        const initial = tracker.current();

        // Simulate a background tab for 6 s: vacuum renders continue, and the camera changes
        // behind the scenes. Neither may touch the URL.
        await clock.setDocumentHidden(true);
        let hass = card.hass;
        let elapsed = 0;
        for (let update = 1; update <= 20; update++) {
            await clock.advance(300);
            elapsed += 300;
            hass = withState(hass, vacuumId, vacuumPatch(update, 300)).hass;
            await applyHass(card, hass);
            tracker.check(elapsed);
        }
        const camera = hass.states[cameraId];
        hass = withState(hass, cameraId, {
            last_updated: "2026-11-01T10:00:10.000Z",
            attributes: { ...camera.attributes, entity_picture: "/api/camera_proxy/camera.vacuum_map?token=three" },
        }).hass;
        await applyHass(card, hass);
        tracker.check(elapsed);

        expect(tracker.count).toBe(0);
        expect(tracker.current()).toBe(initial);

        // Becoming visible again is the single moment the frozen change is picked up.
        await clock.setDocumentHidden(false);
        await card.element.updateComplete;
        await clock.advance(0);
        tracker.check(elapsed);
        expect(tracker.count).toBe(1);
    });

    it("keeps the map src on becoming visible when nothing changed and no interval elapsed", async () => {
        const { card, clock } = await mountRefreshingCard();
        const tracker = trackSrc(card);

        await clock.setDocumentHidden(true);
        await clock.advance(1000);
        await clock.setDocumentHidden(false);
        await card.element.updateComplete;
        await clock.advance(0);
        tracker.check(1000);

        expect(tracker.count).toBe(0);
    });

    it("refreshes once on becoming visible after the interval elapsed while hidden", async () => {
        const { card, clock } = await mountRefreshingCard();
        const tracker = trackSrc(card);

        await clock.setDocumentHidden(true);
        await clock.advance(6000);
        await clock.setDocumentHidden(false);
        await card.element.updateComplete;
        await clock.advance(0);
        tracker.check(6000);

        expect(tracker.count).toBe(1);
    });

    it("does not change the map-view key or reapply the stored view when the src changes", async () => {
        const { card, clock, cameraId } = await mountRefreshingCard();
        type CardInternals = {
            _getMapViewKey: () => string;
            restoredMapViewKey?: string;
        };
        const internals = card.element as unknown as CardInternals;
        const key = internals._getMapViewKey();
        setMapView(key, { scale: 2, x: 12, y: 34, rotation: 90 });

        // happy-dom has no layout, so the restore's zero-size guard would stop it before it applies
        // anything. Give the zoomer and its content a real box, as a rendered card has.
        const rect = (width: number, height: number): DOMRect => ({
            x: 0,
            y: 0,
            width,
            height,
            top: 0,
            left: 0,
            right: width,
            bottom: height,
            toJSON: () => ({}),
        });
        const zoomer = card.shadowRoot.getElementById("map-zoomer") as HTMLElement;
        const content = card.shadowRoot.getElementById("map-zoomer-content") as HTMLElement;
        vi.spyOn(zoomer, "getBoundingClientRect").mockReturnValue(rect(400, 300));
        vi.spyOn(content, "getBoundingClientRect").mockReturnValue(rect(400, 300));

        const pinchZoom = zoomer as unknown as { setTransform: (options: Record<string, unknown>) => void };
        const setTransform = vi.spyOn(pinchZoom, "setTransform");

        await card.fireMapLoad();
        expect(setTransform).toHaveBeenCalledTimes(1);
        expect(setTransform.mock.calls[0][0]).toMatchObject({ scale: 2, x: 12, y: 34, allowChangeEvent: false });
        expect(internals.restoredMapViewKey).toBe(key);

        // A camera change produces a new src, as it would while cleaning.
        const tracker = trackSrc(card);
        const camera = card.hass.states[cameraId];
        const next = withState(card.hass, cameraId, {
            last_updated: "2026-11-01T10:00:11.000Z",
            attributes: { ...camera.attributes, entity_picture: "/api/camera_proxy/camera.vacuum_map?token=four" },
        }).hass;
        await clock.advance(1000);
        await applyHass(card, next);
        tracker.check(1000);
        expect(tracker.count).toBe(1);

        // The reload that follows must not move the map: the key is unchanged and the stored view
        // is not applied a second time.
        expect(internals._getMapViewKey()).toBe(key);
        await card.fireMapLoad();
        expect(setTransform).toHaveBeenCalledTimes(1);
    });
});
