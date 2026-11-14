import { describe, expect, it, vi } from "vitest";

import type { MapModeConfig, XiaomiVacuumMapCardConfig } from "../../src/types/types";
import { evaluateJinjaTemplate, normalizeJinjaQuotes } from "../../src/utils";
import type { CardHandle, MockHass } from "../harness";
import { fixtureConfig, fixtureHass, loadSyntheticFixture, mountCard, settle, useHarnessClock } from "../harness";

/**
 * Room selections built from the camera's `rooms` metadata.
 *
 * 1. The camera refresh rebuilds the room objects. The rebuilt selection must keep click order (the
 *    cleaning order) instead of falling back to room-id order.
 * 2. Metadata room ids are strings. In a mode with `evaluate_data_as_template`, `[[selection]]`
 *    inside `{{ }}` reached Jinja as `[\"13\"]`, Home Assistant reported a syntax error that the
 *    card never listened for, and the run button silently did nothing.
 */

/** Mirrors the reporter's Viomi mode: a templated `send_command` with `[[selection]]` in Jinja. */
const TEMPLATED_ROOM_MODE = {
    name: "Rooms",
    icon: "mdi:floor-plan",
    selection_type: "ROOM",
    max_selections: 5,
    repeats_type: "NONE",
    service_call_schema: {
        service: "vacuum.send_command",
        evaluate_data_as_template: true,
        service_data: {
            entity_id: "[[entity_id]]",
            command: "set_mode_withroom",
            params: "[1, 1, {{ [[selection]] | length }}, [[selection_unwrapped]]]",
        },
    },
} as const;

async function mountRoomsCard(hass: MockHass): Promise<CardHandle> {
    useHarnessClock();
    const fixture = loadSyntheticFixture();
    const config: XiaomiVacuumMapCardConfig = {
        ...fixtureConfig(fixture),
        map_modes: [TEMPLATED_ROOM_MODE as unknown as MapModeConfig],
        tiles: [],
        icons: [],
        persist_map_view: false,
    };
    const card = await mountCard(config, hass);
    await card.fireMapLoad();
    return card;
}

async function clickRoom(card: CardHandle, id: string): Promise<void> {
    const polygon = card.shadowRoot.querySelector(`.room-${id}-wrapper .room-outline`);
    if (!polygon) throw new Error(`room ${id} has no clickable outline`);
    polygon.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
    await settle(card.element);
}

async function runSelection(card: CardHandle): Promise<void> {
    const button = card.shadowRoot.querySelector(".map-actions-item.main");
    if (!button) throw new Error("the card has no run button");
    button.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
    await settle(card.element, 400);
}

function selectedIds(card: CardHandle): string[] {
    return (card.element as unknown as { selectedRooms: Array<{ toVacuum(): unknown }> }).selectedRooms.map(room =>
        String(room.toVacuum()),
    );
}

type RenderTemplateCallback = (msg: Record<string, unknown>) => void;

/** Answers `render_template` the way Home Assistant does, rendering only `{{ x | length }}`. */
function answerRenderTemplate(hass: MockHass, answer: (template: string) => Record<string, unknown>): void {
    vi.mocked(hass.connection.subscribeMessage).mockImplementation((async (
        callback: RenderTemplateCallback,
        message: { template: string },
    ) => {
        queueMicrotask(() => callback(answer(message.template)));
        return () => undefined;
    }) as never);
}

describe("room selections from camera metadata", () => {
    it("keeps click order when the camera refresh rebuilds the rooms", async () => {
        const card = await mountRoomsCard(fixtureHass(loadSyntheticFixture()));
        await clickRoom(card, "2");
        await clickRoom(card, "0");
        expect(selectedIds(card)).toEqual(["2", "0"]);

        (card.element as unknown as { _refreshRoomsAfterColorDetection(): void })._refreshRoomsAfterColorDetection();
        await settle(card.element);

        expect(selectedIds(card)).toEqual(["2", "0"]);
        const order = (id: string): string | undefined =>
            card.shadowRoot.querySelector(`.room-${id}-wrapper .room-order`)?.textContent?.trim();
        expect([order("2"), order("0")]).toEqual(["1", "2"]);
    });

    it("runs a templated mode with string room ids", async () => {
        const hass = fixtureHass(loadSyntheticFixture());
        let rendered = "";
        answerRenderTemplate(hass, template => {
            rendered = template;
            // A real render fails on `\"` inside `{{ }}`; the card must not send one.
            if (/\{\{[^}]*\\"/.test(template)) return { error: "TemplateSyntaxError: unexpected char '\\\\'", level: "ERROR" };
            const result = template.replace(/\{\{\s*\[([^\]]*)\]\s*\|\s*length\s*\}\}/, (_, items: string) =>
                String(items.split(",").length),
            );
            return { result: JSON.parse(result) };
        });
        const card = await mountRoomsCard(hass);
        await clickRoom(card, "2");
        await clickRoom(card, "0");

        await runSelection(card);

        expect(rendered).toContain("{{ ['2','0'] | length }}");
        const calls = vi.mocked(hass.callService).mock.calls;
        expect(calls).toHaveLength(1);
        expect(calls[0].slice(0, 3)).toEqual([
            "vacuum",
            "send_command",
            { entity_id: "vacuum.roborock_s7", command: "set_mode_withroom", params: "[1, 1, 2, 2,0]" },
        ]);
    });

    it("reports a template error instead of doing nothing, and keeps the selection", async () => {
        const hass = fixtureHass(loadSyntheticFixture());
        answerRenderTemplate(hass, () => ({ error: "UndefinedError: boom", level: "ERROR" }));
        const card = await mountRoomsCard(hass);
        await clickRoom(card, "1");
        const toast = vi.spyOn(card.element as unknown as { _showToast: (...a: unknown[]) => void }, "_showToast");

        await runSelection(card);

        expect(hass.callService).not.toHaveBeenCalled();
        expect(toast).toHaveBeenCalledWith("popups.failed", "mdi:close", false, "UndefinedError: boom");
        expect(selectedIds(card)).toEqual(["1"]);
    });
});

describe("normalizeJinjaQuotes", () => {
    it("rewrites escaped double quotes only inside Jinja delimiters", () => {
        const template = JSON.stringify({ a: '{{ ["13","14"] | length }}', b: '"kept"', c: '{% if "x" %}y{% endif %}' });
        expect(JSON.parse(normalizeJinjaQuotes(template))).toEqual({
            a: "{{ ['13','14'] | length }}",
            b: '"kept"',
            c: "{% if 'x' %}y{% endif %}",
        });
    });
});

describe("evaluateJinjaTemplate", () => {
    it("rejects on a reported template error and unsubscribes", async () => {
        const hass = fixtureHass(loadSyntheticFixture());
        const unsubscribe = vi.fn();
        vi.mocked(hass.connection.subscribeMessage).mockImplementation((async (callback: RenderTemplateCallback) => {
            queueMicrotask(() => callback({ error: "TemplateSyntaxError", level: "ERROR" }));
            return unsubscribe;
        }) as never);

        await expect(evaluateJinjaTemplate(hass, "{{ x }}")).rejects.toThrow("TemplateSyntaxError");
        await Promise.resolve();
        expect(unsubscribe).toHaveBeenCalled();
        expect(vi.mocked(hass.connection.subscribeMessage).mock.calls[0][1]).toMatchObject({ report_errors: true });
    });
});
