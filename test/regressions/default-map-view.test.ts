import { describe, expect, it, vi } from "vitest";

import { MAP_VIEW_STORE_KEY } from "../../src/const";
import { getMapView } from "../../src/model/map-view-store";
import type { XiaomiVacuumMapCardConfig } from "../../src/types/types";
import type { CardHandle, HarnessClock, MockHass } from "../harness";
import {
    fixtureConfig,
    fixtureHass,
    loadSyntheticFixture,
    mountCard,
    settle,
    useHarnessClock,
} from "../harness";

/**
 * The configured default map view (issue #873).
 *
 * A stored view still wins, a card with no stored view starts at `map_view`, and the reset action
 * returns to it. The assertions read the map view state the card renders from — `mapScale`, `mapX`,
 * `mapY`, `mapRotation` — rather than the storage helpers, so the tests would also catch a view
 * that is resolved correctly but never applied to the pinch-zoom transform.
 */

/** The map view state the card exposes, as the visual harness reads it too. */
interface MapViewState {
    mapScale: number;
    mapX: number;
    mapY: number;
    mapRotation: number;
}

interface MapFixture {
    card: CardHandle;
    clock: HarnessClock;
    hass: MockHass;
    config: XiaomiVacuumMapCardConfig;
}

function defaultViewConfig(overrides: Partial<XiaomiVacuumMapCardConfig> = {}): XiaomiVacuumMapCardConfig {
    const fixture = loadSyntheticFixture();
    return {
        ...fixtureConfig(fixture),
        // Pin tiles and icons empty: this file is about the map view only.
        tiles: [],
        icons: [],
        map_view: { scale: 2.5, x: 24, y: -18, rotation: 90 },
        ...overrides,
    };
}

function rect(width: number, height: number): DOMRect {
    return {
        x: 0,
        y: 0,
        width,
        height,
        top: 0,
        left: 0,
        right: width,
        bottom: height,
        toJSON: () => ({}),
    };
}

/**
 * happy-dom has no layout, so the restore's zero-size guard would stop every scenario before it
 * applies anything. Give the zoomer and its content the box a rendered card has, as the existing
 * refresh-policy test does.
 */
function giveMapLayout(card: CardHandle): void {
    const zoomer = card.shadowRoot.getElementById("map-zoomer") as HTMLElement;
    const content = card.shadowRoot.getElementById("map-zoomer-content") as HTMLElement;
    vi.spyOn(zoomer, "getBoundingClientRect").mockReturnValue(rect(400, 300));
    vi.spyOn(content, "getBoundingClientRect").mockReturnValue(rect(400, 300));
}

function pinchZoom(card: CardHandle): HTMLElement & {
    scale: number;
    x: number;
    y: number;
    setTransform: (options: Record<string, unknown>) => void;
} {
    return card.shadowRoot.getElementById("map-zoomer") as HTMLElement & {
        scale: number;
        x: number;
        y: number;
        setTransform: (options: Record<string, unknown>) => void;
    };
}

function viewState(card: CardHandle): MapViewState {
    const state = card.element as unknown as MapViewState;
    return {
        mapScale: state.mapScale,
        mapX: state.mapX,
        mapY: state.mapY,
        mapRotation: state.mapRotation,
    };
}

/** What the card renders for the rotation, which must follow the applied view, not only its field. */
function renderedRotation(card: CardHandle): string {
    const cardElement = card.shadowRoot.querySelector("ha-card") as HTMLElement;
    return cardElement.style.getPropertyValue("--map-rotation").trim();
}

async function mountWithView(
    overrides: Partial<XiaomiVacuumMapCardConfig> = {},
): Promise<MapFixture> {
    const clock = useHarnessClock();
    const fixture = loadSyntheticFixture();
    const config = defaultViewConfig(overrides);
    const hass = fixtureHass(fixture);
    const card = await mountCard(config, hass);
    // The mount-time delayed restore runs before the image is ready; the load is what applies a view.
    giveMapLayout(card);
    await card.fireMapLoad();
    return { card, clock, hass, config };
}

async function remount(card: CardHandle, config: XiaomiVacuumMapCardConfig): Promise<CardHandle> {
    const parent = card.element.parentElement as HTMLElement;
    card.element.remove();
    const next = await mountCard(config, card.hass);
    giveMapLayout(next);
    await next.fireMapLoad();
    return next;
}

/** A user pan/zoom, as the pinch-zoom gesture would apply it. */
async function panAndZoom(card: CardHandle, scale: number, x: number, y: number): Promise<void> {
    pinchZoom(card).setTransform({ scale, x, y, allowChangeEvent: true });
    await settle(card.element);
}

/** The one stored entry, keyed the way the card keys it. */
function storedView(): { key: string; view: ReturnType<typeof getMapView> } {
    const storage = JSON.parse(window.localStorage.getItem(MAP_VIEW_STORE_KEY) ?? "{}") as Record<string, unknown>;
    const key = Object.keys(storage)[0];
    return { key, view: key ? getMapView(key) : undefined };
}

/** The card action a dashboard button fires at this card. */
async function fireMapViewReset(card: CardHandle): Promise<void> {
    document.dispatchEvent(
        new CustomEvent("ll-custom", {
            detail: {
                xiaomi_vacuum_map_card: {
                    action_handler_id: "this",
                    action: "map_view.reset",
                },
            },
        }),
    );
    await settle(card.element);
}

describe("configured default map view in the card", () => {
    it("applies the configured map_view on the first render when nothing is stored", async () => {
        const { card } = await mountWithView();

        expect(viewState(card)).toEqual({ mapScale: 2.5, mapX: 24, mapY: -18, mapRotation: 90 });
        expect(renderedRotation(card)).toBe("90deg");
        expect(storedView().view).toBeUndefined();
    });

    it("keeps the previous neutral view when no default is configured", async () => {
        const { card } = await mountWithView({ map_view: undefined, map_rotation: 90 });

        expect(viewState(card)).toEqual({ mapScale: 1, mapX: 0, mapY: 0, mapRotation: 90 });
        expect(renderedRotation(card)).toBe("90deg");
    });

    it("lets a user pan/zoom win and persists it, so it beats the default after a reload", async () => {
        const { card, clock, config } = await mountWithView();

        await panAndZoom(card, 2, 10, 20);
        // The save is debounced exactly like a gesture's; nothing is written until it flushes.
        expect(storedView().view).toBeUndefined();
        await clock.advance(400);

        expect(viewState(card)).toEqual({ mapScale: 2, mapX: 10, mapY: 20, mapRotation: 90 });
        const stored = storedView();
        expect(stored.view).toMatchObject({ scale: 2, x: 10, y: 20, rotation: 90 });

        const reloaded = await remount(card, config);
        expect(viewState(reloaded)).toEqual({ mapScale: 2, mapX: 10, mapY: 20, mapRotation: 90 });
    });

    it("returns to the configured default from the map_view.reset action and persists it", async () => {
        const { card, clock } = await mountWithView();
        await panAndZoom(card, 1.25, -40, 35);
        await clock.advance(400);
        expect(viewState(card).mapScale).toBe(1.25);

        await fireMapViewReset(card);

        expect(viewState(card)).toEqual({ mapScale: 2.5, mapX: 24, mapY: -18, mapRotation: 90 });
        expect(renderedRotation(card)).toBe("90deg");

        // The reset is persisted exactly like an equivalent gesture: the next load keeps it.
        await clock.advance(400);
        expect(storedView().view).toMatchObject({ scale: 2.5, x: 24, y: -18, rotation: 90 });
    });

    it("returns to the neutral view from the reset control when no default is configured", async () => {
        const { card, clock } = await mountWithView({ map_view: undefined, map_rotation: 90 });
        await panAndZoom(card, 2, 30, -10);
        await clock.advance(400);
        expect(viewState(card).mapScale).toBe(2);

        const reset = card.shadowRoot.querySelector('ha-icon[icon="mdi:image-filter-center-focus"]') as HTMLElement;
        reset.click();
        await settle(card.element);

        expect(viewState(card)).toEqual({ mapScale: 1, mapX: 0, mapY: 0, mapRotation: 90 });
        // Neutral is scale 1, no offset and the preset's configured rotation — the pre-B9 reset.
        await clock.advance(400);
        expect(storedView().view).toMatchObject({ scale: 1, x: 0, y: 0, rotation: 90 });
    });

    it("applies the configured default even when persistence is disabled", async () => {
        const { card, clock } = await mountWithView({ persist_map_view: false });

        expect(viewState(card)).toEqual({ mapScale: 2.5, mapX: 24, mapY: -18, mapRotation: 90 });

        await panAndZoom(card, 1.5, 5, 5);
        await clock.advance(400);
        // `persist_map_view: false` still means "remember nothing", so no stored entry appears.
        expect(storedView().key).toBeUndefined();
        expect(viewState(card).mapScale).toBe(1.5);
    });

    it("raises a config error instead of applying a malformed default", async () => {
        const clock = useHarnessClock();
        const fixture = loadSyntheticFixture();
        // A malformed view never reaches the map: `setConfig` keeps the error and `render` shows it.
        const card = await mountCard(defaultViewConfig({ map_view: { scale: 0 } }), fixtureHass(fixture));
        await clock.advance(400);

        expect(card.shadowRoot.querySelector("hui-error-card, pre")).not.toBeNull();
        expect(storedView().key).toBeUndefined();
    });
});
