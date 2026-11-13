import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import type { HassEntity } from "home-assistant-js-websocket/dist/types";

import type { XiaomiVacuumMapCardConfig } from "../../src/types/types";
import { mockHass, type MockEntityRegistryEntry, type MockHass, type MockHassOptions } from "./hass";

const FIXTURES_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../fixtures");

export const SYNTHETIC_FIXTURE_DIR = path.join(FIXTURES_ROOT, "synthetic");
export const OWN_SETUP_FIXTURE_DIR = path.join(FIXTURES_ROOT, "own-setup");

/** The files batch P0d must drop into `test/fixtures/own-setup/`. */
export const OWN_SETUP_FILES = ["states.json", "camera.json", "registry.json", "map.png"] as const;

export interface FixtureBundle {
    name: "synthetic" | "own-setup";
    directory: string;
    /** Entity states from states.json; the camera comes from camera.json. */
    states: Record<string, HassEntity>;
    camera: HassEntity;
    registry: MockEntityRegistryEntry[];
    mapPngPath: string;
}

function readJson<T>(file: string): T {
    return JSON.parse(readFileSync(file, "utf8")) as T;
}

function loadBundle(name: FixtureBundle["name"], directory: string): FixtureBundle {
    return {
        name,
        directory,
        states: readJson<Record<string, HassEntity>>(path.join(directory, "states.json")),
        camera: readJson<HassEntity>(path.join(directory, "camera.json")),
        registry: readJson<MockEntityRegistryEntry[]>(path.join(directory, "registry.json")),
        mapPngPath: path.join(directory, "map.png"),
    };
}

/** Loads the committed synthetic fixture. */
export function loadSyntheticFixture(): FixtureBundle {
    return loadBundle("synthetic", SYNTHETIC_FIXTURE_DIR);
}

/** Returns the own-setup files that are still missing. Empty when the fixture is complete. */
export function ownSetupMissingFiles(): string[] {
    return OWN_SETUP_FILES.filter(file => !existsSync(path.join(OWN_SETUP_FIXTURE_DIR, file)));
}

/** Loads the real-instance fixture when batch P0d has captured it, otherwise undefined. */
export function loadOwnSetupFixture(): FixtureBundle | undefined {
    if (ownSetupMissingFiles().length > 0) return undefined;
    return loadBundle("own-setup", OWN_SETUP_FIXTURE_DIR);
}

/** Merge the camera state into the bundle's states. */
export function fixtureStates(bundle: FixtureBundle): Record<string, HassEntity> {
    return { ...bundle.states, [bundle.camera.entity_id]: bundle.camera };
}

/**
 * A mock hass populated from a fixture. `options` are forwarded to `mockHass` for everything except
 * the states and registry, which come from the fixture; `configVersion` is the usual override.
 */
export function fixtureHass(
    bundle: FixtureBundle,
    options: Omit<MockHassOptions, "states" | "entities"> = {},
): MockHass {
    return mockHass({
        ...options,
        states: fixtureStates(bundle),
        entities: bundle.registry,
    });
}

/** A minimal valid card config pointing at the fixture's vacuum and camera. */
export function fixtureConfig(bundle: FixtureBundle): XiaomiVacuumMapCardConfig {
    const vacuum = Object.keys(bundle.states).find(entityId => entityId.startsWith("vacuum."));
    if (!vacuum) throw new Error(`${bundle.name} fixture has no vacuum entity in states.json`);
    return {
        type: "custom:xiaomi-vacuum-map-card",
        entity: vacuum,
        map_source: { camera: bundle.camera.entity_id },
        calibration_source: { camera: true },
        vacuum_platform: "Xiaomi Miio",
    };
}
