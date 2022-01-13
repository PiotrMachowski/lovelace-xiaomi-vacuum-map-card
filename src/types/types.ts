import { ActionConfig, LovelaceCard, LovelaceCardConfig, LovelaceCardEditor } from "custom-card-helpers";
import { ACTION_HANDLER_CUSTOM_ELEMENT_NAME, CARD_CUSTOM_ELEMENT_NAME, EDITOR_CUSTOM_ELEMENT_NAME } from "../const";
import { XiaomiVacuumMapCardActionHandler } from "../action-handler-directive";
import { XiaomiVacuumMapCard } from "../xiaomi-vacuum-map-card";

declare global {
    interface HTMLElementTagNameMap {
        [CARD_CUSTOM_ELEMENT_NAME]: XiaomiVacuumMapCard;
        [EDITOR_CUSTOM_ELEMENT_NAME]: LovelaceCardEditor;
        [ACTION_HANDLER_CUSTOM_ELEMENT_NAME]: XiaomiVacuumMapCardActionHandler;
        "hui-error-card": LovelaceCard;
    }
}

export type RectangleType = [PointType, PointType, PointType, PointType];
export type ZoneType = [number, number, number, number];
export type ZoneWithRepeatsType = [number, number, number, number, number];
export type PointType = [number, number];
export type PointWithRepeatsType = [number, number, number];
export type PredefinedSelectionConfig = PredefinedZoneConfig | PredefinedPointConfig | RoomConfig;
export type TranslatableString = string | [string, string, string];
export type Language = string | undefined;
export type EntityRegistryEntry = {
    entity_id: string;
    original_icon: string;
    icon?: string;
    unique_id: string;
    disabled_by?: string;
};

export interface XiaomiVacuumMapCardConfig extends LovelaceCardConfig, CardPresetConfig {
    readonly title?: string;
    readonly additional_presets?: CardPresetConfig[];
    readonly language?: Language;
    readonly debug?: boolean;
}

export interface CardPresetConfig extends ConditionalObjectConfig {
    readonly preset_name?: string;
    readonly entity: string;
    readonly vacuum_platform?: string;
    readonly map_source: MapSourceConfig;
    readonly map_locked?: boolean;
    readonly two_finger_pan?: boolean;
    readonly calibration_source: CalibrationSourceConfig;
    readonly icons?: IconActionConfig[];
    readonly append_icons?: boolean;
    readonly tiles?: TileConfig[];
    readonly append_tiles?: boolean;
    readonly map_modes?: MapModeConfig[];
    readonly activate?: ServiceCallSchemaConfig;
    readonly activate_on_switch?: boolean;
    readonly clean_selection_on_start?: boolean;
}

export interface MapSourceConfig {
    readonly camera?: string;
    readonly image?: string;
    readonly crop?: MapCroppingConfig;
}

export interface CalibrationSourceConfig {
    readonly camera?: boolean;
    readonly identity?: boolean;
    readonly entity?: string;
    readonly attribute?: string;
    readonly calibration_points?: CalibrationPoint[];
}

export interface MapModeConfig {
    readonly template?: string;
    readonly name?: string;
    readonly icon?: string;
    readonly run_immediately?: boolean;
    readonly coordinates_rounding?: boolean;
    readonly selection_type?: string;
    readonly max_selections?: number;
    readonly repeats_type?: string;
    readonly max_repeats?: number;
    readonly service_call_schema?: ServiceCallSchemaConfig;
    readonly predefined_selections?: PredefinedSelectionConfig[];
}

export interface PlatformTemplate {
    readonly map_modes: {
        readonly defaultTemplates: string[];
        readonly templates: { [templateName: string]: MapModeConfig };
    };
    readonly sensors_from?: string;
    readonly tiles: {
        readonly from_attributes?: TileFromAttributeTemplate[];
        readonly from_sensors?: TileFromSensorTemplate[];
    };
}

export interface TileFromAttributeTemplate {
    readonly attribute: string;
    readonly label: string;
    readonly icon: string;
    readonly unit?: string;
    readonly multiplier?: number;
    readonly precision?: number;
}

export interface TileFromSensorTemplate {
    readonly unique_id_prefix: string;
    readonly label: string;
    readonly unit?: string;
    readonly multiplier?: number;
    readonly precision?: number;
}

export interface IconActionConfig extends ActionableObjectConfig, ConditionalObjectConfig {
    readonly icon: string;
    readonly tooltip?: string;
}

export interface TileConfig extends ActionableObjectConfig, ConditionalObjectConfig {
    readonly label: string;
    readonly tooltip?: string;
    readonly icon?: string;
    readonly entity: string;
    readonly attribute?: string;
    readonly unit?: string;
    readonly multiplier?: number;
    readonly precision?: number;
    readonly translations?: Record<string, string>;
}

export interface ActionableObjectConfig {
    readonly tap_action?: ActionConfig;
    readonly hold_action?: ActionConfig;
    readonly double_tap_action?: ActionConfig;
}

export interface ConditionalObjectConfig {
    readonly conditions?: ConditionConfig[];
}

export interface ConditionConfig {
    readonly entity: string;
    readonly attribute?: string;
    readonly value?: string;
    readonly value_not?: string;
}

export interface CalibrationPoint {
    readonly vacuum: Point;
    readonly map: Point;
}

export interface Point {
    readonly x: number;
    readonly y: number;
}

export interface PredefinedZoneConfig {
    readonly zones: ZoneType[] | string;
    readonly label?: LabelConfig;
    readonly icon?: IconConfig;
}

export interface PredefinedPointConfig {
    readonly position: PointType | string;
    readonly label?: LabelConfig;
    readonly icon?: IconConfig;
}

export interface RoomConfig {
    readonly id: number | string;
    readonly outline?: [number, number][];
    readonly label?: LabelConfig;
    readonly icon?: IconConfig;
}

export interface LabelConfig {
    readonly text: string;
    readonly x: number;
    readonly y: number;
    readonly offset_x?: number;
    readonly offset_y?: number;
}

export interface IconConfig {
    readonly name: string;
    readonly x: number;
    readonly y: number;
}

export interface ServiceCallSchemaConfig {
    readonly service: string;
    readonly service_data?: Record<string, unknown>;
    readonly target?: Record<string, unknown>;
}

export interface MapCroppingConfig {
    readonly top?: number;
    readonly bottom?: number;
    readonly left?: number;
    readonly right?: number;
}
