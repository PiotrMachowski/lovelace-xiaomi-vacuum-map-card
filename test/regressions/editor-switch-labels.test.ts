import { describe, expect, it } from "vitest";

import { fixtureConfig, fixtureHass, loadSyntheticFixture, mountEditor, useHarnessClock, withoutCustomElement } from "../harness";

/**
 * The editor's labelled switches must stay readable on frontends that no longer define `ha-formfield`.
 *
 * Home Assistant 2026.11 removed it; the template used to render `<ha-formfield .label=…>` and the
 * label vanished on that frontend (caught by the real-Home-Assistant suite). The fallback keeps the
 * text and the switch together.
 */
describe("editor switch labels", () => {
    it("uses ha-formfield when the frontend provides it", async () => {
        useHarnessClock();
        const fixture = loadSyntheticFixture();
        const editor = await mountEditor(fixtureConfig(fixture), fixtureHass(fixture));
        const formfields = editor.shadowRoot.querySelectorAll("ha-formfield");
        expect(formfields.length).toBeGreaterThanOrEqual(3);
        expect(editor.shadowRoot.querySelectorAll(".switch-fallback").length).toBe(0);
    });

    it("renders the labels without ha-formfield", async () => {
        useHarnessClock();
        const fixture = loadSyntheticFixture();
        const restore = withoutCustomElement("ha-formfield");
        try {
            const editor = await mountEditor(fixtureConfig(fixture), fixtureHass(fixture));
            expect(editor.shadowRoot.querySelectorAll("ha-formfield").length).toBe(0);
            const labels = Array.from(editor.shadowRoot.querySelectorAll(".switch-fallback-label")).map(
                element => element.textContent?.trim() ?? "",
            );
            expect(labels.length).toBeGreaterThanOrEqual(3);
            expect(labels.join(" | ")).toMatch(/Map locked/i);
            expect(labels.join(" | ")).toMatch(/Remember zoom and position/i);
            // The switches themselves are still there and still carry their config keys.
            const keys = Array.from(editor.shadowRoot.querySelectorAll("ha-switch")).map(element =>
                (element as HTMLElement & { configValue?: string }).configValue,
            );
            expect(keys).toContain("map_locked");
        } finally {
            restore();
        }
    });
});
