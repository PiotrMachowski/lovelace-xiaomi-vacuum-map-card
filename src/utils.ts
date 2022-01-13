import { ActionHandlerEvent, handleAction, HomeAssistant } from "custom-card-helpers";
import { PropertyValues } from "lit";

import {
    ActionableObjectConfig,
    CardPresetConfig,
    ConditionalObjectConfig,
    ConditionConfig,
    EntityRegistryEntry,
    Language,
    PredefinedPointConfig,
    PredefinedZoneConfig,
    XiaomiVacuumMapCardConfig,
} from "./types/types";
import { MapMode } from "./model/map_mode/map-mode";
import { SelectionType } from "./model/map_mode/selection-type";
import { MousePosition } from "./model/map_objects/mouse-position";
import { XiaomiVacuumMapCard } from "./xiaomi-vacuum-map-card";

export function stopEvent(event: MouseEvent | TouchEvent): void {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
}

export function deleteFromArray<T>(array: T[], entry: T): number {
    const index = array.indexOf(entry, 0);
    if (index > -1) {
        array.splice(index, 1);
    }
    return index;
}

export function getWatchedEntitiesForMapMode(mapMode: MapMode): Set<string> {
    const watchedEntities = new Set<string>();
    switch (mapMode.selectionType) {
        case SelectionType.PREDEFINED_RECTANGLE:
            mapMode.predefinedSelections
                .map(m => m as PredefinedZoneConfig)
                .filter(p => typeof p.zones === "string")
                .forEach(p => watchedEntities.add((p.zones as string).split(".attributes.")[0]));
            break;
        case SelectionType.PREDEFINED_POINT:
            mapMode.predefinedSelections
                .map(m => m as PredefinedPointConfig)
                .filter(p => typeof p.position === "string")
                .forEach(p => watchedEntities.add((p.position as string).split(".attributes.")[0]));
            break;
    }
    return watchedEntities;
}

export function getWatchedEntitiesForPreset(config: CardPresetConfig, language: Language): Set<string> {
    const watchedEntities = new Set<string>();
    if (config.entity) {
        watchedEntities.add(config.entity);
    }
    if (config.map_source.camera) {
        watchedEntities.add(config.map_source.camera);
    }
    if (config.calibration_source.entity) {
        watchedEntities.add(config.calibration_source.entity);
    }
    (config.conditions ?? [])
        .map(c => c?.entity)
        .forEach(e => {
            if (e) watchedEntities.add(e);
        });
    (config.icons ?? [])
        .filter(i => i.conditions)
        .flatMap(i => i.conditions)
        .map(c => c?.entity)
        .forEach(e => {
            if (e) watchedEntities.add(e);
        });
    (config.tiles ?? []).forEach(s => watchedEntities.add(s.entity));
    (config.tiles ?? [])
        .filter(s => s.conditions)
        .flatMap(s => s.conditions)
        .map(c => c?.entity)
        .forEach(e => {
            if (e) watchedEntities.add(e);
        });
    (config.map_modes ?? [])
        .map(m => new MapMode(config.vacuum_platform ?? "default", m, language))
        .forEach(m => getWatchedEntitiesForMapMode(m).forEach(e => watchedEntities.add(e)));
    return watchedEntities;
}

export function getWatchedEntities(config: XiaomiVacuumMapCardConfig): string[] {
    const watchedEntities = new Set<string>();
    [config, ...(config.additional_presets ?? [])]
        .flatMap(p => [...getWatchedEntitiesForPreset(p, config.language)])
        .forEach(e => watchedEntities.add(e));
    return [...watchedEntities];
}

export function isConditionMet(condition: ConditionConfig, hass: HomeAssistant): boolean {
    const currentValue = condition.attribute
        ? hass.states[condition.entity].attributes[condition.attribute]
        : hass.states[condition.entity].state;
    if (condition.value) {
        return currentValue == condition.value;
    }
    if (condition.value_not) {
        return currentValue != condition.value_not;
    }
    return false;
}

export function areConditionsMet(config: ConditionalObjectConfig, hass: HomeAssistant): boolean {
    return (config.conditions ?? []).every(condition => isConditionMet(condition, hass));
}

export function hasConfigOrAnyEntityChanged(
    watchedEntities: string[],
    changedProps: PropertyValues,
    forceUpdate: boolean,
    hass?: HomeAssistant,
): boolean {
    if (changedProps.has("config") || forceUpdate) {
        return true;
    }
    const oldHass = changedProps.get("hass") as HomeAssistant | undefined;
    return !oldHass || watchedEntities.some(entity => oldHass.states[entity] !== hass?.states[entity]);
}

export function conditional<T>(condition: boolean, content: () => T): T | null {
    return condition ? content() : null;
}

export function handleActionWithConfig(
    node: XiaomiVacuumMapCard,
    config: ActionableObjectConfig | undefined,
): (ev: ActionHandlerEvent) => void {
    return (ev: ActionHandlerEvent): void => {
        if (node.hass && config && ev.detail.action) {
            handleAction(node, node.hass, config, ev.detail.action);
        }
    };
}

export function getMousePosition(
    event: MouseEvent | TouchEvent,
    element: SVGGraphicsElement,
    scale: number,
): MousePosition {
    let x, y;
    if (event instanceof MouseEvent) {
        x = event.offsetX;
        y = event.offsetY;
    }
    if (window.TouchEvent && event instanceof TouchEvent && event.touches) {
        x = (event.touches[0].clientX - element.getBoundingClientRect().x) / scale;
        y = (event.touches[0].clientY - element.getBoundingClientRect().y) / scale;
    }
    return new MousePosition(x, y);
}

export async function getAllEntitiesFromTheSameDevice(
    hass: HomeAssistant,
    entity: string,
): Promise<EntityRegistryEntry[]> {
    const vacuumConfigEntryId = (
        await hass.callWS<Map<string, unknown>>({
            type: "entity/source",
            entity_id: [entity],
        })
    )[entity]["config_entry"];
    const vacuumSensors = (
        await hass.callWS<{ config_entry_id: string; entity_id: string }[]>({
            type: "config/entity_registry/list",
        })
    ).filter(e => e.config_entry_id === vacuumConfigEntryId);
    return Promise.all(
        vacuumSensors.map(vs =>
            hass.callWS<EntityRegistryEntry>({
                type: "config/entity_registry/get",
                entity_id: vs.entity_id,
            }),
        ),
    );
}
