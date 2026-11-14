import { expect, test, type Locator, type Page } from "@playwright/test";

import type { RoomConfig, XiaomiVacuumMapCardConfig } from "../../src/types/types";

/**
 * The visual scenarios for the built card plus the horizontal layout placeholder.
 *
 * The page (`index.html` + `harness.js`) mounts the card element directly against the committed
 * synthetic fixture; there is no Home Assistant frontend on the page. Baselines live in
 * `test/visual/__screenshots__/` and are generated inside the Playwright Docker image, never on
 * macOS. See playwright.config.ts.
 */

const CARD = "xiaomi-vacuum-map-card";

interface RoomDescription {
    className: string | null;
    selected: boolean;
}

interface VisualDescription {
    mapScale: number;
    mapX: number;
    mapY: number;
    realScale: number;
    mapRotation: number;
    transform: string;
    rooms: RoomDescription[];
    imageRect: { x: number; y: number; width: number; height: number };
    contentRect: { x: number; y: number; width: number; height: number };
    viewport: { x: number; y: number; width: number; height: number };
    content: { width: number; height: number };
    selectedRooms: string[];
}

interface Box {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface VisualHarness {
    ready: boolean;
    mount: (config: XiaomiVacuumMapCardConfig) => Promise<boolean>;
    setZoom: (scale: number, anchor?: { x: number; y: number }) => Promise<{ mapScale: number; realScale: number }>;
    roomAnchor: (roomId: string) => { x: number; y: number };
    roomOutlineBox: (roomId: string) => Box;
    roomPoint: (roomId: string, fractionX?: number, fractionY?: number) => { x: number; y: number };
    selectedRoomIds: () => string[];
    describe: () => VisualDescription;
}

/**
 * Room `1` ("Living room") in `test/fixtures/synthetic/map.png` pixels.
 *
 * `generate.cjs` fills pixels 100..169 × 20..69, so the detected outline runs along the edges at
 * 100..170 × 20..70; `camera.json` describes the same room in vacuum coordinates (1000..1700 ×
 * 200..700), which the fixture calibration divides by 10. Keep the three in sync if the fixture
 * changes.
 */
const LIVING_ROOM_IMAGE_RECT: Box = { x: 100, y: 20, width: 70, height: 50 };

/** Tolerance in source-image pixels: the fixture rectangle is axis-aligned integer geometry. */
const OUTLINE_TOLERANCE = 0.75;

/**
 * Tolerance in CSS pixels between the cleaning-order badge's centre and the room label's centre.
 * Both are anchored on the same x with `text-anchor: middle`, so the two boxes should share a
 * centre; what remains is glyph side bearing, which is well under a pixel for one digit.
 */
const BADGE_CENTRE_TOLERANCE = 1;

/**
 * Compares an outline box with the expected image-pixel rectangle and names the failing edge, so a
 * misalignment explains the expected geometry instead of only reporting a screenshot diff.
 */
function expectImageRect(actual: Box, expected: Box, label: string): void {
    (Object.keys(expected) as Array<keyof Box>).forEach(key => {
        expect(
            Math.abs(actual[key] - expected[key]),
            `${label} ${key} is ${actual[key].toFixed(2)} image px, expected ${expected[key]} ± ${OUTLINE_TOLERANCE}`,
        ).toBeLessThanOrEqual(OUTLINE_TOLERANCE);
    });
}

type VisualWindow = Window & { visualHarness: VisualHarness };

const pageErrors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
    const errors: string[] = [];
    pageErrors.set(page, errors);
    page.on("pageerror", error => errors.push(`pageerror: ${error.message}`));
    page.on("console", message => {
        if (message.type() === "error") errors.push(`console.error: ${message.text()}`);
    });

    await page.goto("/");
    await page.waitForFunction(() => (window as unknown as VisualWindow).visualHarness?.ready === true, undefined, {
        timeout: 15_000,
    });
});

test.afterEach(async ({ page }) => {
    expect(pageErrors.get(page) ?? []).toEqual([]);
});

function harness(page: Page): Promise<VisualDescription> {
    return page.evaluate(() => (window as unknown as VisualWindow).visualHarness.describe());
}

interface MeasuredText {
    x: number;
    y: number;
    width: number;
    height: number;
    centreX: number;
    textAnchor: string;
    stroke: string;
}

/**
 * An SVG text element's rendered box plus the computed properties that place and outline it.
 *
 * `locator.boundingBox()` is deliberately not used here: Playwright reports the text's box extended
 * by its stroke (2 px on each side for the badge outline), which would swallow the 3.7 px gap
 * between the badge and the room label and make the vertical check measure the outline instead of
 * the text.
 */
function measureText(locator: Locator): Promise<MeasuredText> {
    return locator.evaluate(element => {
        const box = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
            x: box.x,
            y: box.y,
            width: box.width,
            height: box.height,
            centreX: box.x + box.width / 2,
            textAnchor: style.textAnchor,
            stroke: style.stroke,
        };
    });
}

/** A card preset using the synthetic fixture, the Xiaomi Miio ROOM mode and no persisted view. */
function cardConfig(overrides: Partial<XiaomiVacuumMapCardConfig> = {}): XiaomiVacuumMapCardConfig {
    return {
        type: "custom:xiaomi-vacuum-map-card",
        entity: "vacuum.roborock_s7",
        map_source: { camera: "camera.vacuum_map" },
        calibration_source: { camera: true },
        vacuum_platform: "Xiaomi Miio",
        map_modes: [{ template: "vacuum_clean_segment" }],
        // Pin tiles and icons empty so these baselines cover the map overlay and the card layout
        // only. Generated tiles/icons are the generator batches' surface, not map rendering's.
        tiles: [],
        icons: [],
        // The persisted view is a dashboard feature; disabling it keeps a scenario to its config.
        persist_map_view: false,
        ...overrides,
    };
}

async function mount(page: Page, config: XiaomiVacuumMapCardConfig): Promise<void> {
    await page.evaluate(input => (window as unknown as VisualWindow).visualHarness.mount(input), config);
    await expect(page.locator(CARD)).toBeVisible();
}

async function setZoom(page: Page, scale: number, anchor?: { x: number; y: number }): Promise<void> {
    const result = await page.evaluate(
        input => (window as unknown as VisualWindow).visualHarness.setZoom(input.scale, input.anchor),
        { scale, anchor },
    );
    expect(result.mapScale).toBeCloseTo(scale, 5);
}

function overlayConfig(rotation: number): XiaomiVacuumMapCardConfig {
    return cardConfig({ map_rotation: rotation });
}

// The four overlay screenshots are the reason this suite exists: a wrong `realScale`, a transform
// applied twice to the SVG overlay, or rotation applied to only one of image/overlay shows up as a
// shifted room outline or label. One screenshot per zoom/rotation pair is cheaper to review than a
// combined grid, and each baseline diff points at exactly one case.
for (const zoom of [1, 2.5] as const) {
    for (const rotation of [0, 90] as const) {
        test(`overlay alignment at zoom ${zoom} and rotation ${rotation}`, async ({ page }) => {
            await mount(page, overlayConfig(rotation));
            if (zoom !== 1) {
                // Frame the same room at every zoom/rotation pair, so the four baselines are
                // comparable: the outline and label must stay on the room at 2.5x and at 90°.
                const anchor = await page.evaluate(() =>
                    (window as unknown as VisualWindow).visualHarness.roomAnchor("1"),
                );
                await setZoom(page, zoom, anchor);
            }

            const description = await harness(page);
            expect(description.mapRotation).toBe(rotation);
            expect(description.realScale).toBeGreaterThan(0);
            expect(description.mapScale).toBeCloseTo(zoom, 5);
            // All three synthetic rooms are drawn from detected colour regions.
            expect(description.rooms).toHaveLength(3);
            expect(description.rooms.some(room => room.selected)).toBe(false);
            expect(description.imageRect.width).toBeGreaterThan(0);
            expect(description.imageRect.height).toBeGreaterThan(0);

            // The numeric companion to the screenshot: whichever zoom/rotation is active, the
            // Living room outline must still cover its rectangle in the fixture image. The
            // screenshot catches image/overlay drift; this says which expected rectangle failed,
            // and it is pure geometry, so it does not depend on the browser build.
            const outline = await page.evaluate(() =>
                (window as unknown as VisualWindow).visualHarness.roomOutlineBox("1"),
            );
            expectImageRect(
                outline,
                LIVING_ROOM_IMAGE_RECT,
                `Living room outline (zoom ${zoom}, rotation ${rotation})`,
            );

            await expect(page.locator(CARD)).toHaveScreenshot(`overlay-zoom-${zoom}-rotation-${rotation}.png`);
        });
    }
}

/**
 * Splits a computed 2D transform matrix into the values a configured `map_view` states.
 *
 * A configured `x`/`y` is an offset from the centred view, while the computed matrix carries the
 * pinch-zoom offset of the content's top-left corner. At rotation 0 the card's transform is
 * `translate(x, y) scale(s)` with the two 50 % translates cancelling, so `a` is the scale and
 * `e`/`f` are the converted offsets. That makes the assertion independent of how the card stores
 * the view: a value that never reached the CSS custom properties reads as `none` or the wrong
 * matrix here.
 */
function computedTransform(transform: string): { a: number; b: number; scale: number; x: number; y: number } {
    const match = /^matrix\(([^)]+)\)$/.exec(transform);
    if (!match) throw new Error(`expected a computed matrix(), got "${transform}"`);
    const [a, b, , , e, f] = match[1].split(",").map(value => Number(value.trim()));
    return { a, b, scale: a, x: e, y: f };
}

/**
 * The transform offset a configured view with `x`/`y` from the centred view produces at rotation 0.
 *
 * Mirrors the card's conversion: put the content centre in the viewport centre, then add the
 * configured offset. It is written with the measured layout boxes, so it shows that the configured
 * view is centred at this card's width instead of anchored to the top-left corner.
 */
function centredOffset(description: VisualDescription, scale: number, x: number, y: number): { x: number; y: number } {
    return {
        x: description.viewport.width / 2 - (scale * description.content.width) / 2 + x,
        y: description.viewport.height / 2 - (scale * description.content.height) / 2 + y,
    };
}

// The configured default view (batch B9, issue #873). A stored view still wins, but this scenario
// has a fresh browser context and no stored view, so the card must open at `map_view`. Persistence
// is disabled on purpose: `map_view` describes where the card starts, which is independent of
// whether the user's later pan is remembered.
test("a configured map_view is the rendered starting view", async ({ page }) => {
    await mount(page, cardConfig({ map_view: { scale: 2.5, x: -60, y: -40, rotation: 0 } }));

    const description = await harness(page);
    const matrix = computedTransform(description.transform);
    const expected = centredOffset(description, 2.5, -60, -40);
    expect(matrix.scale).toBeCloseTo(2.5, 2);
    expect(matrix.x).toBeCloseTo(expected.x, 1);
    expect(matrix.y).toBeCloseTo(expected.y, 1);
    // The offsets describe a view around the map's centre, not a crop from its top-left corner:
    // the content centre is where the card's own zoom control would leave it, plus the configured
    // offset. A top-left anchored scale would fail both of these.
    expect(description.mapX).toBeCloseTo(expected.x, 5);
    expect(description.mapY).toBeCloseTo(expected.y, 5);
    // The map view state the card renders from agrees with the transform it produced.
    expect(description.mapScale).toBeCloseTo(2.5, 5);
    expect(description.mapRotation).toBe(0);

    // A visible baseline of the configured view: zoomed and offset from the neutral map.
    await expect(page.locator(CARD)).toHaveScreenshot("default-map-view.png");

    // A user zoom after mount wins and replaces the configured view, like on any other card.
    await setZoom(page, 1.25);
    const after = await harness(page);
    expect(after.mapScale).toBeCloseTo(1.25, 5);
    expect(computedTransform(after.transform).scale).toBeCloseTo(1.25, 2);
    expect(after.transform).not.toBe(description.transform);
});

// The rotation half of the configured view: rotation pivots on the content centre, so a view with
// no x/y must put that centre in the middle of the viewport. A top-left scale would leave the map
// corner at the viewport corner even at 90°.
test("a configured map_view is centred at rotation 90", async ({ page }) => {
    await mount(page, cardConfig({ map_view: { scale: 2.5, rotation: 90 } }));

    const description = await harness(page);
    expect(description.mapScale).toBeCloseTo(2.5, 5);
    expect(description.mapRotation).toBe(90);

    // A rotation matrix's linear part is `scale * [[cos, -sin], [sin, cos]]`, so its magnitude is
    // the scale whatever the angle (the CSS rotation makes `a` ~ 0 and `b` ~ 2.5 here).
    const matrix = computedTransform(description.transform);
    expect(Math.hypot(matrix.a, matrix.b)).toBeCloseTo(2.5, 2);

    const contentCentre = {
        x: description.contentRect.x + description.contentRect.width / 2,
        y: description.contentRect.y + description.contentRect.height / 2,
    };
    const viewportCentre = {
        x: description.viewport.x + description.viewport.width / 2,
        y: description.viewport.y + description.viewport.height / 2,
    };
    expect(Math.abs(contentCentre.x - viewportCentre.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(contentCentre.y - viewportCentre.y)).toBeLessThanOrEqual(1);

    // The overlays ride the same transform as the image: the room outline still describes its
    // rectangle in the fixture image at this angle and scale.
    const outline = await page.evaluate(() => (window as unknown as VisualWindow).visualHarness.roomOutlineBox("1"));
    expectImageRect(outline, LIVING_ROOM_IMAGE_RECT, "Living room outline (configured view, rotation 90)");
});

// The roadmap promise: a user's pan/zoom still beats the configured default. This has to hold in a
// browser too, where the stored entry is written by the real transform and read back after a
// remount, not only through the happy-dom harness.
test("a stored view beats the configured default after a remount", async ({ page }) => {
    const config = cardConfig({
        map_view: { scale: 2.5, x: 40, y: -20, rotation: 0 },
        persist_map_view: true,
    });
    await mount(page, config);
    const initial = await harness(page);
    expect(initial.mapScale).toBeCloseTo(2.5, 5);

    // Pan and zoom away from the configured view, then wait for the debounced write. The harness
    // is not part of the app, so poll the card's own store key instead of sleeping a fixed time.
    await setZoom(page, 1.5, { x: 0.3, y: 0.6 });
    const panned = await harness(page);
    const storedEntryCount = (): Promise<number> =>
        page.evaluate(
            () =>
                Object.keys(
                    JSON.parse(window.localStorage.getItem("xiaomi-vacuum-map-card.map-view") ?? "{}"),
                ).length,
        );
    await expect.poll(storedEntryCount).toBeGreaterThan(0);

    // Remounting with the same config re-reads the same card/preset/map/default key: the stored
    // gesture wins over `map_view`, which is where the card starts only when nothing is stored.
    await mount(page, config);
    const reloaded = await harness(page);
    expect(reloaded.mapScale).toBeCloseTo(1.5, 5);
    expect(reloaded.mapX).toBeCloseTo(panned.mapX, 3);
    expect(reloaded.mapY).toBeCloseTo(panned.mapY, 3);
});

test("room hit-testing selects the clicked room at zoom 1", async ({ page }) => {
    await mount(page, overlayConfig(0));

    const description = await harness(page);
    expect(description.selectedRooms).toEqual([]);

    // Off-centre inside the room, on the flat colour: these rooms are detected from the map colours
    // and carry no icon, so the click reaches the image-colour hit test rather than a `.clickable`
    // element. The centre holds the room label and, once selected, the badge drawn above it; aim
    // away from them so the assertion cannot accidentally turn into a test of text hit-testing.
    const point = await page.evaluate(() =>
        (window as unknown as VisualWindow).visualHarness.roomPoint("1", 0.25, 0.5),
    );
    await page.mouse.click(point.x, point.y);

    await expect.poll(() => page.evaluate(() => (window as unknown as VisualWindow).visualHarness.selectedRoomIds())).toEqual([
        "1",
    ]);
    await expect(page.locator(`${CARD} .room-1-wrapper.selected`)).toHaveCount(1);
    await expect(page.locator(`${CARD} .room-0-wrapper.selected`)).toHaveCount(0);
    await expect(page.locator(`${CARD} .room-2-wrapper.selected`)).toHaveCount(0);

    // The selected room shows its cleaning order above its label. These rooms come from the colour
    // detection, carry no icon, and so take the fork's badge path rather than upstream's icon slot;
    // that path only exists in Chromium, which is why it is asserted here and not in Vitest. The
    // unselected rooms must stay unnumbered, so this is not merely "a badge was rendered".
    await expect(page.locator(`${CARD} .room-1-wrapper text.room-order`)).toHaveText("1");
    await expect(page.locator(`${CARD} .room-0-wrapper .room-order`)).toHaveCount(0);

    // The screenshot is not the gate for the badge: at 400 x 398 px the configured 0.001
    // maxDiffPixelRatio tolerates 159 differing pixels, while a missing or shifted badge changes
    // only about 104 of them. These boxes are the gate - the badge must stay centred over the label
    // and above it - and the screenshot covers the surrounding frame.
    const badge = page.locator(`${CARD} .room-1-wrapper text.room-order`);
    const label = page.locator(`${CARD} .room-1-wrapper text.room-label`);
    const badgeBox = await measureText(badge);
    const labelBox = await measureText(label);

    const centreGap = Math.abs(badgeBox.centreX - labelBox.centreX);
    expect(
        centreGap,
        `badge centre x ${badgeBox.centreX.toFixed(2)} px is ${centreGap.toFixed(
            2,
        )} px from the room label centre x ${labelBox.centreX.toFixed(
            2,
        )} px, expected within ${BADGE_CENTRE_TOLERANCE} px`,
    ).toBeLessThanOrEqual(BADGE_CENTRE_TOLERANCE);

    const badgeBottom = badgeBox.y + badgeBox.height;
    expect(
        badgeBottom,
        `badge bottom ${badgeBottom.toFixed(2)} px is not above the room label top ${labelBox.y.toFixed(2)} px`,
    ).toBeLessThanOrEqual(labelBox.y);

    // The styles those boxes depend on. A start-anchored badge is exactly what round 1 found (the
    // text sat several pixels right of the room centre), and without the label-style stroke the
    // number drops to about 2:1 contrast on the room fill. The computed values are asserted
    // separately from the boxes so each defect names itself.
    expect(badgeBox.textAnchor).toBe("middle");
    expect(badgeBox.stroke).not.toBe("none");

    await expect(page.locator(CARD)).toHaveScreenshot("room-hit-test.png");
});

/**
 * A configured room whose id vanished from the camera metadata after a re-map, drawn from its
 * stored outline on top of the live room with the same geometry (the id shift B8 exists for).
 *
 * Room 9 is not in `camera.json`'s `rooms`, so it is stale: the card keeps its outline as a warning
 * but must not let it become a click target. It covers room 1 completely and its configured icon
 * sits on room 1's centre, which is exactly where the first council round found both the polygon
 * and the icon swallowing the click.
 */
const STALE_ROOM_OVER_LIVE_ONE: RoomConfig = {
    id: "9",
    label: { text: "Old living room", x: 1350, y: 450, offset_y: 35 },
    icon: { name: "mdi:broom", x: 1350, y: 450 },
    outline: [
        [1000, 200],
        [1700, 200],
        [1700, 700],
        [1000, 700],
    ],
};

function staleRoomConfig(): XiaomiVacuumMapCardConfig {
    return cardConfig({
        map_modes: [{ template: "vacuum_clean_segment", predefined_selections: [STALE_ROOM_OVER_LIVE_ONE] }],
    });
}

function selectedIds(page: Page): Promise<string[]> {
    return page.evaluate(() => (window as unknown as VisualWindow).visualHarness.selectedRoomIds());
}

async function clickRoomPoint(page: Page, roomId: string, fractionX: number, fractionY: number): Promise<void> {
    const point = await page.evaluate(
        input =>
            (window as unknown as VisualWindow).visualHarness.roomPoint(input.roomId, input.fractionX, input.fractionY),
        { roomId, fractionX, fractionY },
    );
    await page.mouse.click(point.x, point.y);
}

test("a stale room's icon does not block the live room it overlaps", async ({ page }) => {
    await mount(page, staleRoomConfig());

    // The stale room is drawn from its stored outline and marked; the live room underneath it is
    // still rendered.
    await expect(page.locator(`${CARD} .room-9-wrapper.room-stale`)).toHaveCount(1);
    await expect(page.locator(`${CARD} .room-9-wrapper text.room-stale-marker`)).toHaveText("!");
    await expect(page.locator(`${CARD} .room-1-wrapper`)).toHaveCount(1);
    await expect(page.locator(`${CARD} .room-9-wrapper.selected`)).toHaveCount(0);

    // The centre of the live room is where the stale room's configured icon sits. Colour detection
    // is running in this browser, so a click here also has to reach the image-colour hit test.
    await clickRoomPoint(page, "1", 0.5, 0.5);
    await expect.poll(() => selectedIds(page)).toEqual(["1"]);
    await expect(page.locator(`${CARD} .room-1-wrapper.selected`)).toHaveCount(1);

    // The stale outline and the icon are pointer-transparent, and the icon is not a `.clickable`
    // element: either one alone was enough to swallow the click in the first review round.
    expect(
        await page
            .locator(`${CARD} .room-9-wrapper`)
            .evaluate(element => getComputedStyle(element).pointerEvents),
    ).toBe("none");
    expect(
        await page
            .locator(`${CARD} .room-9-wrapper .map-icon-wrapper`)
            .evaluate(element => getComputedStyle(element).pointerEvents),
    ).toBe("none");
    await expect(page.locator(`${CARD} .room-9-wrapper .clickable`)).toHaveCount(0);

    await expect(page.locator(CARD)).toHaveScreenshot("stale-room-hit-test.png");
});

test("a stale room's fill does not block a live room when colour detection is unavailable", async ({ page }) => {
    // Camera images can be unreadable (a cross-origin camera taints the canvas and `detect`
    // returns undefined). Then the live rooms are clickable SVG polygons, and a stale outline drawn
    // over one of them would intercept the pointer before its click handler runs.
    await page.evaluate(() => {
        const prototype = CanvasRenderingContext2D.prototype as unknown as {
            getImageData: (...args: unknown[]) => unknown;
        };
        prototype.getImageData = () => {
            throw new Error("colour detection disabled for this scenario");
        };
    });
    await mount(page, staleRoomConfig());

    await expect(page.locator(`${CARD} .room-9-wrapper.room-stale`)).toHaveCount(1);
    await expect(page.locator(`${CARD} .room-1-wrapper .room-outline.clickable`)).toHaveCount(1);

    // Off-centre, away from the label and the stale icon: the stale polygon covers this point.
    await clickRoomPoint(page, "1", 0.25, 0.5);
    await expect.poll(() => selectedIds(page)).toEqual(["1"]);
    await expect(page.locator(`${CARD} .room-1-wrapper.selected`)).toHaveCount(1);
});

test("default vertical layout", async ({ page }) => {
    const second: XiaomiVacuumMapCardConfig = {
        ...cardConfig(),
        preset_name: "Second",
        map_rotation: 0,
    };
    await mount(
        page,
        cardConfig({
            title: "Vacuum map",
            preset_name: "Default",
            additional_presets: [second],
        }),
    );

    await expect(page.locator(`${CARD} .card-header`)).toHaveText("Vacuum map");
    await expect(page.locator(`${CARD} .preset-indicator`)).toHaveText("●○");
    await expect(page.locator(`${CARD} xvmc-preset-selector`)).toBeVisible();
    await expect(page.locator(`${CARD} #map-zoomer`)).toBeVisible();

    const description = await harness(page);
    expect(description.rooms).toHaveLength(3);
    // Vertical layout: the map sits above the mode controls.
    const mapBox = await page.locator(`${CARD} #map-zoomer`).boundingBox();
    const controlsBox = await page.locator(`${CARD} .map-controls`).boundingBox();
    expect(mapBox).not.toBeNull();
    expect(controlsBox).not.toBeNull();
    expect(controlsBox!.y).toBeGreaterThanOrEqual(mapBox!.y + mapBox!.height);

    await expect(page.locator(CARD)).toHaveScreenshot("layout-vertical.png");
});

// Batch B10: the horizontal arrangement at three widths, plus the geometry and resize checks.
// The vertical screenshot above stays at the default 400 px harness width and must not change.

/** Wraps a tile list long enough to overflow the controls column at the narrowest width. */
const HORIZONTAL_TILES = Array.from({ length: 8 }, (_, index) => ({
    tile_id: `b10-tile-${index}`,
    entity: "sensor.roborock_s7_battery",
    label: `Tile ${index}`,
}));

function horizontalConfig(overrides: Partial<XiaomiVacuumMapCardConfig> = {}): XiaomiVacuumMapCardConfig {
    return cardConfig({
        layout: "horizontal",
        title: "Vacuum map",
        // More than one mode renders the dropdown; the map-action buttons and the long tile list
        // then exercise wrapping and scrolling in the clamped controls column.
        map_modes: [
            { template: "vacuum_clean_segment" },
            { template: "vacuum_clean_zone" },
            { template: "vacuum_goto" },
        ],
        icons: [
            { icon: "mdi:robot-vacuum" },
            { icon: "mdi:battery" },
            { icon: "mdi:map-marker" },
            { icon: "mdi:cog" },
        ],
        tiles: HORIZONTAL_TILES,
        ...overrides,
    });
}

const HORIZONTAL_WIDTHS = [400, 800, 1200] as const;

/**
 * Sets the harness card container to `width` CSS px and gives the page enough viewport to render it.
 *
 * `#card-root` is fixed at 400 px in `index.html`, so the viewport alone does not change the card
 * width. The vertical baseline keeps that default; only the horizontal scenarios resize the root.
 */
async function setContainerWidth(page: Page, width: number): Promise<void> {
    await page.setViewportSize({ width: Math.max(800, width + 40), height: 900 });
    await page.evaluate(cardWidth => {
        const root = document.getElementById("card-root");
        if (root) root.style.width = `${cardWidth}px`;
    }, width);
}

/** Lets the browser re-layout and paint after a viewport or container change. */
function nextLayout(page: Page): Promise<void> {
    return page.evaluate(
        () =>
            new Promise<void>(resolve =>
                requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
            ),
    );
}

interface LayoutBoxes {
    card: Box;
    map: Box;
    controls: Box;
}

async function layoutBoxes(page: Page): Promise<LayoutBoxes> {
    const card = await page.locator(CARD).boundingBox();
    const map = await page.locator(`${CARD} #map-zoomer`).boundingBox();
    const controls = await page.locator(`${CARD} .controls-wrapper`).boundingBox();
    expect(card, "the card has a layout box").not.toBeNull();
    expect(map, "the map has a layout box").not.toBeNull();
    expect(controls, "the controls have a layout box").not.toBeNull();
    return { card: card!, map: map!, controls: controls! };
}

/** The geometry every horizontal scenario must show: map left, controls right, same row. */
function expectSideBySide(boxes: LayoutBoxes, label: string): void {
    // Adjacent columns: the controls start at (or after) the map's right edge. One pixel absorbs
    // sub-pixel grid rounding.
    expect(
        boxes.controls.x,
        `${label}: controls x ${boxes.controls.x.toFixed(2)} must be at or after the map right edge ${(
            boxes.map.x + boxes.map.width
        ).toFixed(2)}`,
    ).toBeGreaterThanOrEqual(boxes.map.x + boxes.map.width - 1);
    // Same row, not stacked: the boxes overlap vertically.
    const overlap =
        Math.min(boxes.map.y + boxes.map.height, boxes.controls.y + boxes.controls.height) -
        Math.max(boxes.map.y, boxes.controls.y);
    expect(overlap, `${label}: map and controls must share vertical space`).toBeGreaterThan(0);
    // Both stay inside the card box horizontally.
    expect(boxes.map.x, `${label}: map must not start left of the card`).toBeGreaterThanOrEqual(boxes.card.x - 1);
    expect(
        boxes.controls.x + boxes.controls.width,
        `${label}: controls must not extend past the card`,
    ).toBeLessThanOrEqual(boxes.card.x + boxes.card.width + 1);
}

/**
 * The largest screen-space gap between the Living room outline and where the fixture's 100..170 x
 * 20..70 image rectangle should land after the image is CSS-scaled to its current box.
 *
 * Unlike `roomOutlineBox()`, this does not divide by the card's `realScale`: a stale scale is
 * exactly what it has to catch after the container is resized.
 */
async function livingRoomAlignmentError(page: Page): Promise<number> {
    return page.evaluate(() => {
        const card = document.querySelector("xiaomi-vacuum-map-card") as unknown as {
            shadowRoot: ShadowRoot;
        };
        const image = card.shadowRoot.getElementById("map-image") as HTMLElement;
        const polygon = card.shadowRoot.querySelector(".room-1-wrapper polygon") as SVGGraphicsElement;
        const imageBox = image.getBoundingClientRect();
        const outline = polygon.getBoundingClientRect();
        const expected = {
            x: imageBox.x + imageBox.width * (100 / 200),
            y: imageBox.y + imageBox.height * (20 / 150),
            width: imageBox.width * (70 / 200),
            height: imageBox.height * (50 / 150),
        };
        return Math.max(
            Math.abs(outline.x - expected.x),
            Math.abs(outline.y - expected.y),
            Math.abs(outline.width - expected.width),
            Math.abs(outline.height - expected.height),
        );
    });
}

// A real DOM layout check at two widths: vertical stacks, horizontal sits side by side. Kept
// screenshot-free so it does not create a second vertical baseline to maintain.
test("layout geometry at 400 and 800 px", async ({ page }) => {
    for (const width of [400, 800] as const) {
        await setContainerWidth(page, width);
        await mount(page, cardConfig({ title: "Vertical" }));
        const vertical = await layoutBoxes(page);
        expect(
            vertical.controls.y,
            `vertical at ${width}px: controls must start below the map`,
        ).toBeGreaterThanOrEqual(vertical.map.y + vertical.map.height - 1);
        expect(
            vertical.controls.y,
            `vertical at ${width}px: controls must not overlap the map`,
        ).toBeGreaterThanOrEqual(vertical.map.y);

        await mount(page, horizontalConfig());
        expectSideBySide(await layoutBoxes(page), `horizontal at ${width}px`);
    }
});

for (const width of HORIZONTAL_WIDTHS) {
    test(`horizontal layout at ${width} px`, async ({ page }) => {
        await setContainerWidth(page, width);
        await mount(page, horizontalConfig());

        const boxes = await layoutBoxes(page);
        expectSideBySide(boxes, `horizontal at ${width}px`);
        // The map keeps a usable size at every width: the clamped controls column never squeezes
        // it out, and the whole card stays inside the page.
        expect(boxes.map.width).toBeGreaterThan(120);
        const pageOverflow = await page.evaluate(
            () => document.documentElement.scrollWidth - window.innerWidth,
        );
        expect(pageOverflow, `horizontal at ${width}px must not overflow the page`).toBeLessThanOrEqual(1);

        const controlsMetrics = await page.locator(`${CARD} .controls-wrapper`).evaluate(element => ({
            clientHeight: element.clientHeight,
            scrollHeight: element.scrollHeight,
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
        }));
        // The controls never set the row height and never overflow sideways: they either fit or
        // scroll vertically inside the column.
        expect(controlsMetrics.scrollWidth).toBeLessThanOrEqual(controlsMetrics.clientWidth + 1);
        expect(boxes.controls.height).toBeLessThanOrEqual(boxes.map.height + 1);
        if (width === 400) {
            // Eight tiles cannot fit in a 150 px-wide column beside a 165 px-tall map: scrolling
            // there is the accepted escape hatch, and it must actually be available.
            expect(controlsMetrics.scrollHeight).toBeGreaterThan(controlsMetrics.clientHeight);
        }

        await expect(page.locator(CARD)).toHaveScreenshot(`layout-horizontal-${width}.png`);
    });
}

test("horizontal layout adapts when the container is resized", async ({ page }) => {
    await setContainerWidth(page, 400);
    await mount(page, horizontalConfig());
    const before = await layoutBoxes(page);

    await setContainerWidth(page, 1200);
    await nextLayout(page);
    const after = await layoutBoxes(page);

    // Geometry, not only a screenshot: the map grew into the wider card and the controls moved
    // right with it, while staying side by side and inside the card.
    expect(after.map.width, "the map grows with the card").toBeGreaterThan(before.map.width + 100);
    expect(after.card.width, "the card grows with its container").toBeGreaterThan(before.card.width + 100);
    expect(after.controls.x, "the controls move right with the wider map").toBeGreaterThan(before.controls.x);
    expectSideBySide(after, "after resizing to 1200px");
    // The overlays ride the resized image: a stale `realScale` would leave the room outline at the
    // old width while the image stretches. The observer recalculates it asynchronously.
    await expect.poll(() => livingRoomAlignmentError(page)).toBeLessThanOrEqual(1.5);

    // Shrinking back must restore the narrow arrangement rather than leaving a stale column width.
    await setContainerWidth(page, 400);
    await nextLayout(page);
    const back = await layoutBoxes(page);
    expect(back.map.width).toBeCloseTo(before.map.width, 0);
    expectSideBySide(back, "after resizing back to 400px");
    await expect.poll(() => livingRoomAlignmentError(page)).toBeLessThanOrEqual(1.5);
});

test("a sections-view grid cell makes the card fill its height and scroll", async ({ page }) => {
    await page.setViewportSize({ width: 840, height: 900 });
    await page.evaluate(() => {
        const root = document.getElementById("card-root");
        if (!root) return;
        root.style.width = "800px";
        // What the sections grid gives a card with numeric rows: a definite height on the cell.
        root.style.height = "300px";
        root.style.overflow = "hidden";
    });
    await mount(page, horizontalConfig());
    // hui-card assigns this property after creating the element, exactly as in the sections view.
    await page.evaluate(() => {
        const card = document.querySelector("xiaomi-vacuum-map-card") as unknown as { layout?: string };
        if (card) card.layout = "grid";
    });
    await expect(page.locator(CARD)).toHaveAttribute("layout", "grid");
    await nextLayout(page);

    const metrics = await page.locator(CARD).evaluate(element => {
        const card = element as HTMLElement;
        const haCard = card.shadowRoot?.querySelector("ha-card") as HTMLElement;
        return {
            hostHeight: card.getBoundingClientRect().height,
            cardHeight: haCard.clientHeight,
            scrollHeight: haCard.scrollHeight,
        };
    });
    expect(metrics.hostHeight).toBeCloseTo(300, 0);
    expect(metrics.cardHeight).toBeCloseTo(300, 0);
    // The horizontal content is taller than 300 px at this width, so the card scrolls internally
    // instead of letting content spill into the next grid row.
    expect(metrics.scrollHeight).toBeGreaterThan(metrics.cardHeight);
});

test("horizontal layout keeps room, mode and tile interactions", async ({ page }) => {
    await setContainerWidth(page, 800);
    await mount(page, horizontalConfig());

    // The controls live in the second column, and the room hit test still reaches the map.
    expect(await page.locator(`${CARD} .controls-column xvmc-tile`).count()).toBe(8);
    await expect(page.locator(`${CARD} xvmc-dropdown-menu .dropdown-menu-button`)).toBeVisible();
    const point = await page.evaluate(() =>
        (window as unknown as VisualWindow).visualHarness.roomPoint("1", 0.25, 0.5),
    );
    await page.mouse.click(point.x, point.y);
    await expect.poll(() => page.evaluate(() => (window as unknown as VisualWindow).visualHarness.selectedRoomIds())).toEqual([
        "1",
    ]);
    await expect(page.locator(`${CARD} .room-1-wrapper.selected`)).toHaveCount(1);

    // Clicking a tile still runs its action path without an error (the page-error check in
    // afterEach is the gate).
    await page.locator(`${CARD} .controls-column xvmc-tile`).first().click();

    // Focus order follows DOM order, which the layout does not reorder: the map and its controls
    // come before the controls column. The card has no tabbable controls in either layout today, so
    // this asserts the order a future keyboard implementation must preserve.
    const order = await page.evaluate(() => {
        const card = document.querySelector("xiaomi-vacuum-map-card");
        const map = card?.shadowRoot?.querySelector(".map-wrapper");
        const controls = card?.shadowRoot?.querySelector(".controls-column");
        if (!map || !controls) return null;
        return {
            mapBeforeControls: (map.compareDocumentPosition(controls) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
            mapTabIndex: map.getAttribute("tabindex"),
        };
    });
    expect(order).toEqual({ mapBeforeControls: true, mapTabIndex: null });
});

