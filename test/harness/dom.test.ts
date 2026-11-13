import { describe, expect, it } from "vitest";

import { withoutCustomElement } from "./dom";

describe("withoutCustomElement", () => {
    it("masks one tag while every other element still resolves", () => {
        // setupHarness() in the global beforeEach has already defined every ha-* element, which is
        // exactly why stubHaElements cannot accept an "exclude" list.
        expect(customElements.get("ha-input")).toBeDefined();
        expect(customElements.get("ha-textfield")).toBeDefined();

        const restore = withoutCustomElement("ha-input");

        // Batch B2 uses this to exercise the editor's ha-input -> ha-textfield fallback (#958).
        expect(customElements.get("ha-input")).toBeUndefined();
        expect(customElements.get("ha-textfield")).toBeDefined();

        restore();

        expect(customElements.get("ha-input")).toBeDefined();
    });
});
