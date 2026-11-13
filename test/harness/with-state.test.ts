import { describe, expect, it } from "vitest";

import { mockHass, withState } from "./hass";
import { fixtureStates, loadSyntheticFixture } from "./fixtures";

describe("withState", () => {
    it("replaces only the changed state and keeps every other state by reference", () => {
        const fixture = loadSyntheticFixture();
        const hass = mockHass({
            states: fixtureStates(fixture),
            entities: fixture.registry,
        });
        const entityId = "vacuum.roborock_s7";
        const previousState = hass.states[entityId];

        const { hass: nextHass, state } = withState(hass, entityId, { state: "cleaning" });

        expect(state).not.toBe(previousState);
        expect(state.state).toBe("cleaning");
        expect(nextHass.states[entityId]).toBe(state);
        expect(hass.states[entityId]).toBe(previousState);
        expect(hass.states[entityId].state).toBe("docked");

        // hasConfigOrAnyEntityChanged compares states by reference: untouched entities must be
        // the very same objects, otherwise every card update would look like a real change.
        for (const otherId of Object.keys(hass.states)) {
            if (otherId === entityId) continue;
            expect(nextHass.states[otherId]).toBe(hass.states[otherId]);
        }
        expect(nextHass.states).not.toBe(hass.states);
        expect(Object.keys(nextHass.states)).toEqual(Object.keys(hass.states));
    });

    it("keeps the attributes object unless the patch replaces it", () => {
        const hass = mockHass({
            states: {
                "sensor.example": {
                    entity_id: "sensor.example",
                    state: "1",
                    attributes: { friendly_name: "Example", unit_of_measurement: "W" },
                    last_changed: "2026-01-01T00:00:00.000Z",
                    last_updated: "2026-01-01T00:00:00.000Z",
                    context: { id: "fixture-sensor-example", parent_id: null, user_id: null },
                },
            },
        });
        const attributes = hass.states["sensor.example"].attributes;

        const { state } = withState(hass, "sensor.example", { state: "2" });

        expect(state.attributes).toBe(attributes);
        expect(state.attributes.friendly_name).toBe("Example");
    });
});
