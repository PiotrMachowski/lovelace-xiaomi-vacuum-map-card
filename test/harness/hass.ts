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

const DEFAULT_LANGUAGE = "en";
const DEFAULT_HASS_URL = "http://homeassistant.local:8123";

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
 * Builds a `hass` object with the pieces this card reads. `callWS` serves the entity registry and
 * frontend translation commands and records every call in `hass.wsCalls`.
 */
export function mockHass(options: MockHassOptions = {}): MockHass {
    const language = options.language ?? DEFAULT_LANGUAGE;
    const registryEntries = toRegistryEntries(options.entities);
    const states = options.states ?? {};
    const wsCalls: WSCall[] = [];

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
        return {
            entries: registryEntries.filter(entry => requested.includes(entry.entity_id)),
        };
    });
    handlers.set("frontend/get_translations", () => ({ resources: {} }));
    Object.entries(options.callWS ?? {}).forEach(([type, handler]) => handlers.set(type, handler));

    const hass = {
        states,
        entities: toDisplayRegistry(registryEntries),
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
        callWS: async <T>(message: Record<string, unknown>): Promise<T> => {
            wsCalls.push({ type: String(message.type), message });
            const handler = handlers.get(String(message.type));
            if (!handler) {
                throw new Error(`mockHass: unhandled websocket command "${String(message.type)}"`);
            }
            return (await handler(message)) as T;
        },
        connection: makeConnection(),
        wsCalls,
        setWSHandler: (type: string, handler: WSHandler): void => {
            handlers.set(type, handler);
        },
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

    return hass as unknown as MockHass;
}

/**
 * Returns a new hass with a new state object for `entityId` only.
 *
 * `hasConfigOrAnyEntityChanged` compares watched states by reference, so every other state object
 * is kept identical on purpose: reusing the changed state would make a card look like it had not
 * updated, and rebuilding all states would make every entity look changed.
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
    return {
        hass: {
            ...hass,
            states: { ...hass.states, [entityId]: state },
        } as MockHass,
        state,
    };
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
