import { ActionHandlerEvent, handleAction, HomeAssistant } from "custom-card-helpers";
import { PropertyValues } from "lit";

import {
    ActionableObjectConfig,
    ActionHandlerFunction,
    CardPresetConfig,
    ConditionalObjectConfig,
    ConditionConfig,
    EntityRegistryEntry,
    KeyReplacer,
    Language,
    PredefinedPointConfig,
    PredefinedZoneConfig,
    ReplacedKey,
    VariablesStorage,
    XiaomiVacuumMapCardConfig,
} from "./types/types";
import { MapMode } from "./model/map_mode/map-mode";
import { SelectionType } from "./model/map_mode/selection-type";
import { MousePosition } from "./model/map_objects/mouse-position";
import { XiaomiVacuumMapCard } from "./xiaomi-vacuum-map-card";
import { Modifier } from "./model/map_mode/modifier";
import { HomeAssistantFixed } from "./types/fixes";
import { ServiceCallSchema } from "./model/map_mode/service-call-schema";
import { TemplatableItemValue } from "./model/map_mode/templatable-value";
import { PlatformGenerator } from "./model/generators/platform-generator";

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
    if (config.calibration_source?.entity) {
        watchedEntities.add(config.calibration_source.entity);
    }
    (config.conditions ?? [])
        .map(c => c?.entity)
        .forEach(e => {
            if (e) watchedEntities.add(e);
        });
    (config.icons ?? []).forEach(i => {
        if (i.hasOwnProperty("entity")) watchedEntities.add(i["entity"]);
    });
    (config.icons ?? [])
        .filter(i => i.conditions)
        .flatMap(i => i.conditions)
        .map(c => c?.entity)
        .forEach(e => {
            if (e) watchedEntities.add(e);
        });
    (config.tiles ?? []).forEach(s => {
        if (s.entity) watchedEntities.add(s.entity);
    });
    (config.tiles ?? []).forEach(s => {
        if (s.icon_source) watchedEntities.add(s.icon_source.split(".attributes.")[0]);
    });
    (config.tiles ?? [])
        .filter(s => s.conditions)
        .flatMap(s => s.conditions)
        .map(c => c?.entity)
        .forEach(e => {
            if (e) watchedEntities.add(e);
        });
    (config.map_modes ?? [])
        .map(m => new MapMode(PlatformGenerator.getPlatformName(config.vacuum_platform), m, language))
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

export function isConditionMet(
    condition: ConditionConfig,
    internalVariables: VariablesStorage,
    hass: HomeAssistantFixed,
): boolean {
    let currentValue: ReplacedKey = "";
    if (condition.internal_variable && condition.internal_variable in internalVariables) {
        currentValue = internalVariables[condition.internal_variable];
    } else if (condition.entity) {
        currentValue = condition.attribute
            ? hass.states[condition.entity].attributes[condition.attribute]
            : hass.states[condition.entity].state;
    }
    if (condition.value) {
        return currentValue == condition.value;
    }
    if (condition.value_not) {
        return currentValue != condition.value_not;
    }
    return false;
}

export function areConditionsMet(
    config: ConditionalObjectConfig,
    internalVariables: VariablesStorage,
    hass: HomeAssistantFixed,
): boolean {
    return (config.conditions ?? []).every(condition => isConditionMet(condition, internalVariables, hass));
}

export function hasConfigOrAnyEntityChanged(
    watchedEntities: string[],
    changedProps: PropertyValues,
    forceUpdate: boolean,
    hass?: HomeAssistantFixed,
): boolean {
    if (changedProps.has("config") || forceUpdate) {
        return true;
    }
    const oldHass = changedProps.get("hass") as HomeAssistantFixed | undefined;
    return !oldHass || watchedEntities.some(entity => oldHass.states[entity] !== hass?.states[entity]);
}

export function conditional<T>(condition: boolean, content: () => T): T | null {
    return condition ? content() : null;
}

export function createActionWithConfigHandler(
    node: XiaomiVacuumMapCard,
    config: ActionableObjectConfig | undefined,
    action?: string,
): ActionHandlerFunction {
    if (action) {
        return (): void => handleActionWithConfig(node, config, action);
    }
    return (ev?: ActionHandlerEvent): void => handleActionWithConfig(node, config, ev?.detail?.action ?? "tap");
}

export function handleActionWithConfig(
    node: XiaomiVacuumMapCard,
    config: ActionableObjectConfig | undefined,
    action: string,
): void {
    if (node.hass && config && action) {
        const currentPreset = node._getCurrentPreset();
        const currentMode = node._getCurrentMode();
        let itemVariables = {};
        itemVariables[TemplatableItemValue.VACUUM_ENTITY_ID] = currentPreset.entity;
        if (config.hasOwnProperty("attribute")) {
            itemVariables[TemplatableItemValue.ATTRIBUTE] = config["attribute"];
        }
        if (config.hasOwnProperty("variables")) {
            itemVariables = { ...itemVariables, ...config["variables"] };
        }
        const entity_id = config.hasOwnProperty("entity") ? config["entity"] : currentPreset.entity;
        const { selection, variables } = node._getSelection(currentMode);
        const defaultVariables = ServiceCallSchema.getDefaultVariables(entity_id, selection, node.repeats);
        const filled = getFilledTemplate(config as Record<string, unknown>, defaultVariables, itemVariables,
            node.internalVariables, currentMode?.variables ?? {}, variables);
        handleAction(node, node.hass as unknown as HomeAssistant, filled as ActionableObjectConfig, action);
    }
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
    hass: HomeAssistantFixed,
    entity: string,
): Promise<EntityRegistryEntry[]> {
    let entityRegistryEntries;
    try {
        entityRegistryEntries = await _getAllEntitiesFromTheSameDevice(hass, entity);
    } catch {
        entityRegistryEntries = [];
    }
    return entityRegistryEntries;
}

async function _getAllEntitiesFromTheSameDevice(
    hass: HomeAssistantFixed,
    entity: string,
): Promise<EntityRegistryEntry[]> {
    const vacuumDeviceId = (
        await hass.callWS<EntityRegistryEntry>({
            type: "config/entity_registry/get",
            entity_id: entity,
        })
    )["device_id"];
    const vacuumSensors = (
        await hass.callWS<{ device_id: string; entity_id: string }[]>({
            type: "config/entity_registry/list",
        })
    ).filter(e => e.device_id === vacuumDeviceId);
    const allEntities = await Promise.all(
        vacuumSensors.map(vs =>
            hass.callWS<EntityRegistryEntry>({
                type: "config/entity_registry/get",
                entity_id: vs.entity_id,
            }),
        ),
    );
    return allEntities.filter(e => e.disabled_by == null);
}

export async function delay(ms: number): Promise<void> {
    await new Promise<void>(resolve => setTimeout(() => resolve(), ms));
}

export function copyMessage(val: string): void {
    const selBox = document.createElement("textarea");
    selBox.style.position = "fixed";
    selBox.style.left = "0";
    selBox.style.top = "0";
    selBox.style.opacity = "0";
    selBox.value = val;
    document.body.appendChild(selBox);
    selBox.focus();
    selBox.select();
    document.execCommand("copy");
    document.body.removeChild(selBox);
}

export async function evaluateJinjaTemplate(
    hass: HomeAssistantFixed,
    template: string,
): Promise<string | Record<string, unknown>> {
    return new Promise(resolve => {
        hass.connection.subscribeMessage((msg: { result: string | Record<string, unknown> }) => resolve(msg.result), {
            type: "render_template",
            template: template,
        });
    });
}

export function replaceInTarget(target: Record<string, unknown>, keyReplacer: KeyReplacer): void {
    for (const [key, value] of Object.entries(target)) {
        if (typeof value == "object") {
            replaceInTarget(value as Record<string, unknown>, keyReplacer);
        } else if (typeof value == "string") {
            target[key] = keyReplacer(value as string);
        }
    }
}

export function getReplacedValue(value: string, variables: VariablesStorage): ReplacedKey {
    const vars = Object.fromEntries(Object.entries(variables ?? {}).map(([k, v]) => [`[[${k}]]`, v]));
    const fullValueReplacer = (v: string): ReplacedKey | null => (v in vars ? vars[v] : null);
    return fullValueReplacer(value) ?? replaceInStr(value, vars, fullValueReplacer);
}

export function replaceInStr(
    value: string,
    variables: VariablesStorage,
    kr: (string) => ReplacedKey | null,
): ReplacedKey {
    let output = value;
    Object.keys(variables).forEach(tv => {
        let replaced = kr(tv);
        if (typeof replaced == "object") {
            replaced = JSON.stringify(replaced);
        }
        output = output.replaceAll(tv, `${replaced}`);
    });
    if (output.endsWith(Modifier.JSONIFY)) {
        return JSON.parse(output.replace(Modifier.JSONIFY, ""));
    }
    return output;
}

export function getFilledTemplate(
    template: Record<string, unknown>,
    ...variablesStorages: VariablesStorage[]
): ReplacedKey {
    const target = JSON.parse(JSON.stringify(template));
    let variables: VariablesStorage = {};
    for (const variablesStorage of variablesStorages) {
        variables = { ...variablesStorage, ...variables };
    }
    const keyReplacer = v => getReplacedValue(v, variables);
    replaceInTarget(target, keyReplacer);
    return target;
}
