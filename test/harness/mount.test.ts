import { describe, expect, it } from "vitest";

import { EVENT_ROOM_CONFIG } from "../../src/const";
import type { RoomConfigEventData } from "../../src/types/types";
import { teardownHarnessDom, useHarnessClock } from "./dom";
import { fixtureConfig, fixtureHass, loadSyntheticFixture } from "./fixtures";
import { mountCard, requestRoomConfig } from "./mount";

function roomConfigAnswers(): { answers: RoomConfigEventData[]; stop: () => void } {
    const answers: RoomConfigEventData[] = [];
    const listener = (event: Event): void => {
        answers.push((event as Event & { roomConfig: RoomConfigEventData }).roomConfig);
    };
    window.addEventListener(EVENT_ROOM_CONFIG, listener);
    return { answers, stop: () => window.removeEventListener(EVENT_ROOM_CONFIG, listener) };
}

describe("editor-preview card teardown", () => {
    it("stops answering room-config requests after cleanup()", async () => {
        useHarnessClock();
        const fixture = loadSyntheticFixture();
        const card = await mountCard(fixtureConfig(fixture), fixtureHass(fixture), { inEditorPreview: true });
        expect(card.element.isInEditor).toBe(true);

        const { answers, stop } = roomConfigAnswers();
        try {
            requestRoomConfig();
            expect(answers).toHaveLength(1);

            await card.cleanup();
            requestRoomConfig();
            expect(answers).toHaveLength(1);
        } finally {
            stop();
        }
    });

    it("stops answering room-config requests after teardown", async () => {
        useHarnessClock();
        const fixture = loadSyntheticFixture();
        const card = await mountCard(fixtureConfig(fixture), fixtureHass(fixture), { inEditorPreview: true });
        expect(card.element.isInEditor).toBe(true);

        const { answers, stop } = roomConfigAnswers();
        try {
            requestRoomConfig();
            expect(answers).toHaveLength(1);

            teardownHarnessDom();
            requestRoomConfig();
            expect(answers).toHaveLength(1);
        } finally {
            stop();
        }
    });
});
