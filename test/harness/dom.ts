import { vi } from "vitest";

/**
 * Minimal `ha-*` elements. The editor and the card only need the tags to exist so Lit can render
 * them; the real Home Assistant frontend supplies the behaviour.
 */
const HA_ELEMENTS = [
    "ha-card",
    "ha-icon",
    "ha-svg-icon",
    "ha-button",
    "ha-switch",
    "ha-formfield",
    "ha-select",
    "ha-textfield",
    "ha-input",
] as const;

export type HaElementTag = (typeof HA_ELEMENTS)[number];

/**
 * Makes `customElements.get(tag)` report `undefined` for the rest of the test, without trying to
 * undefine the element (a custom element cannot be removed from the registry once defined, so
 * `stubHaElements` cannot offer an "exclude" option). Use this to exercise code that sniffs for an
 * optional Home Assistant element: batch B2 calls `withoutCustomElement("ha-input")` to prove the
 * editor falls back to `ha-textfield` (#958).
 *
 * Returns a restore function. The Vitest config's `restoreMocks` also restores it after the test.
 */
export function withoutCustomElement(tag: string): () => void {
    const originalGet = customElements.get.bind(customElements);
    const spy = vi.spyOn(customElements, "get").mockImplementation((name: string) =>
        name === tag ? undefined : originalGet(name),
    );
    return () => spy.mockRestore();
}

/** Globals this harness had to add because happy-dom does not implement them. */
const installedGlobalStubs = new Set<string>();

export function installedGlobalStubNames(): string[] {
    return [...installedGlobalStubs].sort();
}

const mountedElements = new Set<Element>();

export function trackMountedElement(element: Element): void {
    mountedElements.add(element);
}

function defineHaElements(): void {
    for (const tag of HA_ELEMENTS) {
        if (customElements.get(tag)) continue;
        customElements.define(tag, class extends HTMLElement {});
    }
}

function defineLoadCardHelpers(): void {
    (window as unknown as { loadCardHelpers: () => Promise<unknown> }).loadCardHelpers = vi.fn(async () => ({
        importMoreInfoControl: vi.fn(),
        createCardElement: vi.fn(async () => document.createElement("div")),
        createRowElement: vi.fn(async () => document.createElement("div")),
        createHuiElement: vi.fn(async () => document.createElement("div")),
    }));
}

function defineMatchMedia(): void {
    if (typeof window.matchMedia === "function") return;
    installedGlobalStubs.add("matchMedia");
    window.matchMedia = ((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(() => false),
    })) as unknown as typeof window.matchMedia;
}

function defineResizeObserver(): void {
    if (typeof globalThis.ResizeObserver !== "undefined") return;
    installedGlobalStubs.add("ResizeObserver");
    class ResizeObserverStub {
        public observe = vi.fn();
        public unobserve = vi.fn();
        public disconnect = vi.fn();
    }
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}

function defineIntersectionObserver(): void {
    if (typeof globalThis.IntersectionObserver !== "undefined") return;
    installedGlobalStubs.add("IntersectionObserver");
    class IntersectionObserverStub {
        public root = null;
        public rootMargin = "0px";
        public thresholds: number[] = [];
        public observe = vi.fn();
        public unobserve = vi.fn();
        public disconnect = vi.fn();
        public takeRecords = vi.fn(() => []);
    }
    globalThis.IntersectionObserver = IntersectionObserverStub as unknown as typeof IntersectionObserver;
}

function defineRequestAnimationFrame(): void {
    if (typeof globalThis.requestAnimationFrame === "function") return;
    installedGlobalStubs.add("requestAnimationFrame");
    let handle = 0;
    globalThis.requestAnimationFrame = ((callback: FrameRequestCallback): number => {
        handle += 1;
        setTimeout(() => callback(performance.now()), 16);
        return handle;
    }) as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = (() => undefined) as typeof cancelAnimationFrame;
}

function definePointerEvent(): void {
    if (typeof globalThis.PointerEvent === "function") return;
    installedGlobalStubs.add("PointerEvent");
    class PointerEventStub extends MouseEvent {
        public pointerId = 1;
        public pointerType = "mouse";
        public isPrimary = true;
    }
    globalThis.PointerEvent = PointerEventStub as unknown as typeof PointerEvent;
}

/**
 * happy-dom implements `SVGMatrix` and `SVGPoint` but not `SVGPoint.matrixTransform`, which
 * `pinch-zoom` calls while it stages its child. This is the one DOM gap the card genuinely hits.
 */
function defineSvgPointMatrixTransform(): void {
    const prototype = window.SVGPoint?.prototype as (SVGPoint & {
        matrixTransform?: (matrix: SVGMatrix) => SVGPoint;
    }) | undefined;
    if (!prototype || typeof prototype.matrixTransform === "function") return;
    installedGlobalStubs.add("SVGPoint.matrixTransform");
    prototype.matrixTransform = function matrixTransform(this: SVGPoint, matrix: SVGMatrix): SVGPoint {
        const point = document.createElementNS("http://www.w3.org/2000/svg", "svg").createSVGPoint();
        point.x = matrix.a * this.x + matrix.c * this.y + matrix.e;
        point.y = matrix.b * this.x + matrix.d * this.y + matrix.f;
        return point;
    };
}

/** Installs the DOM surface the card actually uses. Safe to call more than once. */
export function stubHaElements(): void {
    defineHaElements();
    defineLoadCardHelpers();
    defineMatchMedia();
    defineResizeObserver();
    defineIntersectionObserver();
    defineRequestAnimationFrame();
    definePointerEvent();
    defineSvgPointMatrixTransform();
}

export interface CapturedWindowErrors {
    errors: Error[];
    stop: () => void;
}

/**
 * happy-dom reports an exception thrown by a DOM event listener as an `error` event instead of
 * rethrowing it to the `dispatchEvent` caller. Tests that prove a listener throws must collect it
 * this way, exactly like a browser reports an uncaught listener error.
 */
export function captureWindowErrors(): CapturedWindowErrors {
    const errors: Error[] = [];
    const listener = (event: Event): void => {
        const errorEvent = event as ErrorEvent;
        errors.push(errorEvent.error instanceof Error ? errorEvent.error : new Error(errorEvent.message));
    };
    window.addEventListener("error", listener);
    return {
        errors,
        stop: () => window.removeEventListener("error", listener),
    };
}

export interface HarnessClock {
    /** Advances fake timers and lets the resulting Lit updates and promise chains settle. */
    advance: (ms: number) => Promise<void>;
    /** Changes the mocked `Date` without running timers. */
    setSystemTime: (date: Date | string) => void;
    /** Controls `document.hidden` and dispatches `visibilitychange`. */
    setDocumentHidden: (hidden: boolean) => Promise<void>;
    restore: () => void;
}

let restoreDocumentHidden: (() => void) | undefined;

/**
 * Enables fake timers, a controllable `Date`, and a controllable `document.hidden`.
 * `_getMapSrc` reads both `Date` and `document.hidden`, and the disconnect timeout uses timers.
 */
export function useHarnessClock(now: Date | string = "2026-11-01T10:00:00.000Z"): HarnessClock {
    vi.useFakeTimers({ now: new Date(now) });

    let hidden = false;
    const descriptor = Object.getOwnPropertyDescriptor(Document.prototype, "hidden")
        ?? Object.getOwnPropertyDescriptor(document, "hidden");
    Object.defineProperty(document, "hidden", {
        configurable: true,
        get: () => hidden,
    });
    Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => (hidden ? "hidden" : "visible"),
    });
    restoreDocumentHidden = () => {
        delete (document as unknown as Record<string, unknown>).hidden;
        delete (document as unknown as Record<string, unknown>).visibilityState;
        if (descriptor) Object.defineProperty(document, "hidden", descriptor);
    };

    return {
        advance: async (ms: number): Promise<void> => {
            await vi.advanceTimersByTimeAsync(ms);
        },
        setSystemTime: (date: Date | string): void => {
            vi.setSystemTime(new Date(date));
        },
        setDocumentHidden: async (value: boolean): Promise<void> => {
            hidden = value;
            document.dispatchEvent(new Event("visibilitychange"));
            await vi.advanceTimersByTimeAsync(0);
        },
        restore: (): void => {
            restoreDocumentHidden?.();
            restoreDocumentHidden = undefined;
            vi.useRealTimers();
        },
    };
}

/** Clears the document and local storage before a test. */
export function resetHarnessDom(): void {
    document.body.innerHTML = "";
    window.localStorage.clear();
}

/** Disconnects anything still mounted and restores timers and document state after a test. */
export function teardownHarnessDom(): void {
    mountedElements.forEach(element => {
        try {
            element.remove();
        } catch {
            // An element whose custom-element constructor threw is already harmless.
        }
    });
    mountedElements.clear();
    document.body.innerHTML = "";
    window.localStorage.clear();
    if (vi.isFakeTimers()) {
        vi.clearAllTimers();
        vi.useRealTimers();
    }
    if (restoreDocumentHidden) {
        restoreDocumentHidden();
        restoreDocumentHidden = undefined;
    }
}

/** Sets up a clean harness for one test. */
export function setupHarness(): void {
    resetHarnessDom();
    stubHaElements();
}

export { HA_ELEMENTS };
