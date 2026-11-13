import { afterEach, beforeEach } from "vitest";

import { setupHarness, teardownHarnessDom } from "./dom";

/**
 * Every test file starts with the same clean DOM: `ha-*` elements defined, `loadCardHelpers`
 * available, no leftover nodes, local storage empty, and real timers restored afterwards.
 */
beforeEach(() => {
    setupHarness();
});

afterEach(() => {
    teardownHarnessDom();
});
