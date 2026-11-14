import { describe, expect, it } from "vitest";

import { createTapGuard, TAP_MOVE_TOLERANCE_PX } from "../../src/model/tap-guard";
import type { XiaomiVacuumMapCardConfig } from "../../src/types/types";
import type { CardHandle } from "../harness";
import { fixtureConfig, fixtureHass, loadSyntheticFixture, mountCard, settle, useHarnessClock } from "../harness";

/**
 * Dragging the map selected rooms: a pan ends with a `click` on whatever is under the pointer, and
 * the room outlines and the colour-map hit test took that click as a tap. The card now tells taps
 * from drags (and pinches) on the map overlay and drops the click that ends a drag.
 */

function pointer(type: string, x: number, y: number, pointerId = 1): PointerEvent {
    return new PointerEvent(type, { bubbles: true, composed: true, clientX: x, clientY: y, pointerId });
}

function click(x: number, y: number): MouseEvent {
    return new MouseEvent("click", { bubbles: true, composed: true, cancelable: true, clientX: x, clientY: y });
}

describe("createTapGuard", () => {
    function guarded(): { guard: ReturnType<typeof createTapGuard>; clicks: () => number; target: HTMLElement } {
        const guard = createTapGuard();
        const parent = document.createElement("div");
        const target = document.createElement("span");
        parent.appendChild(target);
        document.body.appendChild(parent);
        parent.addEventListener("pointerdown", guard.pointerDown, { capture: true });
        parent.addEventListener("pointermove", guard.pointerMove, { capture: true });
        parent.addEventListener("pointerup", guard.pointerUp, { capture: true });
        parent.addEventListener("click", guard.click, { capture: true });
        let count = 0;
        target.addEventListener("click", () => count++);
        return { guard, clicks: () => count, target };
    }

    it("lets a tap through, including a small wobble", () => {
        const { target, clicks } = guarded();
        target.dispatchEvent(pointer("pointerdown", 10, 10));
        target.dispatchEvent(pointer("pointermove", 10 + TAP_MOVE_TOLERANCE_PX - 1, 10));
        target.dispatchEvent(pointer("pointerup", 10 + TAP_MOVE_TOLERANCE_PX - 1, 10));
        target.dispatchEvent(click(10, 10));
        expect(clicks()).toBe(1);
    });

    it("drops the click that ends a drag, and only that one", () => {
        const { target, clicks } = guarded();
        target.dispatchEvent(pointer("pointerdown", 10, 10));
        target.dispatchEvent(pointer("pointermove", 40, 25));
        target.dispatchEvent(pointer("pointerup", 40, 25));
        target.dispatchEvent(click(40, 25));
        expect(clicks()).toBe(0);

        // The next tap is a tap again.
        target.dispatchEvent(pointer("pointerdown", 50, 50));
        target.dispatchEvent(pointer("pointerup", 50, 50));
        target.dispatchEvent(click(50, 50));
        expect(clicks()).toBe(1);
    });

    it("drops the click that ends a pinch, even without movement", () => {
        const { target, clicks } = guarded();
        target.dispatchEvent(pointer("pointerdown", 10, 10, 1));
        target.dispatchEvent(pointer("pointerdown", 60, 60, 2));
        target.dispatchEvent(pointer("pointerup", 10, 10, 1));
        target.dispatchEvent(pointer("pointerup", 60, 60, 2));
        target.dispatchEvent(click(10, 10));
        expect(clicks()).toBe(0);
    });
});

describe("dragging the map over a room", () => {
    function cardConfig(): XiaomiVacuumMapCardConfig {
        return {
            ...fixtureConfig(loadSyntheticFixture()),
            map_modes: [{ template: "vacuum_clean_segment" }],
            tiles: [],
            icons: [],
            persist_map_view: false,
        };
    }

    async function mount(): Promise<CardHandle> {
        useHarnessClock();
        const card = await mountCard(cardConfig(), fixtureHass(loadSyntheticFixture()));
        await card.fireMapLoad();
        return card;
    }

    function outline(card: CardHandle, id: string): Element {
        const element = card.shadowRoot.querySelector(`.room-${id}-wrapper .room-outline`);
        if (!element) throw new Error(`room ${id} has no outline`);
        return element;
    }

    function selectedIds(card: CardHandle): string[] {
        return (card.element as unknown as { selectedRooms: Array<{ toVacuum(): unknown }> }).selectedRooms.map(room =>
            String(room.toVacuum()),
        );
    }

    it("does not select the room under the pointer when the map was dragged", async () => {
        const card = await mount();
        const room = outline(card, "1");
        room.dispatchEvent(pointer("pointerdown", 100, 100));
        room.dispatchEvent(pointer("pointermove", 160, 130));
        room.dispatchEvent(pointer("pointerup", 160, 130));
        room.dispatchEvent(click(160, 130));
        await settle(card.element);

        expect(selectedIds(card)).toEqual([]);
    });

    it("still selects the room on a tap", async () => {
        const card = await mount();
        const room = outline(card, "1");
        room.dispatchEvent(pointer("pointerdown", 100, 100));
        room.dispatchEvent(pointer("pointerup", 101, 100));
        room.dispatchEvent(click(101, 100));
        await settle(card.element);

        expect(selectedIds(card)).toEqual(["1"]);
    });
});
