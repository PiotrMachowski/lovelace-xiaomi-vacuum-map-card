import { vi } from "vitest";

import { EVENT_ROOM_CONFIG, EVENT_ROOM_CONFIG_GET } from "../../src/const";
import type { RoomConfigEventData, XiaomiVacuumMapCardConfig } from "../../src/types/types";
import type { XiaomiVacuumMapCard } from "../../src/xiaomi-vacuum-map-card";
import type { XiaomiVacuumMapCardEditor } from "../../src/editor";
import type { MockHass } from "./hass";
import { trackMountedElement } from "./dom";

export interface Settleable {
    updateComplete?: Promise<unknown>;
}

/**
 * Lets queued Lit updates and the card's own delayed work run. Works with real and fake timers,
 * so a test can enable `useHarnessClock()` and still mount without hanging.
 */
export async function settle(element?: Settleable, ms = 150): Promise<void> {
    if (ms > 0) {
        if (vi.isFakeTimers()) {
            await vi.advanceTimersByTimeAsync(ms);
        } else {
            await new Promise(resolve => setTimeout(resolve, ms));
        }
    }
    if (element?.updateComplete) {
        await element.updateComplete;
    }
    if (vi.isFakeTimers()) {
        await vi.advanceTimersByTimeAsync(0);
    } else {
        await Promise.resolve();
    }
}

export interface WaitForOptions {
    timeout?: number;
    interval?: number;
    label?: string;
}

/** Polls until `predicate` returns a truthy value, advancing fake timers when they are active. */
export async function waitFor<T>(
    predicate: () => T | undefined | false | null,
    options: WaitForOptions = {},
): Promise<T> {
    const timeout = options.timeout ?? 2000;
    const interval = options.interval ?? 10;
    let elapsed = 0;
    for (;;) {
        const value = predicate();
        if (value) return value;
        if (elapsed >= timeout) {
            throw new Error(`waitFor timed out after ${timeout}ms${options.label ? `: ${options.label}` : ""}`);
        }
        if (vi.isFakeTimers()) {
            await vi.advanceTimersByTimeAsync(interval);
        } else {
            await new Promise(resolve => setTimeout(resolve, interval));
        }
        elapsed += interval;
    }
}

export interface MapLoadOptions {
    width?: number;
    height?: number;
}

export interface CardHandle {
    element: XiaomiVacuumMapCard;
    hass: MockHass;
    shadowRoot: ShadowRoot;
    updateHass: (hass: MockHass) => Promise<void>;
    fireMapLoad: (options?: MapLoadOptions) => Promise<void>;
    cleanup: () => Promise<void>;
}

export interface EditorHandle {
    element: XiaomiVacuumMapCardEditor;
    hass: MockHass;
    shadowRoot: ShadowRoot;
    updateHass: (hass: MockHass) => Promise<void>;
    cleanup: () => Promise<void>;
}

export interface MountCardOptions {
    container?: HTMLElement;
    /** Wraps the card in `<hui-card-preview>` so the card considers itself in the card editor. */
    inEditorPreview?: boolean;
}

function resolveContainer(options: MountCardOptions): HTMLElement {
    if (options.container) return options.container;
    if (options.inEditorPreview) {
        const preview = document.createElement("hui-card-preview");
        document.body.appendChild(preview);
        return preview;
    }
    return document.body;
}

async function ensureCardElementDefined(): Promise<void> {
    await import("../../src/xiaomi-vacuum-map-card");
}

async function ensureEditorElementDefined(): Promise<void> {
    await import("../../src/editor");
}

/** Mounts a card into the document and waits for its first render. */
export async function mountCard(
    config: XiaomiVacuumMapCardConfig,
    hass: MockHass,
    options: MountCardOptions = {},
): Promise<CardHandle> {
    await ensureCardElementDefined();
    const container = resolveContainer(options);
    const element = document.createElement("xiaomi-vacuum-map-card") as XiaomiVacuumMapCard;
    trackMountedElement(element);

    element.setConfig(config);
    container.appendChild(element);
    element.hass = hass;
    const shadowRoot = await waitFor(() => element.shadowRoot, { label: "card shadow root" });
    await settle(element);

    const handle: CardHandle = {
        element,
        hass,
        shadowRoot,
        updateHass: async (nextHass: MockHass): Promise<void> => {
            element.hass = nextHass;
            handle.hass = nextHass;
            await settle(element);
        },
        fireMapLoad: async (loadOptions: MapLoadOptions = {}): Promise<void> => {
            await fireMapLoad(handle, loadOptions);
        },
        cleanup: async (): Promise<void> => {
            element.remove();
        },
    };
    return handle;
}

/** Mounts the card editor and waits until its form is rendered. */
export async function mountEditor(
    config: XiaomiVacuumMapCardConfig,
    hass: MockHass,
): Promise<EditorHandle> {
    await ensureEditorElementDefined();
    const element = document.createElement("xiaomi-vacuum-map-card-editor") as XiaomiVacuumMapCardEditor;
    trackMountedElement(element);

    element.setConfig(config);
    document.body.appendChild(element);
    element.hass = hass;
    const shadowRoot = await waitFor(() => element.shadowRoot, { label: "editor shadow root" });
    await waitFor(() => shadowRoot.querySelector(".card-config"), { label: "editor form" });
    await settle(element);

    const handle: EditorHandle = {
        element,
        hass,
        shadowRoot,
        updateHass: async (nextHass: MockHass): Promise<void> => {
            element.hass = nextHass;
            handle.hass = nextHass;
            await settle(element);
        },
        cleanup: async (): Promise<void> => {
            element.remove();
        },
    };
    return handle;
}

/**
 * Dispatches the map image's `load` event the card listens to, with the natural size a browser
 * would report. happy-dom never fetches the image, so the map would otherwise stay unloaded.
 */
export async function fireMapLoad(handle: CardHandle, options: MapLoadOptions = {}): Promise<void> {
    const image = handle.shadowRoot.getElementById("map-image-source") as HTMLImageElement | null;
    if (!image) throw new Error("fireMapLoad: the card has no #map-image-source element");
    const width = options.width ?? 200;
    const height = options.height ?? 150;
    Object.defineProperty(image, "naturalWidth", { configurable: true, value: width });
    Object.defineProperty(image, "naturalHeight", { configurable: true, value: height });
    image.dispatchEvent(new Event("load"));
    await settle(handle.element);
}

function presetIndicatorIndex(selector: Element | null): number {
    const text = selector?.querySelector(".preset-indicator")?.textContent ?? "";
    const dots = Array.from(text).filter(character => character === "●" || character === "○");
    return dots.indexOf("●");
}

/** Clicks the card's own preset arrows until the requested preset is active. */
export async function selectPreset(handle: CardHandle, index: number): Promise<void> {
    for (let attempt = 0; attempt < 25; attempt++) {
        const selector = handle.shadowRoot.querySelector("xvmc-preset-selector");
        if (presetIndicatorIndex(selector) === index) return;
        const wrappers = selector?.querySelectorAll(".preset-selector-icon-wrapper");
        if (!wrappers || wrappers.length < 2) {
            throw new Error("selectPreset: the card does not show a preset selector (fewer than two presets)");
        }
        const current = presetIndicatorIndex(selector);
        const target = index > current ? wrappers[1] : wrappers[0];
        (target as HTMLElement).click();
        await settle(handle.element);
    }
    throw new Error(`selectPreset: could not reach preset ${index}`);
}

/** Dispatches `EVENT_ROOM_CONFIG_GET`, the same event the editor's generate button sends. */
export function requestRoomConfig(): void {
    window.dispatchEvent(new Event(EVENT_ROOM_CONFIG_GET));
}

/** Dispatches `EVENT_ROOM_CONFIG` with the given payload, as a card does when answering. */
export function fireRoomConfig(roomConfig: RoomConfigEventData | undefined): void {
    const event = new Event(EVENT_ROOM_CONFIG);
    (event as Event & { roomConfig: RoomConfigEventData | undefined }).roomConfig = roomConfig;
    window.dispatchEvent(event);
}

export type PageEntry =
    | {
          kind: "card";
          config: XiaomiVacuumMapCardConfig;
          hass: MockHass;
          inEditorPreview?: boolean;
      }
    | {
          kind: "editor";
          config: XiaomiVacuumMapCardConfig;
          hass: MockHass;
      };

export interface MountedPage {
    handles: Array<CardHandle | EditorHandle>;
    cards: CardHandle[];
    editors: EditorHandle[];
    cleanup: () => Promise<void>;
}

/**
 * Mounts several cards and editors into one document, in the given order, so tests can prove
 * behaviour that only breaks when two of them share a page.
 */
export async function mountPage(entries: PageEntry[]): Promise<MountedPage> {
    const handles: Array<CardHandle | EditorHandle> = [];
    const cards: CardHandle[] = [];
    const editors: EditorHandle[] = [];
    for (const entry of entries) {
        if (entry.kind === "card") {
            const handle = await mountCard(entry.config, entry.hass, {
                inEditorPreview: entry.inEditorPreview,
            });
            handles.push(handle);
            cards.push(handle);
        } else {
            const handle = await mountEditor(entry.config, entry.hass);
            handles.push(handle);
            editors.push(handle);
        }
    }
    return {
        handles,
        cards,
        editors,
        cleanup: async (): Promise<void> => {
            for (const handle of handles) await handle.cleanup();
        },
    };
}
