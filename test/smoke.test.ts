import { readFileSync } from "node:fs";

import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";

import {
    fixtureConfig,
    fixtureHass,
    loadOwnSetupFixture,
    loadSyntheticFixture,
    mountCard,
    mountEditor,
    ownSetupMissingFiles,
    selectPreset,
    useHarnessClock,
} from "./harness";

describe("card renders from the synthetic fixture", () => {
    it("mounts the card with a map source and a valid calibration", async () => {
        useHarnessClock();
        const fixture = loadSyntheticFixture();
        const card = await mountCard(fixtureConfig(fixture), fixtureHass(fixture));

        expect(card.shadowRoot.querySelector("ha-card")).not.toBeNull();
        expect(card.element._getCurrentPreset().entity).toBe("vacuum.roborock_s7");

        const mapImage = card.shadowRoot.getElementById("map-image-source") as HTMLImageElement | null;
        expect(mapImage).not.toBeNull();
        expect(mapImage?.getAttribute("src")).toContain("/api/camera_proxy/camera.vacuum_map");
        expect(mapImage?.getAttribute("src")).toMatch(/&v=\d+$/);
        expect(card.shadowRoot.getElementById("map-image")).not.toBeNull();
        expect(card.shadowRoot.getElementById("map-zoomer")).not.toBeNull();

        await card.fireMapLoad();
        expect(card.shadowRoot.getElementById("svg-wrapper")).not.toBeNull();
    });

    it("switches presets through the rendered selector", async () => {
        useHarnessClock();
        const fixture = loadSyntheticFixture();
        const baseConfig = fixtureConfig(fixture);
        const card = await mountCard(
            {
                ...baseConfig,
                preset_name: "Default",
                additional_presets: [{ ...baseConfig, preset_name: "Second" }],
            },
            fixtureHass(fixture),
        );

        expect(card.shadowRoot.querySelector(".preset-indicator")?.textContent?.trim()).toBe("●○");
        await selectPreset(card, 1);
        expect(card.shadowRoot.querySelector(".preset-indicator")?.textContent?.trim()).toBe("○●");
    });

    it("falls back to the disconnected image after the disconnection timeout", async () => {
        const clock = useHarnessClock();
        const fixture = loadSyntheticFixture();
        const card = await mountCard(fixtureConfig(fixture), fixtureHass(fixture));
        const mapImage = () => card.shadowRoot.getElementById("map-image-source") as HTMLImageElement;

        expect(mapImage().getAttribute("src")).toContain("/api/camera_proxy/camera.vacuum_map");

        // _getMapSrc compares Date against lastHassUpdate + DISCONNECTION_TIME (360 s).
        await clock.advance(361000);
        card.element.requestUpdate();
        await card.element.updateComplete;

        expect(mapImage().getAttribute("src")).not.toContain("/api/camera_proxy");
        expect(mapImage().getAttribute("src")).toContain("data:image/png;base64,");
    });
});

describe("harness clock", () => {
    it("controls document.hidden and fires visibilitychange", async () => {
        const clock = useHarnessClock();
        let changes = 0;
        document.addEventListener("visibilitychange", () => changes++);

        await clock.setDocumentHidden(true);

        expect(document.hidden).toBe(true);
        expect(changes).toBe(1);
    });
});

describe("editor renders", () => {
    it("mounts the editor form", async () => {
        useHarnessClock();
        const fixture = loadSyntheticFixture();
        const editor = await mountEditor(fixtureConfig(fixture), fixtureHass(fixture));

        expect(editor.shadowRoot.querySelector(".card-config")).not.toBeNull();
        expect(editor.shadowRoot.querySelectorAll("ha-select").length).toBeGreaterThanOrEqual(3);
        expect(editor.shadowRoot.querySelectorAll("ha-textfield").length).toBeGreaterThanOrEqual(2);
        const buttons = Array.from(editor.shadowRoot.querySelectorAll("ha-button")).map(
            button => button.textContent ?? "",
        );
        expect(buttons.join(" ")).toContain("Generate rooms config");
        const loadCardHelpers = (window as unknown as { loadCardHelpers: () => unknown }).loadCardHelpers;
        expect(loadCardHelpers).toHaveBeenCalled();
    });
});

// Batch P0d is a manual capture on the real Home Assistant instance; until it lands the fixture
// directory only has README.md. The skip is announced so it cannot be mistaken for coverage.
const ownSetupMissing = ownSetupMissingFiles();
if (ownSetupMissing.length > 0) {
    console.warn(
        `[own-setup] Skipping the real-instance smoke test: missing ${ownSetupMissing.join(", ")} ` +
            "in test/fixtures/own-setup/. Batch P0d (manual user capture) fills these in; " +
            "see test/fixtures/own-setup/README.md.",
    );
}

describe("card renders from the real-instance fixture", () => {
    it.skipIf(ownSetupMissing.length > 0)("mounts the card from test/fixtures/own-setup", async () => {
        useHarnessClock();
        const fixture = loadOwnSetupFixture();
        expect(fixture).toBeDefined();

        const card = await mountCard(fixtureConfig(fixture!), fixtureHass(fixture!));

        expect(card.shadowRoot.querySelector("ha-card")).not.toBeNull();
        expect(card.shadowRoot.getElementById("map-image-source")).not.toBeNull();

        const map = PNG.sync.read(readFileSync(fixture!.mapPngPath));
        await card.fireMapLoad({ width: map.width, height: map.height });
    });
});
