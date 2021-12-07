import { HomeAssistant } from "custom-card-helpers";

import { IconActionConfig, Language } from "../../types/types";
import { localize } from "../../localize/localize";

export class IconListGenerator {
    private static _ICON_MAPPING = {
        Silent: "mdi:fan-remove",
        Standard: "mdi:fan-speed-1",
        Medium: "mdi:fan-speed-2",
        Turbo: "mdi:fan-speed-3",
        Auto: "mdi:fan-auto",
        Gentle: "mdi:waves",
    };

    public static generate(hass: HomeAssistant, vacuumEntity: string, language: Language): IconActionConfig[] {
        if (!hass) return [];
        const state = hass.states[vacuumEntity];
        const icons: IconActionConfig[] = [];
        icons.push({
            icon: "mdi:play",
            conditions: [
                {
                    entity: vacuumEntity,
                    value_not: "cleaning",
                },
                {
                    entity: vacuumEntity,
                    value_not: "error",
                },
                {
                    entity: vacuumEntity,
                    value_not: "returning",
                },
            ],
            tooltip: localize("icon.vacuum_start", language),
            tap_action: {
                action: "call-service",
                service: "vacuum.start",
                service_data: {
                    entity_id: vacuumEntity,
                },
            },
        } as unknown as IconActionConfig);
        icons.push({
            icon: "mdi:pause",
            conditions: [
                {
                    entity: vacuumEntity,
                    value_not: "docked",
                },
                {
                    entity: vacuumEntity,
                    value_not: "idle",
                },
                {
                    entity: vacuumEntity,
                    value_not: "error",
                },
                {
                    entity: vacuumEntity,
                    value_not: "paused",
                },
            ],
            tooltip: localize("icon.vacuum_pause", language),
            tap_action: {
                action: "call-service",
                service: "vacuum.pause",
                service_data: {
                    entity_id: vacuumEntity,
                },
            },
        } as unknown as IconActionConfig);
        icons.push({
            icon: "mdi:stop",
            conditions: [
                {
                    entity: vacuumEntity,
                    value_not: "docked",
                },
                {
                    entity: vacuumEntity,
                    value_not: "idle",
                },
                {
                    entity: vacuumEntity,
                    value_not: "error",
                },
                {
                    entity: vacuumEntity,
                    value_not: "paused",
                },
            ],
            tooltip: localize("icon.vacuum_stop", language),
            tap_action: {
                action: "call-service",
                service: "vacuum.stop",
                service_data: {
                    entity_id: vacuumEntity,
                },
            },
        } as unknown as IconActionConfig);
        icons.push({
            icon: "mdi:home-map-marker",
            conditions: [
                {
                    entity: vacuumEntity,
                    value_not: "docked",
                },
                {
                    entity: vacuumEntity,
                    value_not: "returning",
                },
            ],
            tooltip: localize("icon.vacuum_return_to_base", language),
            tap_action: {
                action: "call-service",
                service: "vacuum.return_to_base",
                service_data: {
                    entity_id: vacuumEntity,
                },
            },
        } as unknown as IconActionConfig);
        icons.push({
            icon: "mdi:target-variant",
            conditions: [
                {
                    entity: vacuumEntity,
                    value_not: "docked",
                },
                {
                    entity: vacuumEntity,
                    value_not: "error",
                },
                {
                    entity: vacuumEntity,
                    value_not: "cleaning",
                },
                {
                    entity: vacuumEntity,
                    value_not: "returning",
                },
            ],
            tooltip: localize("icon.vacuum_clean_spot", language),
            tap_action: {
                action: "call-service",
                service: "vacuum.clean_spot",
                service_data: {
                    entity_id: vacuumEntity,
                },
            },
        } as unknown as IconActionConfig);
        icons.push({
            icon: "mdi:map-marker",
            tooltip: localize("icon.vacuum_locate", language),
            tap_action: {
                action: "call-service",
                service: "vacuum.locate",
                service_data: {
                    entity_id: vacuumEntity,
                },
            },
        } as unknown as IconActionConfig);

        const fanSpeeds = state && state.attributes ? state.attributes["fan_speed_list"] : [];
        for (let i = 0; i < fanSpeeds.length; i++) {
            const fanSpeed = fanSpeeds[i];
            const nextFanSpeed = fanSpeeds[(i + 1) % fanSpeeds.length];
            icons.push({
                icon: fanSpeed in this._ICON_MAPPING ? this._ICON_MAPPING[fanSpeed] : "mdi:fan-alert",
                conditions: [
                    {
                        entity: vacuumEntity,
                        attribute: "fan_speed",
                        value: fanSpeed,
                    },
                ],
                tooltip: localize("icon.vacuum_set_fan_speed", language),
                tap_action: {
                    action: "call-service",
                    service: "vacuum.set_fan_speed",
                    service_data: {
                        entity_id: vacuumEntity,
                        fan_speed: nextFanSpeed,
                    },
                },
            } as unknown as IconActionConfig);
        }
        return icons;
    }
}
