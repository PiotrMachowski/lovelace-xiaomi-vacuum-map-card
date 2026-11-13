import { vi } from "vitest";
import type { Connection } from "home-assistant-js-websocket";
import type { HassEntity } from "home-assistant-js-websocket/dist/types";

import { localize } from "../../src/localize/localize";
import type { CalibrationPoint, Language, MapExtractorRoom, TranslatableString } from "../../src/types/types";
import type { EntityRegistryDisplayEntry, FrontendLocaleDataFixed, HomeAssistantFixed } from "../../src/types/fixes";
import { FirstWeekday } from "../../src/types/fixes";
import { NumberFormat, TimeFormat } from "../../src/localize/hass/translation";

/**
 * A display-registry entry. `device_id` is required because the icon and tile generators look up
 * the vacuum's device through it; the remaining registry fields are optional so tests can add
 * only what the code under test reads.
 */
export interface MockEntityRegistryEntry extends EntityRegistryDisplayEntry {
    /** Required here: the generators resolve the vacuum's sibling entities through it. */
    device_id: string;
    unique_id?: string;
    disabled_by?: string | null;
    hidden_by?: string | null;
    original_name?: string | null;
}

/** Registry input accepted by `mockHass`: a map keyed by entity id, or a list of entries. */
export type MockEntityRegistryInput = Record<string, MockEntityRegistryEntry> | MockEntityRegistryEntry[];

/** A websocket message recorded by the mock router. */
export interface WSCall {
    type: string;
    message: Record<string, unknown>;
}

/** Handler for one websocket command type. It may be sync or async. */
export type WSHandler = (message: Record<string, unknown>) => unknown;

export interface MockHassOptions {
    states?: Record<string, HassEntity>;
    entities?: MockEntityRegistryInput;
    /** Per-command overrides, keyed by the websocket `type`. */
    callWS?: Record<string, WSHandler>;
    locale?: Partial<FrontendLocaleDataFixed>;
    language?: string;
    hassUrlBase?: string;
    /**
     * Value reported as `hass.config.version`, i.e. the Home Assistant frontend version the card
     * sees. Defaults to `DEFAULT_HA_VERSION`, which is new enough for `formatEntityName`'s 2026.4
     * signature. Set it to an older version to exercise a version gate.
     */
    configVersion?: string;
}

export interface MockHass extends HomeAssistantFixed {
    /** Every websocket message passed to `callWS`, in call order. */
    wsCalls: WSCall[];
    /** Replace or add a websocket handler for one command type. */
    setWSHandler: (type: string, handler: WSHandler) => void;
    /** Clear the recorded websocket calls. */
    resetWSCalls: () => void;
}

export interface WithStateResult {
    hass: MockHass;
    state: HassEntity;
}

interface MockHassRuntime {
    registryEntries: MockEntityRegistryEntry[];
    customHandlers: Record<string, WSHandler>;
    wsCalls: WSCall[];
}

interface MockRouter {
    handlers: Map<string, WSHandler>;
    callWS: <T>(message: Record<string, unknown>) => Promise<T>;
}

/** Router state lives beside the public hass so a derived hass can re-seed its own router. */
const hassRuntimes = new WeakMap<object, MockHassRuntime>();

const DEFAULT_LANGUAGE = "en";
const DEFAULT_HASS_URL = "http://homeassistant.local:8123";

/**
 * Frontend version `mockHass` reports by default. It is past every version gate in the card
 * (`formatEntityName` needs 2026.4), so tests exercise the newest code path unless they ask for an
 * older version through `MockHassOptions.configVersion`.
 */
export const DEFAULT_HA_VERSION = "2026.11.0";

function toRegistryEntries(entities: MockEntityRegistryInput | undefined): MockEntityRegistryEntry[] {
    if (!entities) return [];
    const list = Array.isArray(entities) ? entities : Object.entries(entities).map(([id, entry]) => ({
        ...entry,
        entity_id: entry.entity_id ?? id,
    }));
    return list.map(entry => ({
        ...entry,
        unique_id: entry.unique_id ?? entry.entity_id,
        disabled_by: entry.disabled_by ?? null,
    }));
}

function toDisplayRegistry(entries: MockEntityRegistryEntry[]): Record<string, EntityRegistryDisplayEntry> {
    const display: Record<string, EntityRegistryDisplayEntry> = {};
    entries.forEach(entry => {
        display[entry.entity_id] = {
            entity_id: entry.entity_id,
            name: entry.name ?? undefined,
            device_id: entry.device_id,
            area_id: entry.area_id ?? undefined,
            hidden: entry.hidden ?? undefined,
            entity_category: entry.entity_category,
            translation_key: entry.translation_key,
            platform: entry.platform,
            display_precision: entry.display_precision,
        };
    });
    return display;
}

/**
 * Turns a missing translation key such as `editor.label.generate_rooms_config` into
 * `Generate rooms config`. Keys present in `en.json` go through the real localizer.
 */
export function readableTranslationKey(key: string): string {
    const last = key.split(".").pop() ?? key;
    const words = last.replace(/_/g, " ").replace(/\s+/g, " ").trim();
    return words.length === 0 ? key : words.charAt(0).toUpperCase() + words.slice(1);
}

function makeLocalize(language: string): HomeAssistantFixed["localize"] {
    return ((ts: TranslatableString, ...args: unknown[]): string => {
        const key = typeof ts === "string" ? ts : String(ts[0] ?? "");
        const translated = localize(ts, language);
        let value = translated === key || translated === undefined ? readableTranslationKey(key) : translated;
        if (args.length >= 2 && typeof args[0] === "string") {
            value = value.replace(args[0], String(args[1]));
        }
        return value;
    }) as HomeAssistantFixed["localize"];
}

function makeConnection(): Connection {
    return {
        sendMessagePromise: vi.fn(async () => ({ value: null })),
        subscribeMessage: vi.fn(async () => () => undefined),
        subscribeEvents: vi.fn(async () => () => undefined),
        close: vi.fn(),
    } as unknown as Connection;
}

/**
 * Builds the websocket router shared by `mockHass` and `withRegistryEntries`. The registry
 * handlers close over the entry list, so each derived hass must get its own router.
 */
function makeRouter(
    registryEntries: MockEntityRegistryEntry[],
    customHandlers: Record<string, WSHandler>,
    wsCalls: WSCall[],
): MockRouter {
    const handlers = new Map<string, WSHandler>();
    handlers.set("config/entity_registry/get", message => {
        const entityId = String(message.entity_id ?? "");
        const entry = registryEntries.find(candidate => candidate.entity_id === entityId);
        if (!entry) throw new Error(`mockHass: no registry entry for ${entityId}`);
        return entry;
    });
    handlers.set("config/entity_registry/list", () => registryEntries);
    handlers.set("config/entity_registry/get_entries", message => {
        const requested = (message.entity_ids ?? []) as string[];
        // Home Assistant core (`config/entity_registry.py`, `websocket_get_entities`) answers with
        // a plain object keyed by entity id and `null` for ids without a registry entry. It is not
        // `{ entries: [...] }`; production code in B7 will read this shape directly.
        const entries: Record<string, MockEntityRegistryEntry | null> = {};
        for (const entityId of requested) {
            entries[entityId] = registryEntries.find(candidate => candidate.entity_id === entityId) ?? null;
        }
        return entries;
    });
    handlers.set("frontend/get_translations", () => ({ resources: {} }));
    Object.entries(customHandlers).forEach(([type, handler]) => handlers.set(type, handler));

    return {
        handlers,
        callWS: async <T>(message: Record<string, unknown>): Promise<T> => {
            wsCalls.push({ type: String(message.type), message });
            const handler = handlers.get(String(message.type));
            if (!handler) {
                throw new Error(`mockHass: unhandled websocket command "${String(message.type)}"`);
            }
            return (await handler(message)) as T;
        },
    };
}

function makeSetWSHandler(
    router: MockRouter,
    customHandlers: Record<string, WSHandler>,
): MockHass["setWSHandler"] {
    return (type: string, handler: WSHandler): void => {
        customHandlers[type] = handler;
        router.handlers.set(type, handler);
    };
}

/**
 * Builds a `hass` object with the pieces this card reads. `callWS` serves the entity registry and
 * frontend translation commands and records every call in `hass.wsCalls`.
 */
export function mockHass(options: MockHassOptions = {}): MockHass {
    const language = options.language ?? DEFAULT_LANGUAGE;
    const registryEntries = toRegistryEntries(options.entities);
    const states = options.states ?? {};
    const wsCalls: WSCall[] = [];
    const customHandlers: Record<string, WSHandler> = { ...(options.callWS ?? {}) };
    const router = makeRouter(registryEntries, customHandlers, wsCalls);

    const hass = {
        states,
        entities: toDisplayRegistry(registryEntries),
        // Only `version` is populated: it is the one field of `hass.config` the card reads.
        config: { version: options.configVersion ?? DEFAULT_HA_VERSION },
        connected: true,
        language,
        locale: {
            language,
            number_format: NumberFormat.language,
            time_format: TimeFormat.language,
            first_weekday: FirstWeekday.language,
            ...options.locale,
        } as FrontendLocaleDataFixed,
        hassUrl: (path?: string): string => `${options.hassUrlBase ?? DEFAULT_HASS_URL}${path ?? ""}`,
        localize: makeLocalize(language),
        callService: vi.fn(async () => undefined),
        callWS: router.callWS,
        connection: makeConnection(),
        wsCalls,
        setWSHandler: makeSetWSHandler(router, customHandlers),
        resetWSCalls: (): void => {
            wsCalls.length = 0;
        },
        formatEntityState: (stateObj: HassEntity): string => stateObj.state,
        formatEntityAttributeValue: (stateObj: HassEntity, attribute: string): string =>
            String(stateObj.attributes[attribute] ?? ""),
        formatEntityAttributeName: (_stateObj: HassEntity, attribute: string): string => attribute,
        formatEntityName: (stateObj: HassEntity): string =>
            String(stateObj.attributes.friendly_name ?? stateObj.entity_id),
    };

    hassRuntimes.set(hass, { registryEntries, customHandlers, wsCalls });
    return hass as unknown as MockHass;
}

function mergeRegistryEntries(
    base: MockEntityRegistryEntry[],
    extra: MockEntityRegistryEntry[],
): MockEntityRegistryEntry[] {
    const merged = new Map(base.map(entry => [entry.entity_id, entry]));
    extra.forEach(entry => merged.set(entry.entity_id, entry));
    return [...merged.values()];
}

/**
 * Returns a new hass whose entity registry adds `entries` to the one the original hass was built
 * with. Entries with an existing `entity_id` replace that entry; new ids are appended.
 *
 * `hass.entities`, `config/entity_registry/get` and `config/entity_registry/get_entries` all read
 * the merged list, so a derived hass is usable when a test needs a registry entry that
 * `mockHass` never saw. The #944 second vacuum is exactly that case. Patching `hass.entities`
 * directly (or copying it through `withState`) is not enough: the websocket router would still
 * answer from the original list and `get` would throw.
 *
 * The returned hass gets its own websocket call log and its own handler map; the original hass is
 * untouched and keeps recording its own calls.
 */
export function withRegistryEntries(hass: MockHass, entries: MockEntityRegistryInput): MockHass {
    const runtime = hassRuntimes.get(hass);
    if (!runtime) throw new Error("withRegistryEntries: hass was not created by mockHass");
    const registryEntries = mergeRegistryEntries(runtime.registryEntries, toRegistryEntries(entries));
    const customHandlers: Record<string, WSHandler> = { ...runtime.customHandlers };
    const wsCalls: WSCall[] = [];
    const router = makeRouter(registryEntries, customHandlers, wsCalls);
    const next = {
        ...hass,
        entities: toDisplayRegistry(registryEntries),
        callWS: router.callWS,
        wsCalls,
        setWSHandler: makeSetWSHandler(router, customHandlers),
        resetWSCalls: (): void => {
            wsCalls.length = 0;
        },
    };
    hassRuntimes.set(next, { registryEntries, customHandlers, wsCalls });
    return next as unknown as MockHass;
}

/**
 * Returns a new hass with a new state object for `entityId` only.
 *
 * `hasConfigOrAnyEntityChanged` compares watched states by reference, so every other state object
 * is kept identical on purpose: reusing the changed state would make a card look like it had not
 * updated, and rebuilding all states would make every entity look changed.
 *
 * `patch.attributes` replaces the attributes object wholesale; it is not merged key by key. Read
 * the previous attributes and spread them when only one key should change.
 *
 * `last_updated` is copied from the previous state unless the patch supplies it. This helper does
 * not advance the clock or bump `last_updated`, so tests that depend on freshness (the map refresh
 * policy in B6, for example) must pass their own timestamp.
 *
 * This helper cannot add a registry entry: the websocket router keeps its own list. Use
 * `withRegistryEntries` for that. Patching `hass.entities` here would leave
 * `config/entity_registry/get` answering from the original registry.
 */
export function withState(hass: MockHass, entityId: string, patch: Partial<HassEntity>): WithStateResult {
    const previous = hass.states[entityId];
    const base: HassEntity = previous ?? ({
        entity_id: entityId,
        state: "unknown",
        attributes: {},
        last_changed: "2026-01-01T00:00:00.000Z",
        last_updated: "2026-01-01T00:00:00.000Z",
        context: { id: `mock-${entityId}`, parent_id: null, user_id: null },
    } as HassEntity);
    const state: HassEntity = {
        ...base,
        ...patch,
        entity_id: entityId,
    } as HassEntity;
    const nextHass = {
        ...hass,
        states: { ...hass.states, [entityId]: state },
    } as MockHass;
    // The derived hass keeps the same registry and router, so a later `withRegistryEntries` can
    // start from it instead of losing the router state.
    const runtime = hassRuntimes.get(hass);
    if (runtime) hassRuntimes.set(nextHass, runtime);
    return { hass: nextHass, state };
}

export interface CameraEntityOptions {
    rooms?: Record<string, MapExtractorRoom>;
    calibration_points?: CalibrationPoint[];
    entity_picture?: string;
    last_updated?: string;
    entity_id?: string;
    friendly_name?: string;
    attributes?: Record<string, unknown>;
}

/** A plausible camera state object for the map source. */
export function cameraEntity(options: CameraEntityOptions = {}): HassEntity {
    const entityId = options.entity_id ?? "camera.vacuum_map";
    const lastUpdated = options.last_updated ?? "2026-11-01T10:00:00.000Z";
    const attributes: Record<string, unknown> = {
        friendly_name: options.friendly_name ?? "Vacuum map",
        entity_picture: options.entity_picture ?? "/api/camera_proxy/camera.vacuum_map?token=REDACTED_TOKEN",
        access_token: "REDACTED_TOKEN",
        ...options.attributes,
    };
    if (options.rooms !== undefined) attributes.rooms = options.rooms;
    if (options.calibration_points !== undefined) attributes.calibration_points = options.calibration_points;
    return {
        entity_id: entityId,
        state: "idle",
        attributes,
        last_changed: lastUpdated,
        last_updated: lastUpdated,
        context: { id: `fixture-${entityId}`, parent_id: null, user_id: null },
    } as HassEntity;
}

/** Default three-point affine calibration used by the synthetic fixture (1 px = 10 vacuum units). */
export function syntheticCalibrationPoints(): CalibrationPoint[] {
    return [
        { map: { x: 0, y: 0 }, vacuum: { x: 0, y: 0 } },
        { map: { x: 200, y: 0 }, vacuum: { x: 2000, y: 0 } },
        { map: { x: 0, y: 150 }, vacuum: { x: 0, y: 1500 } },
    ];
}

/**
 * Builds a `MapExtractorRoom` from the four bounds most maps expose. The type requires every
 * field to be present (possibly `undefined`), which is why fixtures must not use object literals.
 */
export function extractorRoom(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    name?: string,
): MapExtractorRoom {
    return {
        x0,
        y0,
        x1,
        y1,
        name,
        icon: undefined,
        outline: undefined,
        x: undefined,
        y: undefined,
    };
}

/** Room bounds in vacuum coordinates for the synthetic fixture's three-colour map. */
export function syntheticRooms(): Record<string, MapExtractorRoom> {
    return {
        "0": extractorRoom(200, 200, 800, 700, "Kitchen"),
        "1": extractorRoom(1000, 200, 1700, 700, "Living room"),
        "2": extractorRoom(200, 900, 800, 1300, "Bedroom"),
    };
}

/** Language used by tests unless a test overrides it. */
export const DEFAULT_TEST_LANGUAGE: Language = "en";
