import { HomeAssistant } from "custom-card-helpers";
import { compare } from "compare-versions";
import { HassEntity } from "home-assistant-js-websocket";

import { EntityRegistryEntry, TileConfig } from "../../types/types";
import { localize } from "../../localize/localize";
import { getAllEntitiesFromTheSameDevice } from "../../utils";
import { PlatformGenerator } from "./platform-generator";

export class TilesGenerator {
    private static PLATFORMS_WITHOUT_ATTRIBUTES = [PlatformGenerator.DEFAULT_PLATFORM];

    public static generate(hass: HomeAssistant, vacuumEntity: string, platform: string): Promise<TileConfig[]> {
        const useNewGenerator = this.useNewGenerator(hass) && this.PLATFORMS_WITHOUT_ATTRIBUTES.includes(platform);

        const state = hass.states[vacuumEntity];
        const tiles: TileConfig[] = [];

        tiles.push(...this.getCommonTiles(state, vacuumEntity));
        if (useNewGenerator) {
            return this.addTilesFromSensors(hass, vacuumEntity, platform, tiles);
        } else {
            return new Promise<TileConfig[]>(resolve =>
                resolve(this.addTilesFromAttributes(state, vacuumEntity, platform, tiles)),
            );
        }
    }

    private static useNewGenerator(hass: HomeAssistant): boolean {
        return compare(hass.config.version, "2021.11.0", ">=");
    }

    private static getCommonTiles(state: HassEntity, vacuumEntity: string): TileConfig[] {
        const tiles: TileConfig[] = [];
        if ("status" in state.attributes)
            tiles.push({
                entity: vacuumEntity,
                label: localize("label.status"),
                attribute: "status",
                icon: "mdi:robot-vacuum",
            } as unknown as TileConfig);
        if ("battery_level" in state.attributes && "battery_icon" in state.attributes)
            tiles.push({
                entity: vacuumEntity,
                label: localize("label.battery_level"),
                attribute: "battery_level",
                icon: state.attributes["battery_icon"],
                unit: "%",
            } as unknown as TileConfig);
        if ("battery_level" in state.attributes && !("battery_icon" in state.attributes))
            tiles.push({
                entity: vacuumEntity,
                label: localize("label.battery_level"),
                attribute: "battery_level",
                icon: "mdi:battery",
                unit: "%",
            } as unknown as TileConfig);
        if ("fan_speed" in state.attributes)
            tiles.push({
                entity: vacuumEntity,
                label: localize("label.fan_speed"),
                attribute: "fan_speed",
                icon: "mdi:fan",
            } as unknown as TileConfig);
        return tiles;
    }

    private static addTilesFromAttributes(
        state: HassEntity,
        vacuumEntity: string,
        platform: string,
        tiles: TileConfig[],
    ): TileConfig[] {
        PlatformGenerator.getTilesFromAttributesTemplates(platform)
            .filter(t => t.attribute in state.attributes)
            .forEach(t =>
                tiles.push({
                    entity: vacuumEntity,
                    label: localize(t.label),
                    attribute: t.attribute,
                    icon: t.icon,
                    unit: t.unit ? localize(t.unit) : undefined,
                    precision: t.precision,
                    multiplier: t.multiplier,
                }),
            );
        return tiles;
    }

    private static async addTilesFromSensors(
        hass: HomeAssistant,
        vacuumEntityId: string,
        platform: string,
        tiles: TileConfig[],
    ): Promise<TileConfig[]> {
        const entityRegistryEntries = (await getAllEntitiesFromTheSameDevice(hass, vacuumEntityId)).filter(
            e => e.disabled_by === null,
        );
        const vacuumUniqueId = entityRegistryEntries.filter(e => e.entity_id === vacuumEntityId)[0].unique_id;
        PlatformGenerator.getTilesFromSensorsTemplates(platform)
            .map(t => ({
                tile: t,
                entity: entityRegistryEntries.filter(e => e.unique_id === `${t.unique_id_prefix}${vacuumUniqueId}`),
            }))
            .flatMap(v => v.entity.map(e => this.mapToTile(e, v.tile.label, v.tile.unit, v.tile.multiplier)))
            .forEach(t => tiles.push(t));
        return new Promise<TileConfig[]>(resolve => resolve(tiles));
    }

    private static mapToTile(e: EntityRegistryEntry, label: string, unit?: string, multiplier?: number): TileConfig {
        return {
            entity: e.entity_id,
            label: localize(label),
            icon: e.icon ?? e.original_icon,
            multiplier: multiplier ? multiplier : undefined,
            precision: multiplier ? 1 : undefined,
            unit: unit ? localize(unit) : undefined,
        };
    }
}
