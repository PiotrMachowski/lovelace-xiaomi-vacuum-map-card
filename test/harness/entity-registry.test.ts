import { describe, expect, it } from "vitest";

import type { MockHass } from "./hass";
import { mockHass, withRegistryEntries } from "./hass";

interface GetEntriesResult {
    [entityId: string]: unknown;
}

function registryHass(): MockHass {
    return mockHass({
        entities: [
            { entity_id: "vacuum.a", device_id: "device-a", unique_id: "unique-a" },
            { entity_id: "sensor.a_battery", device_id: "device-a", unique_id: "unique-a-battery" },
        ],
    });
}

describe("entity-registry websocket mock", () => {
    it("answers get_entries with the entity-id map Home Assistant sends", async () => {
        const hass = registryHass();

        const entries = await hass.callWS<GetEntriesResult>({
            type: "config/entity_registry/get_entries",
            entity_ids: ["vacuum.a", "vacuum.unknown"],
        });

        // Core's websocket_get_entities sends a plain object, not `{ entries: [...] }`, and maps
        // every requested id that has no entry to `null`.
        expect(Array.isArray(entries)).toBe(false);
        expect("entries" in entries).toBe(false);
        expect(entries["vacuum.a"]).toMatchObject({
            entity_id: "vacuum.a",
            device_id: "device-a",
            unique_id: "unique-a",
        });
        expect(entries["vacuum.unknown"]).toBeNull();
        expect(Object.keys(entries).sort()).toEqual(["vacuum.a", "vacuum.unknown"]);
    });

    it("answers an empty get_entries request with an empty object", async () => {
        const hass = registryHass();

        const entries = await hass.callWS<GetEntriesResult>({
            type: "config/entity_registry/get_entries",
            entity_ids: [],
        });

        expect(entries).toEqual({});
    });
});

describe("withRegistryEntries", () => {
    it("keeps the display registry, get and get_entries on the same merged list", async () => {
        const hass = registryHass();

        const derived = withRegistryEntries(hass, {
            "vacuum.b": {
                entity_id: "vacuum.b",
                device_id: "device-b",
                unique_id: "unique-b",
                name: "Vacuum B",
            },
        });

        expect(derived.entities["vacuum.b"]).toMatchObject({
            entity_id: "vacuum.b",
            device_id: "device-b",
            name: "Vacuum B",
        });
        await expect(
            derived.callWS({
                type: "config/entity_registry/get",
                entity_id: "vacuum.b",
            }),
        ).resolves.toMatchObject({ entity_id: "vacuum.b", device_id: "device-b" });

        const entries = await derived.callWS<GetEntriesResult>({
            type: "config/entity_registry/get_entries",
            entity_ids: ["vacuum.a", "vacuum.b", "vacuum.unknown"],
        });
        expect(entries["vacuum.a"]).toMatchObject({ device_id: "device-a" });
        expect(entries["vacuum.b"]).toMatchObject({ device_id: "device-b" });
        expect(entries["vacuum.unknown"]).toBeNull();
    });

    it("leaves the original hass registry untouched", async () => {
        const hass = registryHass();
        const derived = withRegistryEntries(hass, {
            "vacuum.b": { entity_id: "vacuum.b", device_id: "device-b" },
        });

        expect(hass.entities["vacuum.b"]).toBeUndefined();
        await expect(
            hass.callWS({ type: "config/entity_registry/get", entity_id: "vacuum.b" }),
        ).rejects.toThrow(/no registry entry for vacuum\.b/);
        expect(derived).not.toBe(hass);
        expect(derived.states).toBe(hass.states);
    });

    it("replaces an existing entry instead of duplicating it", async () => {
        const hass = registryHass();
        const derived = withRegistryEntries(hass, {
            "vacuum.a": { entity_id: "vacuum.a", device_id: "device-a", unique_id: "replaced" },
        });

        await expect(
            derived.callWS({ type: "config/entity_registry/get", entity_id: "vacuum.a" }),
        ).resolves.toMatchObject({ unique_id: "replaced" });
        expect(Object.keys(derived.entities)).toEqual(["vacuum.a", "sensor.a_battery"]);
    });
});
