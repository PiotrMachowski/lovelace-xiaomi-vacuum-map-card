import { describe, expect, it, vi } from "vitest";

import type { XiaomiVacuumMapCardConfig } from "../../src/types/types";
import type { HarnessClock } from "../harness";
import {
    fixtureConfig,
    fixtureHass,
    loadSyntheticFixture,
    mountCard,
    useHarnessClock,
} from "../harness";

type CardWithDelayedWork = {
    _updateElements: (somethingChanged?: boolean) => void;
    _restoreMapView: () => void;
    _rotateMap: () => void;
    _getCssProperty: (property: string) => string;
};

interface DelayedWorkFixture {
    card: Awaited<ReturnType<typeof mountCard>>;
    clock: HarnessClock;
    delayed: CardWithDelayedWork;
}

/**
 * Mounts the card and lets its mount-time delayed work finish, so the tests below queue exactly one
 * delayed restore of their own. The config uses an `image` map source on purpose: with a camera map
 * happy-dom queues an image `load` that lands after the test starts measuring, and that listener
 * calls `_restoreMapView` on its own, outside the delayed work under test.
 */
async function mountSettledCard(options: { inEditorPreview?: boolean } = {}): Promise<DelayedWorkFixture> {
    const clock = useHarnessClock();
    const fixture = loadSyntheticFixture();
    const config: XiaomiVacuumMapCardConfig = {
        ...fixtureConfig(fixture),
        map_source: { image: "test-map.png" },
        calibration_source: { identity: true },
    };
    const card = await mountCard(config, fixtureHass(fixture), options);
    await clock.advance(1000);
    return { card, clock, delayed: card.element as unknown as CardWithDelayedWork };
}

/**
 * `updated` calls `_updateElements`, which queues a 100 ms map-view restore. Calling it directly
 * queues that same work without rendering again, so the assertion is about the delayed callback
 * and not about anything a fresh render would start.
 */
function queueDelayedRestore(delayed: CardWithDelayedWork): { restoreMapView: ReturnType<typeof vi.spyOn> } {
    const restoreMapView = vi.spyOn(delayed, "_restoreMapView");
    delayed._updateElements();
    return { restoreMapView };
}

describe("card disconnect and delayed work", () => {
    it("does not run queued delayed work after the card is removed directly", async () => {
        const { card, clock, delayed } = await mountSettledCard();
        const requestUpdate = vi.spyOn(card.element, "requestUpdate");
        const pending = vi.getTimerCount();
        const { restoreMapView } = queueDelayedRestore(delayed);
        expect(vi.getTimerCount()).toBe(pending + 1);

        // Remove before the 100 ms delay elapses, then let it pass. Without cancelling on
        // disconnect the restore still runs, and once the test environment is gone it throws
        // `ReferenceError: window is not defined` as an unhandled rejection.
        card.element.remove();
        expect(vi.getTimerCount()).toBe(0);
        requestUpdate.mockClear(); // `connected = false` is a state write of its own
        await clock.advance(500);

        expect(restoreMapView).not.toHaveBeenCalled();
        expect(requestUpdate).not.toHaveBeenCalled();
    });

    it("does not run queued delayed work when the editor-preview harness removes the wrapper", async () => {
        const { card, clock, delayed } = await mountSettledCard({ inEditorPreview: true });
        const requestUpdate = vi.spyOn(card.element, "requestUpdate");
        const pending = vi.getTimerCount();
        const { restoreMapView } = queueDelayedRestore(delayed);
        expect(vi.getTimerCount()).toBe(pending + 1);

        // The harness removes the `hui-card-preview` wrapper, not the card, exactly as Home
        // Assistant tears a preview down.
        await card.cleanup();
        // Let the disconnect reactions and any update that was already in flight finish: a render
        // completing after removal may queue work again, which the `connected` guard must drop.
        await clock.advance(0);
        requestUpdate.mockClear();
        await clock.advance(500);

        expect(restoreMapView).not.toHaveBeenCalled();
        expect(requestUpdate).not.toHaveBeenCalled();
    });

    it("still runs the delayed restore while the card is connected", async () => {
        const { clock, delayed } = await mountSettledCard();
        const { restoreMapView } = queueDelayedRestore(delayed);

        await clock.advance(99);
        expect(restoreMapView).not.toHaveBeenCalled();

        await clock.advance(2);
        expect(restoreMapView).toHaveBeenCalledTimes(1);
    });

    it("clears a cancelled rotate transition when the card is re-attached within 300 ms", async () => {
        const { card, clock, delayed } = await mountSettledCard();
        // happy-dom has no custom-property cascade, so stub the value a rotate press would read.
        vi.spyOn(delayed, "_getCssProperty").mockReturnValue("200ms");
        delayed._rotateMap();

        const zoomerContent = card.shadowRoot.getElementById("map-zoomer-content") as HTMLElement;
        expect(zoomerContent.style.transitionDuration).toBe("200ms");

        // Home Assistant detaches and re-attaches cards on a masonry re-layout, well inside the
        // 300 ms window in which the inline duration is meant to be cleared. The pending reset is
        // cancelled by the disconnect, and Lit never rewrites the static style attribute, so the
        // card itself has to leave it at "0s" before it is attached again.
        const parent = card.element.parentElement as HTMLElement;
        card.element.remove();
        parent.appendChild(card.element);
        await clock.advance(1000);

        const reattached = card.shadowRoot.getElementById("map-zoomer-content") as HTMLElement;
        expect(reattached.style.transitionDuration).toBe("0s");
    });

    it("ignores a map image load that lands after the card is removed", async () => {
        const { card, delayed } = await mountSettledCard();
        const restoreMapView = vi.spyOn(delayed, "_restoreMapView");

        // The load path is live while connected, so the assertion below is about the removal.
        await card.fireMapLoad();
        expect(restoreMapView).toHaveBeenCalled();
        restoreMapView.mockClear();

        card.element.remove();
        await card.fireMapLoad();
        expect(restoreMapView).not.toHaveBeenCalled();
    });
});
