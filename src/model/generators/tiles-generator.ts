import { HomeAssistant } from "custom-card-helpers";
import { HassEntity } from "home-assistant-js-websocket";

import {
    EntityRegistryEntry,
    Language,
    TileConfig,
    TileFromAttributeTemplate,
    TileFromSensorTemplate,
} from "../../types/types";
import { localize } from "../../localize/localize";
import { getAllEntitiesFromTheSameDevice } from "../../utils";
import { PlatformGenerator } from "./platform-generator";

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
                .flatMap(v => v.entity.map(e => this.mapEntryToTile(e, v.tile, language)))
                .forEach(t => tiles.push(t));
        }
        return new Promise<TileConfig[]>(resolve => resolve(tiles));
    }

    private static mapEntryToTile(
        entry: EntityRegistryEntry,
        tile_template: TileFromSensorTemplate,
        language: Language,
    ): TileConfig {
        return this.mapToTile(
            entry.entity_id,
            undefined,
            tile_template.label,
            entry.icon ?? entry.original_icon,
            tile_template.unit,
            tile_template.multiplier,
            tile_template.precision,
            tile_template.translation_keys,
            tile_template.tile_id,
            language,
        );
    }

    private static mapAttributeToTile(
        entity_id: string,
        tile_template: TileFromAttributeTemplate,
        language: Language,
    ): TileConfig {
        return this.mapToTile(
            entity_id,
            tile_template.attribute,
            tile_template.label,
            tile_template.icon,
            tile_template.unit,
            tile_template.multiplier,
            tile_template.precision,
            tile_template.translation_keys,
            tile_template.tile_id,
            language,
        );
    }

    private static mapToTile(
        entity_id: string,
        attribute: string | undefined,
        label: string,
        icon: string,
        unit: string | undefined,
        multiplier: number | undefined,
        precision: number | undefined,
        translation_keys: Array<string> | undefined,
        tile_id: string | undefined,
        language: Language,
    ): TileConfig {
        return {
            entity: entity_id,
            label: localize(label, language),
            attribute: attribute,
            icon: icon,
            unit: unit ? localize(unit, language) : undefined,
            precision: precision ? precision : 0,
            multiplier: multiplier ? multiplier : undefined,
            translations: this.generateTranslationKeys(translation_keys ?? [], tile_id, language),
        };
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
}
