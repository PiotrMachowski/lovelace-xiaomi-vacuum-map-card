/*
 * Browser-side harness for the Playwright visual suite.
 *
 * The Vitest harness under test/harness/ is Node-only: it imports `vitest` and reads fixtures with
 * `node:fs`. This module is the browser counterpart. It loads the committed synthetic fixture over
 * HTTP, builds the same mock `hass` shape the Vitest `mockHass` builds, and mounts the card element
 * directly. Nothing here is imported by the card, and no Home Assistant frontend is loaded.
 *
 * Only what the card reads is implemented: states, display registry, the entity-registry and
 * frontend-translation websocket commands, formatting helpers and a no-op service call. Anything
 * else the card asks for throws, so a missing mock is loud instead of silently returning undefined.
 */

const CARD_TAG = "xiaomi-vacuum-map-card";
const FIXTURE_BASE = "/fixtures/synthetic/";

/** Home Assistant elements the card renders. The real frontend supplies their behaviour. */
const STUB_ELEMENTS = [
    "ha-card",
    "ha-icon",
    "ha-svg-icon",
    "ha-button",
    "ha-switch",
    "ha-formfield",
    "ha-select",
    "ha-textfield",
    "ha-input",
    "paper-button",
    "hui-warning",
    "hui-card-preview",
];

const visual = {
    ready: false,
    card: undefined,
    hass: undefined,
    states: undefined,
    registry: undefined,
    wsCalls: [],
};

function defineStubElements() {
    for (const tag of STUB_ELEMENTS) {
        if (!customElements.get(tag)) customElements.define(tag, class extends HTMLElement {});
    }
}

function displayRegistry(entries) {
    const display = {};
    for (const entry of entries) {
        display[entry.entity_id] = {
            entity_id: entry.entity_id,
            name: entry.name ?? undefined,
            device_id: entry.device_id,
            area_id: entry.area_id ?? undefined,
            hidden: entry.hidden ?? undefined,
            entity_category: entry.entity_category,
            translation_key: entry.translation_key,
            platform: entry.platform,
            display_precision: entry.display_precision,
        };
    }
    return display;
}

function createHass(states, registry) {
    const entries = registry.map(entry => ({
        ...entry,
        unique_id: entry.unique_id ?? entry.entity_id,
        disabled_by: entry.disabled_by ?? null,
    }));
    const findEntry = entityId => entries.find(candidate => candidate.entity_id === entityId);

    const callWS = async message => {
        visual.wsCalls.push({ type: String(message.type), message });
        switch (message.type) {
            case "config/entity_registry/get": {
                const entry = findEntry(String(message.entity_id ?? ""));
                if (!entry) throw new Error(`visual harness: no registry entry for ${message.entity_id}`);
                return entry;
            }
            case "config/entity_registry/list":
                return entries;
            case "config/entity_registry/get_entries": {
                // Core answers with a plain entity-id keyed object and `null` for unknown ids.
                const requested = message.entity_ids ?? [];
                const result = {};
                for (const entityId of requested) result[entityId] = findEntry(entityId) ?? null;
                return result;
            }
            case "frontend/get_translations":
                return { resources: {} };
            default:
                throw new Error(`visual harness: unhandled websocket command "${String(message.type)}"`);
        }
    };

    return {
        states,
        entities: displayRegistry(entries),
        connected: true,
        language: "en",
        locale: {
            language: "en",
            number_format: "language",
            time_format: "language",
            first_weekday: "language",
        },
        hassUrl: (path = "") => `${window.location.origin}${path}`,
        // The card's own strings come from the bundled translations; this only fills in frontend
        // keys the bundle does not carry.
        localize: ts => {
            const key = typeof ts === "string" ? ts : String((ts && ts[0]) ?? "");
            const last = key.split(".").pop() ?? key;
            return last.replace(/_/g, " ");
        },
        callService: async () => undefined,
        callWS,
        connection: {
            sendMessagePromise: async () => ({ value: null }),
            subscribeMessage: async () => () => undefined,
            subscribeEvents: async () => () => undefined,
            close: () => undefined,
        },
        formatEntityState: stateObj => stateObj.state,
        formatEntityAttributeValue: (stateObj, attribute) => String(stateObj.attributes[attribute] ?? ""),
        formatEntityAttributeName: (_stateObj, attribute) => attribute,
        formatEntityName: stateObj => String(stateObj.attributes.friendly_name ?? stateObj.entity_id),
    };
}

async function loadFixtures() {
    const [states, camera, registry] = await Promise.all(
        ["states.json", "camera.json", "registry.json"].map(async file => {
            const response = await fetch(`${FIXTURE_BASE}${file}`);
            if (!response.ok) throw new Error(`visual harness: could not load ${file} (${response.status})`);
            return response.json();
        }),
    );
    return { states: { ...states, [camera.entity_id]: camera }, camera, registry };
}

function nextFrame() {
    return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitFor(predicate, label, timeout = 5000) {
    const started = Date.now();
    for (;;) {
        const value = predicate();
        if (value) return value;
        if (Date.now() - started > timeout) throw new Error(`visual harness: timed out waiting for ${label}`);
        await nextFrame();
    }
}

/** Lets Lit finish and the browser paint the settled frame. */
async function settle() {
    if (visual.card) await visual.card.updateComplete;
    await nextFrame();
    if (visual.card) await visual.card.updateComplete;
    await nextFrame();
}

function shadow() {
    if (!visual.card?.shadowRoot) throw new Error("visual harness: the card is not mounted");
    return visual.card.shadowRoot;
}

function roomWrapper(roomId) {
    return shadow().querySelector(`.room-${String(roomId)}-wrapper`);
}

/**
 * A point inside a room's rendered outline, in viewport (CSS pixel) coordinates.
 *
 * `fractionX`/`fractionY` are fractions of the outline's screen bounding box. The synthetic
 * fixture's rooms are axis-aligned rectangles, so any fraction inside 0..1 is inside the room; the
 * default centre is where the room icon sits, which is why the hit test clicks off-centre.
 */
function roomPoint(roomId, fractionX = 0.5, fractionY = 0.5) {
    const wrapper = roomWrapper(roomId);
    const polygon = wrapper?.querySelector("polygon");
    if (!polygon) throw new Error(`visual harness: room ${roomId} is not rendered`);
    const bounds = polygon.getBoundingClientRect();
    if (!bounds.width || !bounds.height) throw new Error(`visual harness: room ${roomId} has no size`);
    return {
        x: bounds.x + bounds.width * fractionX,
        y: bounds.y + bounds.height * fractionY,
    };
}

async function mount(config) {
    const root = document.getElementById("card-root");
    if (!root) throw new Error("visual harness: #card-root is missing from the page");
    root.replaceChildren();
    visual.card = undefined;

    const card = document.createElement(CARD_TAG);
    // Home Assistant sets config and hass before attaching the element.
    card.setConfig(config);
    card.hass = visual.hass;
    root.appendChild(card);
    await card.updateComplete;
    visual.card = card;

    // Wait for the fixture map to decode and for the overlay pass that room detection triggers.
    await waitFor(() => {
        const image = card.shadowRoot?.getElementById("map-image-source");
        return !!image && image.complete && image.naturalWidth > 0;
    }, "the fixture map image");
    await waitFor(() => card.shadowRoot?.getElementById("svg-wrapper"), "the map overlay");
    await settle();

    const roomMode = (card.modes ?? []).some(mode => String(mode.selectionType).toUpperCase() === "ROOM");
    if (roomMode) {
        await waitFor(() => card.shadowRoot.querySelectorAll(".room-wrapper").length > 0, "room outlines");
        await settle();
    }
    // `_setPresetIndex` finishes icon/tile generation on a 100 ms timer and then re-applies the
    // selection mode. Wait past it so the first screenshot cannot catch the intermediate frame.
    await delay(350);
    await settle();
    return true;
}

/**
 * A room's rendered outline bounding box in source-image pixels (not CSS pixels).
 *
 * The SVG lives in the untransformed layout space, so `getBBox()` is independent of zoom and
 * rotation, and room outlines are drawn at `imagePixel * realScale`. Dividing by `realScale` gives
 * back the pixel rectangle the detector found, which can be compared with the fixture geometry
 * without involving a screenshot or any browser rendering detail.
 */
function roomOutlineBox(roomId) {
    const wrapper = roomWrapper(roomId);
    const polygon = wrapper?.querySelector("polygon");
    const realScale = visual.card?.realScale;
    if (!polygon) throw new Error(`visual harness: room ${roomId} is not rendered`);
    if (!realScale) throw new Error("visual harness: realScale is not available");
    const box = polygon.getBBox();
    return {
        x: box.x / realScale,
        y: box.y / realScale,
        width: box.width / realScale,
        height: box.height / realScale,
    };
}

/** The rendered outline's centre as a fraction of the untransformed map content box. */
function roomAnchor(roomId) {
    const wrapper = roomWrapper(roomId);
    const polygon = wrapper?.querySelector("polygon");
    const content = shadow().getElementById("map-zoomer-content");
    if (!polygon || !content) throw new Error(`visual harness: room ${roomId} is not rendered`);
    const box = polygon.getBBox();
    if (!box.width || !box.height) throw new Error(`visual harness: room ${roomId} has no size`);
    return {
        x: (box.x + box.width / 2) / content.offsetWidth,
        y: (box.y + box.height / 2) / content.offsetHeight,
    };
}

/**
 * Applies a pinch-zoom transform with `scale`, keeping the content point at `anchor` (fractions of
 * the untransformed content box, default its centre) in the middle of the map viewport.
 *
 * `pinch-zoom.scaleTo({ relativeTo: "container" })` measures the *transformed* content rect, so it
 * drifts once the map is rotated. Setting the transform explicitly keeps the framed point identical
 * at every rotation, which is what makes the four overlay screenshots comparable.
 */
async function setZoom(scale, anchor = { x: 0.5, y: 0.5 }) {
    const zoomer = shadow().getElementById("map-zoomer");
    const content = shadow().getElementById("map-zoomer-content");
    if (!zoomer || !content) throw new Error("visual harness: the map zoomer is missing");
    const viewport = zoomer.getBoundingClientRect();
    const width = content.offsetWidth;
    const height = content.offsetHeight;
    const radians = ((visual.card.mapRotation ?? 0) * Math.PI) / 180;
    const offsetX = width * anchor.x - width / 2;
    const offsetY = height * anchor.y - height / 2;
    const rotatedX = offsetX * Math.cos(radians) - offsetY * Math.sin(radians);
    const rotatedY = offsetX * Math.sin(radians) + offsetY * Math.cos(radians);
    // Mirrors the card's transform: translate(x, y) scale(s) rotate-about-the-content-centre.
    zoomer.setTransform({
        scale,
        x: viewport.width / 2 - scale * (width / 2 + rotatedX),
        y: viewport.height / 2 - scale * (height / 2 + rotatedY),
        allowChangeEvent: true,
    });
    await settle();
    return { mapScale: visual.card.mapScale, realScale: visual.card.realScale };
}

function selectedRoomIds() {
    return (visual.card.selectedRooms ?? []).map(room => String(room.toVacuum()));
}

/** Geometry the suite asserts on and uses to locate a click point. */
function describe() {
    const card = visual.card;
    if (!card) throw new Error("visual harness: the card is not mounted");
    const image = card.shadowRoot.getElementById("map-image");
    const imageRect = image.getBoundingClientRect();
    const content = card.shadowRoot.getElementById("map-zoomer-content");
    const zoomer = card.shadowRoot.getElementById("map-zoomer");
    const contentRect = content.getBoundingClientRect();
    const viewport = zoomer.getBoundingClientRect();
    return {
        mapScale: card.mapScale,
        mapX: card.mapX,
        mapY: card.mapY,
        realScale: card.realScale,
        mapRotation: card.mapRotation,
        // The transform the browser actually renders, not only the numbers the card holds: the
        // custom properties feed `#map-zoomer-content`'s CSS, so a state value that never reached the
        // stylesheet shows up here as a mismatch.
        transform: content ? getComputedStyle(content).transform : "none",
        rooms: [...card.shadowRoot.querySelectorAll(".room-wrapper")].map(wrapper => ({
            className: wrapper.getAttribute("class"),
            selected: wrapper.classList.contains("selected"),
        })),
        imageRect: { x: imageRect.x, y: imageRect.y, width: imageRect.width, height: imageRect.height },
        // The transformed content box (where the map ended up) and the untransformed layout boxes
        // the configured view's centring maths uses.
        contentRect: {
            x: contentRect.x,
            y: contentRect.y,
            width: contentRect.width,
            height: contentRect.height,
        },
        viewport: { x: viewport.x, y: viewport.y, width: viewport.width, height: viewport.height },
        content: { width: content.offsetWidth, height: content.offsetHeight },
        selectedRooms: selectedRoomIds(),
    };
}

visual.mount = mount;
visual.setZoom = setZoom;
visual.roomAnchor = roomAnchor;
visual.roomOutlineBox = roomOutlineBox;
visual.roomPoint = roomPoint;
visual.selectedRoomIds = selectedRoomIds;
visual.describe = describe;

window.visualHarness = visual;

defineStubElements();
customElements.whenDefined(CARD_TAG).then(async () => {
    const fixture = await loadFixtures();
    visual.states = fixture.states;
    visual.registry = fixture.registry;
    visual.hass = createHass(fixture.states, fixture.registry);
    visual.ready = true;
});
