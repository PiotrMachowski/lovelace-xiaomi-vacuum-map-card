import { describe, expect, it, vi } from "vitest";

import { IconListGenerator } from "../../src/model/generators/icon-list-generator";
import { TilesGenerator } from "../../src/model/generators/tiles-generator";
import { getAllEntitiesFromTheSameDevice } from "../../src/utils";
import type { MockEntityRegistryEntry, MockHass } from "../harness";
import { fixtureHass, loadSyntheticFixture, withRegistryEntries } from "../harness";

const VACUUM = "vacuum.roborock_s7";
const DEVICE = "device-roborock-s7";
const SECOND_VACUUM = "vacuum.roborock_s8";
const SECOND_DEVICE = "device-roborock-s8";

/** The ids the display registry assigns to one device, in the order the card reads them. */
function deviceEntityIds(hass: MockHass, deviceId: string): string[] {
    return Object.values(hass.entities)
        .filter(entry => entry.device_id === deviceId)
        .map(entry => entry.entity_id);
}

/** Every websocket message of one type, in call order. */
function wsMessages(hass: MockHass, type: string): Record<string, unknown>[] {
    return hass.wsCalls.filter(call => call.type === type).map(call => call.message);
}

function registryCallTypes(types: string[]): string[] {
    return types.filter(type => type.startsWith("config/entity_registry/"));
}

/** The second vacuum the cross-card and multi-vacuum tests need, on its own device. */
function secondVacuumEntries(): MockEntityRegistryEntry[] {
    return [
        {
            entity_id: SECOND_VACUUM,
            unique_id: "roborock_s8",
            device_id: SECOND_DEVICE,
            original_name: "Roborock S8",
        },
        {
            entity_id: "sensor.roborock_s8_battery",
            unique_id: "roborock_s8_battery",
            device_id: SECOND_DEVICE,
            original_name: "Roborock S8 Battery",
        },
    ];
}

describe("registry lookup payload (#864)", () => {
    it("reads the device's entities through one get_entries call and never downloads the registry", async () => {
        const hass = fixtureHass(loadSyntheticFixture());
        const callWS = vi.spyOn(hass, "callWS");

        const entries = await getAllEntitiesFromTheSameDevice(hass, VACUUM);

        expect(entries.map(entry => entry.entity_id)).toEqual(deviceEntityIds(hass, DEVICE));
        expect(entries.some(entry => entry.entity_id === VACUUM)).toBe(true);

        const calledTypes = callWS.mock.calls.map(([message]) => (message as { type: string }).type);
        expect(calledTypes).toEqual(["config/entity_registry/get_entries"]);
        expect(wsMessages(hass, "config/entity_registry/list")).toHaveLength(0);
        // The old implementation also fetched every entry individually.
        expect(wsMessages(hass, "config/entity_registry/get")).toHaveLength(0);
    });

    it("sends only the candidate ids of the vacuum's own device", async () => {
        const hass = fixtureHass(loadSyntheticFixture());

        await getAllEntitiesFromTheSameDevice(hass, VACUUM);

        const [request] = wsMessages(hass, "config/entity_registry/get_entries");
        expect(request.entity_ids).toEqual(deviceEntityIds(hass, DEVICE));
        expect(request.entity_ids).not.toContain("camera.vacuum_map_b");
    });

    it("makes no websocket call for an entity that is not in the display registry", async () => {
        const hass = fixtureHass(loadSyntheticFixture());

        const entries = await getAllEntitiesFromTheSameDevice(hass, "vacuum.not_in_registry");

        expect(entries).toEqual([]);
        expect(hass.wsCalls).toHaveLength(0);
    });
});

describe("one registry lookup per vacuum per page (#864)", () => {
    it("shares a single get_entries call between the icon and tile generators", async () => {
        const hass = fixtureHass(loadSyntheticFixture());
        const callWS = vi.spyOn(hass, "callWS");

        const [icons, tiles] = await Promise.all([
            IconListGenerator.generate(hass, VACUUM, "Xiaomi Miio", "en", [], {}),
            TilesGenerator.generate(hass, VACUUM, "Xiaomi Miio", "en", [], {}),
        ]);

        // Both generators did read the registry; the output proves it.
        expect(icons.length).toBeGreaterThan(0);
        expect(tiles.length).toBeGreaterThan(0);

        const calledTypes = callWS.mock.calls.map(([message]) => (message as { type: string }).type);
        const registryCalls = registryCallTypes(calledTypes);
        expect(registryCalls).toEqual(["config/entity_registry/get_entries"]);
        expect(wsMessages(hass, "config/entity_registry/get_entries")[0].entity_ids).toEqual(
            deviceEntityIds(hass, DEVICE),
        );
    });

    it("returns the same cached result for two simultaneous lookups and calls the websocket once", async () => {
        const hass = fixtureHass(loadSyntheticFixture());

        const [first, second] = await Promise.all([
            getAllEntitiesFromTheSameDevice(hass, VACUUM),
            getAllEntitiesFromTheSameDevice(hass, VACUUM),
        ]);

        expect(first.map(entry => entry.entity_id)).toEqual(deviceEntityIds(hass, DEVICE));
        expect(second).toBe(first);
        expect(wsMessages(hass, "config/entity_registry/get_entries")).toHaveLength(1);
    });

    it("keeps one call per vacuum for two vacuums on the same page", async () => {
        const fixture = loadSyntheticFixture();
        const hass = withRegistryEntries(fixtureHass(fixture), secondVacuumEntries());

        const [first, second] = await Promise.all([
            getAllEntitiesFromTheSameDevice(hass, VACUUM),
            getAllEntitiesFromTheSameDevice(hass, SECOND_VACUUM),
        ]);

        expect(first.map(entry => entry.entity_id)).toEqual(deviceEntityIds(hass, DEVICE));
        expect(second.map(entry => entry.entity_id)).toEqual(deviceEntityIds(hass, SECOND_DEVICE));
        expect(wsMessages(hass, "config/entity_registry/get_entries").map(message => message.entity_ids)).toEqual([
            deviceEntityIds(hass, DEVICE),
            deviceEntityIds(hass, SECOND_DEVICE),
        ]);
    });

    it("does not reuse the cache on a second page, which has its own connection", async () => {
        const fixture = loadSyntheticFixture();
        const firstPage = fixtureHass(fixture);
        const firstResult = await getAllEntitiesFromTheSameDevice(firstPage, VACUUM);

        const secondPage = fixtureHass(fixture);
        expect(secondPage.connection).not.toBe(firstPage.connection);
        const secondResult = await getAllEntitiesFromTheSameDevice(secondPage, VACUUM);

        expect(secondResult).not.toBe(firstResult);
        expect(secondResult).toEqual(firstResult);
        // Each page pays for its own lookup; the second page is not served from the first cache.
        expect(wsMessages(secondPage, "config/entity_registry/get_entries")).toHaveLength(1);
    });
});

describe("get_entries fallback (#864)", () => {
    it("uses the full registry only after get_entries rejects", async () => {
        const hass = fixtureHass(loadSyntheticFixture());
        hass.setWSHandler("config/entity_registry/get_entries", () => {
            throw new Error("mockHass: unknown command config/entity_registry/get_entries");
        });

        const entries = await getAllEntitiesFromTheSameDevice(hass, VACUUM);

        const expectedIds = deviceEntityIds(hass, DEVICE);
        expect(entries.map(entry => entry.entity_id)).toEqual(expectedIds);
        expect(entries.some(entry => entry.entity_id === VACUUM)).toBe(true);

        // The failed command first, then /list and one /get per device entity: the old code path.
        expect(hass.wsCalls.map(call => call.type)).toEqual([
            "config/entity_registry/get_entries",
            "config/entity_registry/list",
            ...expectedIds.map(() => "config/entity_registry/get"),
        ]);
    });

    it("memoizes the fallback result, so an older Home Assistant lists the registry once per page", async () => {
        const hass = fixtureHass(loadSyntheticFixture());
        hass.setWSHandler("config/entity_registry/get_entries", () => {
            throw new Error("mockHass: unknown command config/entity_registry/get_entries");
        });

        const first = await getAllEntitiesFromTheSameDevice(hass, VACUUM);
        const second = await getAllEntitiesFromTheSameDevice(hass, VACUUM);

        expect(second).toBe(first);
        expect(wsMessages(hass, "config/entity_registry/list")).toHaveLength(1);
    });

    it("does not cache a lookup that failed on both paths", async () => {
        const hass = fixtureHass(loadSyntheticFixture());
        const fail = (): never => {
            throw new Error("mockHass: websocket unavailable");
        };
        hass.setWSHandler("config/entity_registry/get_entries", fail);
        hass.setWSHandler("config/entity_registry/list", fail);

        await expect(getAllEntitiesFromTheSameDevice(hass, VACUUM)).resolves.toEqual([]);
        // The failure was not memoized, so the next call retries instead of inheriting the empty list.
        await expect(getAllEntitiesFromTheSameDevice(hass, VACUUM)).resolves.toEqual([]);
        expect(wsMessages(hass, "config/entity_registry/get_entries")).toHaveLength(2);
    });
});
