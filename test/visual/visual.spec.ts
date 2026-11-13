import { expect, test, type Page } from "@playwright/test";

import type { XiaomiVacuumMapCardConfig } from "../../src/types/types";

/**
 * Five visual scenarios for the built card plus the horizontal layout placeholder.
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
    realScale: number;
    mapRotation: number;
    rooms: RoomDescription[];
    imageRect: { x: number; y: number; width: number; height: number };
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

test("room hit-testing selects the clicked room at zoom 1", async ({ page }) => {
    await mount(page, overlayConfig(0));

    const description = await harness(page);
    expect(description.selectedRooms).toEqual([]);

    // Off-centre inside the room: the centre is covered by the room icon, which is its own
    // click target. Clicking the flat colour exercises the image-colour hit test instead.
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

    await expect(page.locator(CARD)).toHaveScreenshot("room-hit-test.png");
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

// Batch B10 (horizontal layout) has not landed, so there is no horizontal arrangement to render
// and no configuration key to drive it. Keep the placeholder skipped: it documents the missing
// scenario without turning an unimplemented feature into a passing screenshot.
test.skip("horizontal layout once B10 exists", async () => {
    // When B10 lands: mount the card with its horizontal layout option, assert the map and the
    // controls sit side by side, and add a `layout-horizontal.png` baseline with the same options.
});
