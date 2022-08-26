import { HomeAssistant } from "custom-card-helpers";
import { HassEntity } from "home-assistant-js-websocket";

import {
    EntityRegistryEntry,
    Language,
    ReplacedKey,
    TileConfig,
    TileFromAttributeTemplate,
    TileFromSensorTemplate,
    TileTemplate,
} from "../../types/types";
import { localize } from "../../localize/localize";
import { getAllEntitiesFromTheSameDevice, getFilledTemplate } from "../../utils";
import { PlatformGenerator } from "./platform-generator";
import { TemplatableTileValue } from "../map_mode/templatable-value";

export class TilesGenerator {
    public static generate(
        hass: HomeAssistant,
        vacuumEntity: string,
        platform: string,
        language: Language,
    ): Promise<TileConfig[]> {
        if (!hass) return new Promise<TileConfig[]>(resolve => resolve([]));
        const useNewGenerator = PlatformGenerator.usesSensors(hass, platform);

        const state = hass.states[vacuumEntity];
        const tiles: TileConfig[] = [];
        if (!state) {
            return new Promise<TileConfig[]>(resolve => resolve(tiles));
        }

        tiles.push(...this.getCommonTiles(state, vacuumEntity, language));
        if (useNewGenerator) {
            return this.addTilesFromSensors(hass, vacuumEntity, platform, tiles, language);
        } else {
            return new Promise<TileConfig[]>(resolve =>
                resolve(this.addTilesFromAttributes(state, vacuumEntity, platform, tiles, language)),
            );
        }
    }

    private static getCommonTiles(state: HassEntity, vacuumEntity: string, language: Language): TileConfig[] {
        const tiles: TileConfig[] = [];
        if ("status" in state.attributes)
            tiles.push({
                entity: vacuumEntity,
                label: localize("tile.status.label", language),
                attribute: "status",
                icon: "mdi:robot-vacuum",
                translations: this.generateTranslationKeys(
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
                entity: vacuumEntity,
                label: localize("tile.battery_level.label", language),
                attribute: "battery_level",
                icon: state.attributes["battery_icon"],
                unit: "%",
            });
        if ("battery_level" in state.attributes && !("battery_icon" in state.attributes))
            tiles.push({
                entity: vacuumEntity,
                label: localize("tile.battery_level.label", language),
                attribute: "battery_level",
                icon: "mdi:battery",
                unit: "%",
            });
        if ("fan_speed" in state.attributes)
            tiles.push({
                entity: vacuumEntity,
                label: localize("tile.fan_speed.label", language),
                attribute: "fan_speed",
                icon: "mdi:fan",
                translations: this.generateTranslationKeys(
                    ["silent", "standard", "medium", "turbo", "auto", "gentle"],
                    "fan_speed",
                    language,
                ),
            });
        return tiles;
    }

    private static addTilesFromAttributes(
        state: HassEntity,
        vacuumEntity: string,
        platform: string,
        tiles: TileConfig[],
        language: Language,
    ): TileConfig[] {
        PlatformGenerator.getTilesFromAttributesTemplates(platform)
            .filter(t => t.attribute in state.attributes)
            .forEach(t => tiles.push(this.mapAttributeToTile(vacuumEntity, t, language)));
        return tiles;
    }

    private static async addTilesFromSensors(
        hass: HomeAssistant,
        vacuumEntityId: string,
        platform: string,
        tiles: TileConfig[],
        language: Language,
    ): Promise<TileConfig[]> {
        let entityRegistryEntries;
        try {
            entityRegistryEntries = (await getAllEntitiesFromTheSameDevice(hass, vacuumEntityId)).filter(
                e => e.disabled_by === null,
            );
        } catch {
            entityRegistryEntries = [];
        }
        if (entityRegistryEntries.length > 0) {
            PlatformGenerator.getTilesFromSensorsTemplates(platform)
                .map(t => ({
                    tile: t,
                    entity: entityRegistryEntries.filter(e => e.unique_id.match(t.unique_id_regex)),
                }))
                .flatMap(v => v.entity.map(e => this.mapEntryToTile(vacuumEntityId, e, v.tile, language)))
                .forEach(t => tiles.push(t));
        }
        return new Promise<TileConfig[]>(resolve => resolve(tiles));
    }

    private static mapEntryToTile(
        vacuum_entity_id: string,
        entry: EntityRegistryEntry,
        tile_template: TileFromSensorTemplate,
        language: Language,
    ): TileConfig {
        return this.mapToTile(
            tile_template,
            vacuum_entity_id,
            entry.entity_id,
            undefined,
            tile_template.icon ?? entry.icon ?? entry.original_icon,
            language,
        );
    }

    private static mapAttributeToTile(
        entity_id: string,
        tile_template: TileFromAttributeTemplate,
        language: Language,
    ): TileConfig {
        return this.mapToTile(
            tile_template,
            entity_id,
            entity_id,
            tile_template.attribute,
            tile_template.icon,
            language,
        );
    }

    private static mapToTile(
        tileTemplate: TileTemplate,
        vacuum_entity_id: string,
        entity_id: string,
        attribute: string | undefined,
        icon: string,
        language: Language,
    ): TileConfig {
        const tileConfig: TileConfig = {
            ...tileTemplate,
            entity: entity_id,
            label: localize(tileTemplate.label, language),
            attribute: attribute,
            icon: icon,
            unit: tileTemplate.unit ? localize(tileTemplate.unit, language) : undefined,
            precision: tileTemplate.precision ? tileTemplate.precision : 0,
            multiplier: tileTemplate.multiplier ? tileTemplate.multiplier : undefined,
            translations: this.generateTranslationKeys(
                tileTemplate.translation_keys ?? [],
                tileTemplate.tile_id,
                language,
            ),
        };
        return getFilledTemplate(this.cleanup(tileConfig), v =>
            TilesGenerator.getReplacedValue(v, vacuum_entity_id, entity_id, attribute),
        ) as unknown as TileConfig;
    }

    private static generateTranslationKeys(
        keys: Array<string>,
        tile: string | undefined,
        language: Language,
    ): Record<string, string> {
        const output = {};
        if (tile) {
            keys.forEach(k => {
                const translation = localize(`tile.${tile}.value.${k}`, language, "");
                if (translation) output[k] = translation;
            });
        }
        return output;
    }

    private static cleanup(tileConfig: TileTemplate): Record<string, unknown> {
        const toRemove = ["unique_id_regex", "translation_keys", "tile_id"];
        const e = tileConfig as unknown as Record<string, unknown>;
        for (const key in e) {
            if (e.hasOwnProperty(key) && toRemove.includes(key)) {
                delete e[key];
            }
        }
        return e;
    }

    private static getReplacedValue(
        value: string,
        vacuumEntity: string,
        entityId?: string,
        attribute = "",
    ): ReplacedKey {
        switch (value) {
            case TemplatableTileValue.ENTITY_ID:
                return entityId ?? vacuumEntity;
            case TemplatableTileValue.VACUUM_ENTITY:
                return vacuumEntity;
            case TemplatableTileValue.ATTRIBUTE:
                return attribute;
            default:
                return value;
        }
    }
}
