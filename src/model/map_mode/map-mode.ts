import { SelectionType } from "./selection-type";
import { RepeatsType } from "./repeats-type";
import { ServiceCallSchema } from "./service-call-schema";
import { Language, MapModeConfig, PredefinedSelectionConfig, ServiceCallSchemaConfig } from "../../types/types";
import { localize } from "../../localize/localize";
import { ServiceCall } from "./service-call";
import { PlatformGenerator } from "../generators/platform-generator";

export class MapMode {
    private static readonly PREDEFINED_SELECTION_TYPES = [
        SelectionType.PREDEFINED_RECTANGLE,
        SelectionType.ROOM,
        SelectionType.PREDEFINED_POINT,
    ];

    public name: string;
    public icon: string;
    public selectionType: SelectionType;
    public maxSelections: number;
    public coordinatesRounding: boolean;
    public runImmediately: boolean;
    public repeatsType: RepeatsType;
    public maxRepeats: number;
    public serviceCallSchema: ServiceCallSchema;
    public predefinedSelections: PredefinedSelectionConfig[];

    constructor(vacuumPlatform: string, public readonly config: MapModeConfig, language: Language) {
        this.name = config.name ?? localize("map_mode.invalid", language);
        this.icon = config.icon ?? "mdi:help";
        this.selectionType = config.selection_type
            ? SelectionType[config.selection_type]
            : SelectionType.PREDEFINED_POINT;
        this.maxSelections = config.max_selections ?? 999;
        this.coordinatesRounding = config.coordinates_rounding ?? true;
        this.runImmediately = config.run_immediately ?? false;
        this.repeatsType = config.repeats_type ? RepeatsType[config.repeats_type] : RepeatsType.NONE;
        this.maxRepeats = config.max_repeats ?? 1;
        this.serviceCallSchema = new ServiceCallSchema(config.service_call_schema ?? ({} as ServiceCallSchemaConfig));
        this.predefinedSelections = config.predefined_selections ?? [];
        this._applyTemplateIfPossible(vacuumPlatform, config, language);
        if (!MapMode.PREDEFINED_SELECTION_TYPES.includes(this.selectionType)) {
            this.runImmediately = false;
        }
    }

    private _applyTemplateIfPossible(vacuumPlatform: string, config: MapModeConfig, language: Language): void {
        if (!config.template || !PlatformGenerator.isValidModeTemplate(vacuumPlatform, config.template)) return;
        const templateValue = PlatformGenerator.getModeTemplate(vacuumPlatform, config.template);
        if (!config.name && templateValue.name) this.name = localize(templateValue.name, language);
        if (!config.icon && templateValue.icon) this.icon = templateValue.icon;
        if (!config.selection_type && templateValue.selection_type)
            this.selectionType = SelectionType[templateValue.selection_type];
        if (!config.max_selections && templateValue.max_selections) this.maxSelections = templateValue.max_selections;
        if (config.coordinates_rounding === undefined && templateValue.coordinates_rounding !== undefined)
            this.coordinatesRounding = templateValue.coordinates_rounding;
        if (config.run_immediately === undefined && templateValue.run_immediately !== undefined)
            this.runImmediately = templateValue.run_immediately;
        if (!config.repeats_type && templateValue.repeats_type)
            this.repeatsType = RepeatsType[templateValue.repeats_type];
        if (!config.max_repeats && templateValue.max_repeats) this.maxRepeats = templateValue.max_repeats;
        if (!config.service_call_schema && templateValue.service_call_schema)
            this.serviceCallSchema = new ServiceCallSchema(templateValue.service_call_schema);
    }

    public getServiceCall(entityId: string, selection: unknown[], repeats: number): ServiceCall {
        return this.serviceCallSchema.apply(entityId, selection, repeats);
    }
}
