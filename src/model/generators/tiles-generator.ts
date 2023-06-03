import { HassEntity } from "home-assistant-js-websocket";

import {
    EntityRegistryEntry,
    Language,
    TileConfig,
    TileFromAttributeTemplate,
    TileFromSensorTemplate,
    TileTemplate,
    VariablesStorage,
} from "../../types/types";
import { localize } from "../../localize/localize";
import { getAllEntitiesFromTheSameDevice, getFilledTemplate } from "../../utils";
import { PlatformGenerator } from "./platform-generator";
import { TemplatableItemValue } from "../map_mode/templatable-value";
import { HomeAssistantFixed } from "../../types/fixes";
import { computeAttributeNameDisplay } from "../../localize/hass/compute_attribute_display";


class TilesGeneratorContext {
    private readonly _tiles: TileConfig[];
    private readonly _userDefinedTiles: TileConfig[];

    constructor(userDefinedTiles: TileConfig[]) {
        this._userDefinedTiles = userDefinedTiles;
        this._tiles = [];
    }

    public addTiles(tiles: TileConfig[]): void {
        tiles.forEach(t => this.addTile(t));
    }

    public addTile(tile: TileConfig): void {
        if (tile.tile_id && this._tiles.map(t => t.tile_id).includes(tile.tile_id)) {
            return;
        }
        if (tile.tile_id && this._userDefinedTiles.some(t => t.tile_id === tile.tile_id)) {
            this._userDefinedTiles.filter(t => t.tile_id === tile.tile_id).forEach(t => {
                if (t.replace_config) {
                    this._tiles.push({ ...tile, ...t });
                } else {
                    this._tiles.push(t);
                }
            });
            return;
        }
        this._tiles.push(tile);
    }

    public get tiles(): TileConfig[] {
        return this._tiles;
    }
}


export class TilesGenerator {
    public static async generate(
        hass: HomeAssistantFixed,
        vacuumEntity: string,
        platform: string,
        language: Language,
        tilesToOverride: TileConfig[],
        variables: VariablesStorage,
    ): Promise<TileConfig[]> {
        if (!hass) return new Promise<TileConfig[]>(resolve => resolve([]));
        const state = hass.states[vacuumEntity];
        const tiles: TileConfig[] = [];
        if (!state) {
            return tiles;
        }
        const context = new TilesGeneratorContext(tilesToOverride);
        context.addTiles(TilesGenerator.getCommonTiles(state, vacuumEntity, language));
        context.addTiles(await TilesGenerator.getTilesFromEntities(hass, vacuumEntity, platform, language, variables));
        context.addTiles(TilesGenerator.getTilesFromAttributes(hass, state, vacuumEntity, platform, language, variables));
        return context.tiles;
    }

    private static getCommonTiles(state: HassEntity, vacuumEntity: string, language: Language): TileConfig[] {
        const tiles: TileConfig[] = [];
        if ("status" in state.attributes)
            tiles.push({
                tile_id: "status",
                entity: vacuumEntity,
                label: localize("tile.status.label", language),
                attribute: "status",
                icon: "mdi:robot-vacuum",
                translations: TilesGenerator.generateTranslationKeys(
                    [
                        "starting",
                        "charger disconnected",
                        "idle",
                        "remote control active",
                        "cleaning",
                        "returning home",
                        "manual mode",
                        "charging",
                        "charging problem",
                        "paused",
                        "spot cleaning",
                        "error",
                        "shutting down",
                        "updating",
                        "docking",
                        "going to target",
                        "zoned cleaning",
                        "segment cleaning",
                        "emptying the bin",
                        "charging complete",
                        "device offline",
                    ],
                    "status",
                    language,
                ),
            });
        if ("battery_level" in state.attributes && "battery_icon" in state.attributes)
            tiles.push({
                tile_id: "battery_level",
                entity: vacuumEntity,
                label: localize("tile.battery_level.label", language),
                attribute: "battery_level",
                icon_source: `${vacuumEntity}.attributes.battery_icon`,
                unit: "%",
            });
        if ("battery_level" in state.attributes && !("battery_icon" in state.attributes))
            tiles.push({
                tile_id: "battery_level",
                entity: vacuumEntity,
                label: localize("tile.battery_level.label", language),
                attribute: "battery_level",
                icon: "mdi:battery",
                unit: "%",
            });
        if ("fan_speed" in state.attributes)
            tiles.push({
                tile_id: "fan_speed",
                entity: vacuumEntity,
                label: localize("tile.fan_speed.label", language),
                attribute: "fan_speed",
                icon: "mdi:fan",
                translations: TilesGenerator.generateTranslationKeys(
                    ["silent", "standard", "medium", "turbo", "auto", "gentle"],
                    "fan_speed",
                    language,
                ),
            });
        return tiles;
    }

    private static getTilesFromAttributes(
        hass: HomeAssistantFixed,
        state: HassEntity,
        vacuumEntity: string,
        platform: string,
        language: Language,
        variables: VariablesStorage,
    ): TileConfig[] {
        return PlatformGenerator.getTilesFromAttributesTemplates(platform)
            .filter(t => t.attribute in state.attributes)
            .map(t => TilesGenerator.mapAttributeToTile(hass, vacuumEntity, t, language, variables));
    }

    private static async getTilesFromEntities(
        hass: HomeAssistantFixed,
        vacuumEntityId: string,
        platform: string,
        language: Language,
        variables: VariablesStorage,
    ): Promise<TileConfig[]> {
        const entityRegistryEntries = await getAllEntitiesFromTheSameDevice(hass, vacuumEntityId);
        if (entityRegistryEntries.length > 0) {
            return PlatformGenerator.getTilesFromSensorsTemplates(platform)
                .map(t => ({
                    tile: t,
                    entity: entityRegistryEntries.filter(e => e.unique_id.match(t.unique_id_regex)),
                }))
                .flatMap(v => v.entity.map(e => TilesGenerator.mapEntryToTile(hass, vacuumEntityId, e, v.tile, language, variables)))
        }
        return [];
    }

    private static mapEntryToTile(
        hass: HomeAssistantFixed,
        vacuum_entity_id: string,
        entry: EntityRegistryEntry,
        tile_template: TileFromSensorTemplate,
        language: Language,
        variables: VariablesStorage,
    ): TileConfig {
        return TilesGenerator.mapToTile(
            hass,
            tile_template,
            vacuum_entity_id,
            entry.entity_id,
            undefined,
            tile_template.icon ?? entry.icon ?? entry.original_icon,
            language,
            variables,
        );
    }

    private static mapAttributeToTile(
        hass: HomeAssistantFixed,
        entity_id: string,
        tile_template: TileFromAttributeTemplate,
        language: Language,
        variables: VariablesStorage,
    ): TileConfig {
        return TilesGenerator.mapToTile(
            hass,
            tile_template,
            entity_id,
            entity_id,
            tile_template.attribute,
            tile_template.icon,
            language,
            variables,
        );
    }

    private static mapToTile(
        hass: HomeAssistantFixed,
        tileTemplate: TileTemplate,
        vacuum_entity_id: string,
        entity_id: string,
        attribute: string | undefined,
        icon: string,
        language: Language,
        variables: VariablesStorage,
    ): TileConfig {
        const tileConfig: TileConfig = {
            ...tileTemplate,
            entity: entity_id,
            label: TilesGenerator.getTileLabel(hass, tileTemplate, language, entity_id, attribute),
            attribute: attribute,
            icon: icon,
            unit: tileTemplate.unit ? localize(tileTemplate.unit, language) : undefined,
            precision: tileTemplate.precision ? tileTemplate.precision : 0,
            multiplier: tileTemplate.multiplier ? tileTemplate.multiplier : undefined,
            translations: TilesGenerator.generateTranslationKeys(
                tileTemplate.translation_keys ?? [],
                tileTemplate.tile_id,
                language,
            ),
        };
        return getFilledTemplate(
            TilesGenerator.cleanup(tileConfig),
            TilesGenerator.getDefaultVariables(vacuum_entity_id, entity_id, attribute),
            variables,
        ) as unknown as TileConfig;
    }

    private static getTileLabel(
        hass: HomeAssistantFixed,
        tile: TileConfig,
        language: Language,
        entity_id: string,
        attribute: string | undefined) {
        if (tile.label !== undefined)
            return localize(tile.label, language);
        if (attribute !== undefined)
            return computeAttributeNameDisplay(hass.localize, hass.states[entity_id], hass.entities, attribute);
        return hass.states[entity_id].attributes.friendly_name ?? entity_id;
    }

    private static generateTranslationKeys(
        keys: Array<string>,
        tile_id: string | undefined,
        language: Language,
    ): Record<string, string> {
        const output = {};
        if (tile_id) {
            keys.forEach(k => {
                const translation = localize(`tile.${tile_id}.value.${k}`, language, "");
                if (translation) output[k] = translation;
            });
        }
        return output;
    }

    private static cleanup(tileConfig: TileTemplate): Record<string, unknown> {
        const toRemove = ["unique_id_regex", "translation_keys"];
        const e = tileConfig as unknown as Record<string, unknown>;
        for (const key in e) {
            if (e.hasOwnProperty(key) && toRemove.includes(key)) {
                delete e[key];
            }
        }
        return e;
    }

    private static getDefaultVariables(
        vacuumEntity: string,
        entityId: string | undefined,
        attribute: string | undefined,
    ): VariablesStorage {
        const defaultVariables: VariablesStorage = {};
        defaultVariables[TemplatableItemValue.ENTITY_ID] = entityId ?? vacuumEntity;
        defaultVariables[TemplatableItemValue.VACUUM_ENTITY_ID] = vacuumEntity;
        defaultVariables[TemplatableItemValue.ATTRIBUTE] = attribute ?? "";
        return defaultVariables;
    }

}

export function sortTiles(t1: TileConfig, t2: TileConfig): number {
    if (t1.order === undefined && t2.order === undefined)
        return 0;
    if (t1.order === undefined)
        return 1;
    if (t2.order === undefined)
        return -1;
    return t1.order - t2.order;
}