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
const NEW_SENSOR = "sensor.roborock_s7_new_sensor";
const DISABLED_SENSOR = "sensor.roborock_s7_disabled";

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

/** A sensor on the vacuum's device that the user disabled in the registry. */
function disabledSensor(): MockEntityRegistryEntry {
    return {
        entity_id: DISABLED_SENSOR,
        unique_id: "roborock_s7_disabled",
        device_id: DEVICE,
        original_name: "Roborock S7 disabled sensor",
        disabled_by: "user",
    };
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
    });

    it("makes no websocket call for an entity that is not in the display registry", async () => {
        const hass = fixtureHass(loadSyntheticFixture());

        const entries = await getAllEntitiesFromTheSameDevice(hass, "vacuum.not_in_registry");

        expect(entries).toEqual([]);
        expect(hass.wsCalls).toHaveLength(0);
    });

    it("drops a requested id that core answers with null", async () => {
        const hass = fixtureHass(loadSyntheticFixture());
        const ghost = "sensor.roborock_s7_ghost";
        // The display registry can list an id the full registry no longer has; core answers `null`
        // for it in the `get_entries` map, and a null must not reach the generators.
        const withGhost = {
            ...hass,
            entities: { ...hass.entities, [ghost]: { entity_id: ghost, device_id: DEVICE } },
        } as MockHass;

        const entries = await getAllEntitiesFromTheSameDevice(withGhost, VACUUM);

        expect(wsMessages(withGhost, "config/entity_registry/get_entries")[0].entity_ids).toContain(ghost);
        expect(entries.map(entry => entry.entity_id)).toEqual(deviceEntityIds(hass, DEVICE));
        expect(entries.every(entry => entry != null)).toBe(true);
        // A null is dropped by the filter, not by dereferencing it and falling back to `/list`.
        expect(wsMessages(withGhost, "config/entity_registry/list")).toHaveLength(0);
    });

    it("drops a disabled entity that get_entries returns", async () => {
        const hass = withRegistryEntries(fixtureHass(loadSyntheticFixture()), [disabledSensor()]);

        const entries = await getAllEntitiesFromTheSameDevice(hass, VACUUM);

        expect(
            wsMessages(hass, "config/entity_registry/get_entries")[0].entity_ids,
        ).toContain(DISABLED_SENSOR);
        expect(entries.some(entry => entry.entity_id === DISABLED_SENSOR)).toBe(false);
        expect(entries.map(entry => entry.entity_id)).toEqual(
            deviceEntityIds(hass, DEVICE).filter(entityId => entityId !== DISABLED_SENSOR),
        );
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

    it("resolves when hass has no connection instead of throwing out of the cache", async () => {
        const hass = { ...fixtureHass(loadSyntheticFixture()), connection: undefined } as unknown as MockHass;

        // A connection-less hass cannot be memoized; the lookup still completes.
        await expect(getAllEntitiesFromTheSameDevice(hass, VACUUM)).resolves.toEqual(
            expect.arrayContaining([expect.objectContaining({ entity_id: VACUUM })]),
        );
        expect(wsMessages(hass, "config/entity_registry/get_entries")).toHaveLength(1);
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

    it("drops a disabled entry that the full registry lists", async () => {
        const hass = withRegistryEntries(fixtureHass(loadSyntheticFixture()), [disabledSensor()]);
        hass.setWSHandler("config/entity_registry/get_entries", () => {
            throw new Error("mockHass: unknown command config/entity_registry/get_entries");
        });

        const entries = await getAllEntitiesFromTheSameDevice(hass, VACUUM);

        // The fallback did see the disabled entry: it listed the registry and fetched the entry.
        expect(wsMessages(hass, "config/entity_registry/list")).toHaveLength(1);
        expect(wsMessages(hass, "config/entity_registry/get").map(message => message.entity_id)).toContain(
            DISABLED_SENSOR,
        );
        expect(entries.some(entry => entry.entity_id === DISABLED_SENSOR)).toBe(false);
        expect(entries.map(entry => entry.entity_id)).toEqual(
            deviceEntityIds(hass, DEVICE).filter(entityId => entityId !== DISABLED_SENSOR),
        );
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

describe("cache invalidation on a changed device entity set (#864, council round 1)", () => {
    it("reads the registry again after an entity is added to the vacuum's device", async () => {
        const page = fixtureHass(loadSyntheticFixture());
        const before = await getAllEntitiesFromTheSameDevice(page, VACUUM);
        expect(before.some(entry => entry.entity_id === NEW_SENSOR)).toBe(false);

        // The same page and the same connection, with a display registry that now has the sensor.
        // This is what a user enabling a sensor or an integration update produces in HA.
        const updated = withRegistryEntries(page, [
            {
                entity_id: NEW_SENSOR,
                unique_id: "roborock_s7_new_sensor",
                device_id: DEVICE,
                original_name: "Roborock S7 new sensor",
            },
        ]);
        expect(updated.connection).toBe(page.connection);

        const after = await getAllEntitiesFromTheSameDevice(updated, VACUUM);

        expect(after).not.toBe(before);
        expect(after.map(entry => entry.entity_id)).toEqual(deviceEntityIds(updated, DEVICE));
        expect(after.some(entry => entry.entity_id === NEW_SENSOR)).toBe(true);
        // The changed key is a miss, so the registry was read again instead of serving the old page.
        expect(wsMessages(updated, "config/entity_registry/get_entries")).toHaveLength(1);
    });

    it("reads the registry again after an entity is removed from the vacuum's device", async () => {
        const page = withRegistryEntries(fixtureHass(loadSyntheticFixture()), [
            {
                entity_id: NEW_SENSOR,
                unique_id: "roborock_s7_new_sensor",
                device_id: DEVICE,
                original_name: "Roborock S7 new sensor",
            },
        ]);
        const before = await getAllEntitiesFromTheSameDevice(page, VACUUM);
        expect(before.some(entry => entry.entity_id === NEW_SENSOR)).toBe(true);

        // The display registry drops the entity. The websocket registry still has it, so only a
        // cache miss can produce the shorter list.
        const entities = { ...page.entities };
        delete entities[NEW_SENSOR];
        const reduced = { ...page, entities } as MockHass;

        const after = await getAllEntitiesFromTheSameDevice(reduced, VACUUM);

        expect(after.map(entry => entry.entity_id)).toEqual(deviceEntityIds(reduced, DEVICE));
        expect(after.some(entry => entry.entity_id === NEW_SENSOR)).toBe(false);
        // One call for the first lookup and one for the changed key; both share this call log.
        expect(wsMessages(reduced, "config/entity_registry/get_entries")).toHaveLength(2);
    });

    it("returns a frozen array, so a caller cannot corrupt another generator's copy", async () => {
        const hass = fixtureHass(loadSyntheticFixture());

        const first = await getAllEntitiesFromTheSameDevice(hass, VACUUM);
        const second = await getAllEntitiesFromTheSameDevice(hass, VACUUM);

        expect(second).toBe(first);
        expect(Object.isFrozen(first)).toBe(true);
        expect(() => first.pop()).toThrow(TypeError);
        // The mutation attempt did not shrink the shared answer.
        expect(second.map(entry => entry.entity_id)).toEqual(deviceEntityIds(hass, DEVICE));
    });
});
