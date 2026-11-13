import { describe, expect, it } from "vitest";

import {
    fixtureConfig,
    fixtureHass,
    loadSyntheticFixture,
    mountEditor,
    useHarnessClock,
    withoutCustomElement,
} from "../harness";

function textFields(root: ShadowRoot): Element[] {
    return Array.from(root.querySelectorAll("ha-input, ha-textfield"));
}

function titleField(root: ShadowRoot): Element | undefined {
    return textFields(root).find(field => (field as Element & { configValue?: string }).configValue === "title");
}

describe("editor text field element fallback (#958)", () => {
    it("renders ha-input when the current frontend defines it", async () => {
        useHarnessClock();
        const fixture = loadSyntheticFixture();
        const editor = await mountEditor(fixtureConfig(fixture), fixtureHass(fixture));

        // Assert the rendered tag, not only `customElements.get`: the harness stubs every
        // `ha-*` tag, and the editor must choose the element the frontend actually provides.
        expect(titleField(editor.shadowRoot)?.tagName.toLowerCase()).toBe("ha-input");
        expect(textFields(editor.shadowRoot).map(field => field.tagName.toLowerCase())).not.toContain("ha-textfield");
    });

    it("renders ha-textfield when the frontend has no ha-input", async () => {
        useHarnessClock();
        // Mask ha-input before mounting: the editor decides at render time, so the mask has to be
        // in place when the element is constructed. The tag itself stays registered, which is why
        // the assertion checks the rendered tag name.
        withoutCustomElement("ha-input");
        const fixture = loadSyntheticFixture();
        const editor = await mountEditor(fixtureConfig(fixture), fixtureHass(fixture));

        expect(titleField(editor.shadowRoot)?.tagName.toLowerCase()).toBe("ha-textfield");
        expect(textFields(editor.shadowRoot).map(field => field.tagName.toLowerCase())).not.toContain("ha-input");
    });
});
