import { describe, expect, it } from "vitest";

import { EVENT_ROOM_CONFIG } from "../../src/const";
import type { RoomConfigEventData } from "../../src/types/types";
import {
    fixtureConfig,
    fixtureHass,
    loadSyntheticFixture,
    mountCard,
    requestRoomConfig,
    settle,
    useHarnessClock,
} from "../harness";

describe("editor-preview card disconnect", () => {
    it("stops answering room-config requests when the card itself is removed", async () => {
        useHarnessClock();
        const fixture = loadSyntheticFixture();
        const card = await mountCard(fixtureConfig(fixture), fixtureHass(fixture), { inEditorPreview: true });
        expect(card.element.isInEditor).toBe(true);

        const answers: Array<RoomConfigEventData | undefined> = [];
        const listener = (event: Event): void => {
            answers.push((event as Event & { roomConfig: RoomConfigEventData | undefined }).roomConfig);
        };
        window.addEventListener(EVENT_ROOM_CONFIG, listener);

        try {
            requestRoomConfig();
            await settle(card.element);
            expect(answers).toHaveLength(1);

            // Remove the card directly. Its `connectedCallback` already established that it is an
            // editor preview, so `disconnectedCallback` must use that stored flag; re-evaluating
            // `_isInEditor()` here sees no parent and would leave the window listener attached.
            // The harness's usual wrapper teardown cannot catch this leak.
            card.element.remove();
            requestRoomConfig();
            await settle();
            expect(answers).toHaveLength(1);
        } finally {
            window.removeEventListener(EVENT_ROOM_CONFIG, listener);
        }
    });
});
