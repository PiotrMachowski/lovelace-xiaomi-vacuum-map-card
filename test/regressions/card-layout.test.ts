import { describe, expect, it } from "vitest";

import { validateConfig } from "../../src/config-validators";
import { XiaomiVacuumMapCard } from "../../src/xiaomi-vacuum-map-card";
import type { XiaomiVacuumMapCardConfig } from "../../src/types/types";
import { fixtureConfig, fixtureHass, loadSyntheticFixture, mountCard } from "../harness";
import type { CardHandle } from "../harness";

/**
 * The card's layout contract (batch B10).
 *
 * happy-dom has no layout engine: `getBoundingClientRect()` is all zeroes, so these tests assert
 * the DOM/CSS arrangement contract and the grid-options table. The real bounding boxes - including
 * the same arrangement at several widths and after a container resize - are asserted in
 * `test/visual/visual.spec.ts`, where Chromium actually lays the card out.
 */

const HORIZONTAL = ".layout-content.horizontal";

function cardConfig(overrides: Partial<XiaomiVacuumMapCardConfig> = {}): XiaomiVacuumMapCardConfig {
    return {
        ...fixtureConfig(loadSyntheticFixture()),
        // Two modes give the card a real controls block to place below/beside the map.
        map_modes: [{ template: "vacuum_clean_segment" }, { template: "vacuum_clean_zone" }],
        tiles: [],
        icons: [],
        ...overrides,
    };
}

async function mount(overrides: Partial<XiaomiVacuumMapCardConfig> = {}): Promise<CardHandle> {
    const card = await mountCard(cardConfig(overrides), fixtureHass(loadSyntheticFixture()));
    await card.fireMapLoad();
    return card;
}

function follows(first: Element, second: Element): boolean {
    return (first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
}

describe("layout: vertical (default)", () => {
    it("renders the map above the controls and keeps the upstream wrapper-free DOM", async () => {
        const card = await mount();

        expect(card.shadowRoot.querySelector(HORIZONTAL)).toBeNull();

        const map = card.shadowRoot.querySelector(".map-wrapper");
        const controls = card.shadowRoot.querySelector(".controls-wrapper");
        expect(map).not.toBeNull();
        expect(controls).not.toBeNull();
        // Vertical means the map comes first in flow and the controls follow it, exactly as before
        // B10: there is no extra layout wrapper around them.
        expect(follows(map as Element, controls as Element)).toBe(true);
        expect(map?.parentElement?.tagName.toLowerCase()).toBe("ha-card");
        expect(controls?.parentElement?.tagName.toLowerCase()).toBe("ha-card");

        await card.cleanup();
    });

    it("is the layout an unknown or missing option resolves to without crashing", async () => {
        const invalid = await mountCard(
            cardConfig({ layout: "diagonal" as XiaomiVacuumMapCardConfig["layout"] }),
            fixtureHass(loadSyntheticFixture()),
        );
        // Validation turns the typo into an error card; no layout code runs and nothing throws.
        expect(invalid.shadowRoot.querySelector("pre")?.textContent).toContain(
            "Invalid layout: diagonal",
        );
        expect(invalid.shadowRoot.querySelector(HORIZONTAL)).toBeNull();
        await invalid.cleanup();

        const missing = await mount({ layout: undefined });
        expect(missing.shadowRoot.querySelector(HORIZONTAL)).toBeNull();
        await missing.cleanup();
    });
});

describe("layout: horizontal", () => {
    it("puts the map and controls in a two-column grid at 400 and 800 px containers", async () => {
        for (const width of [400, 800]) {
            const container = document.createElement("div");
            container.style.width = `${width}px`;
            document.body.appendChild(container);
            const card = await mountCard(cardConfig({ layout: "horizontal" }), fixtureHass(loadSyntheticFixture()), {
                container,
            });
            await card.fireMapLoad();

            const wrapper = card.shadowRoot.querySelector(HORIZONTAL);
            expect(wrapper, `horizontal wrapper at ${width}px`).not.toBeNull();

            const map = wrapper?.querySelector(".map-wrapper");
            const column = wrapper?.querySelector(".controls-column");
            const controls = column?.querySelector(".controls-wrapper");
            expect(map, `map at ${width}px`).not.toBeNull();
            expect(column, `controls column at ${width}px`).not.toBeNull();
            expect(controls, `controls at ${width}px`).not.toBeNull();

            // Side by side: map in grid column 1, controls in grid column 2, same row. The CSS
            // assertions are the part happy-dom can check; Chromium checks the rendered boxes.
            expect(map?.getAttribute("class")).toContain("map-wrapper");
            expect(follows(map as Element, column as Element)).toBe(true);
            const wrapperStyle = getComputedStyle(wrapper as Element);
            expect(wrapperStyle.display).toBe("grid");
            expect(wrapperStyle.gridTemplateColumns).toMatch(/1fr/);
            expect(wrapperStyle.gridTemplateColumns).toMatch(/clamp\(180px, 38%, 360px\)/);

            await card.cleanup();
            container.remove();
        }
    });

    it("omits the horizontal wrapper when there are no controls", async () => {
        // A `layout: horizontal` card with no controls has nothing to place beside the map; it must
        // still render the map normally instead of an empty second column.
        const card = await mount({ layout: "horizontal", map_modes: [] });
        expect(card.shadowRoot.querySelector(HORIZONTAL)).toBeNull();
        expect(card.shadowRoot.querySelector(".map-wrapper")).not.toBeNull();
        await card.cleanup();
    });
});

describe("getGridOptions", () => {
    it("returns no numeric rows for the vertical layout, so the cell fits the content", () => {
        const vertical = XiaomiVacuumMapCard.getGridOptions();

        // HA's default grid size is `{columns: 12, rows: "auto"}`. A numeric `rows` would replace the
        // content-sized cell with a fixed, too-short one and a `max_rows` would cap a user override.
        expect(vertical.columns).toBe(12);
        expect(vertical.rows).toBeUndefined();
        expect(vertical.min_rows).toBeUndefined();
        expect(vertical.max_rows).toBeUndefined();
    });

    it("returns a valid sections-view table for both layouts and differs in min_columns", () => {
        const vertical = XiaomiVacuumMapCard.getGridOptions();
        const horizontal = XiaomiVacuumMapCard.getGridOptions("horizontal");

        expect(vertical).toEqual({ columns: 12 });
        // Horizontal is a new arrangement: numeric rows are its default, but no max_rows may cap
        // the user's own height. 9 columns is the "three quarters of a section" minimum.
        expect(horizontal).toEqual({ columns: 12, rows: 6, min_columns: 9, min_rows: 3 });

        for (const options of [vertical, horizontal]) {
            expect((options.columns as number) % 3).toBe(0);
            expect(options.min_columns ?? 1).toBeLessThanOrEqual(options.columns as number);
        }
        // HA clamps with these pairs; a table where the default sits outside its own range would
        // silently open at the clamped size instead.
        expect(horizontal.min_rows!).toBeLessThanOrEqual(horizontal.rows as number);
        // Horizontal is the width-hungry arrangement: it must not be resized as narrow as vertical.
        expect(horizontal.min_columns!).toBeGreaterThan(vertical.min_columns ?? 1);
    });

    it("uses the configured layout on the element, as hui-card reads it", async () => {
        const vertical = await mount();
        expect(vertical.element.getGridOptions()).toEqual(XiaomiVacuumMapCard.getGridOptions());
        await vertical.cleanup();

        const horizontal = await mount({ layout: "horizontal" });
        expect(horizontal.element.getGridOptions()).toEqual(XiaomiVacuumMapCard.getGridOptions("horizontal"));
        await horizontal.cleanup();
    });
});

describe("layout validation", () => {
    it("accepts both layouts and reports an unknown value instead of treating it as vertical", () => {
        expect(validateConfig(cardConfig({ layout: "vertical" }))).toEqual([]);
        expect(validateConfig(cardConfig({ layout: "horizontal" }))).toEqual([]);

        const errors = validateConfig(cardConfig({ layout: "diagonal" as XiaomiVacuumMapCardConfig["layout"] }));
        expect(errors).toContain('Invalid layout: diagonal. Use "vertical" or "horizontal"');
    });
});
