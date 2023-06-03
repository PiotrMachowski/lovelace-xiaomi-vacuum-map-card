import { SelectionType } from "./selection-type";
import { RepeatsType } from "./repeats-type";
import { ServiceCallSchema } from "./service-call-schema";
import {
    Language,
    MapModeConfig,
    PredefinedSelectionConfig,
    ServiceCallSchemaConfig,
    VariablesStorage,
} from "../../types/types";
import { localize } from "../../localize/localize";
import { ServiceCall } from "./service-call";
import { PlatformGenerator } from "../generators/platform-generator";
import { evaluateJinjaTemplate, replaceInTarget } from "../../utils";
import { Modifier } from "./modifier";
import { HomeAssistantFixed } from "../../types/fixes";

export class MapMode {
    private static readonly PREDEFINED_SELECTION_TYPES = [
        SelectionType.PREDEFINED_RECTANGLE,
        SelectionType.ROOM,
        SelectionType.PREDEFINED_POINT,
    ];

    public name: string;
    public icon: string;
    public selectionType: SelectionType;
    public idType?: "number" | "string";
    public maxSelections: number;
    public coordinatesRounding: boolean;
    public coordinatesToMetersDivider: number;
    public runImmediately: boolean;
    public repeatsType: RepeatsType;
    public maxRepeats: number;
    public serviceCallSchema: ServiceCallSchema;
    public predefinedSelections: PredefinedSelectionConfig[];
    public variables: VariablesStorage;

    constructor(vacuumPlatform: string, public readonly config: MapModeConfig, language: Language) {
        this.name = config.name ?? localize("map_mode.invalid", language);
        this.icon = config.icon ?? "mdi:help";
        this.idType = config.id_type;
        this.selectionType = config.selection_type
            ? SelectionType[config.selection_type]
            : SelectionType.PREDEFINED_POINT;
        this.maxSelections = config.max_selections ?? 999;
        this.coordinatesRounding = config.coordinates_rounding ?? true;
        this.coordinatesToMetersDivider = config.coordinates_to_meters_divider ?? 1000;
        this.runImmediately = config.run_immediately ?? false;
        this.repeatsType = config.repeats_type ? RepeatsType[config.repeats_type] : RepeatsType.NONE;
        this.maxRepeats = config.max_repeats ?? 1;
        this.serviceCallSchema = new ServiceCallSchema(config.service_call_schema ?? ({} as ServiceCallSchemaConfig));
        this.predefinedSelections = config.predefined_selections ?? [];
        this.variables = config.variables ?? {};
        this._applyTemplateIfPossible(vacuumPlatform, config, language);
        if (!MapMode.PREDEFINED_SELECTION_TYPES.includes(this.selectionType)) {
            this.runImmediately = false;
        }
    }

    public async getServiceCall(
        hass: HomeAssistantFixed,
        entityId: string,
        selection: unknown[],
        repeats: number,
        selectionVariables: VariablesStorage,
    ): Promise<ServiceCall> {
        let serviceCall = this._applyData(entityId, selection, repeats, selectionVariables);
        if (this.serviceCallSchema.evaluateDataAsTemplate) {
            try {
                const output = await evaluateJinjaTemplate(hass, JSON.stringify(serviceCall.serviceData));
                try {
                    const serviceData = typeof output === "string" ? JSON.parse(output) : output;
                    replaceInTarget(serviceData, v =>
                        v.endsWith(Modifier.JSONIFY_JINJA) ? JSON.parse(v.replace(Modifier.JSONIFY_JINJA, "")) : v,
                    );
                    serviceCall = { ...serviceCall, serviceData: serviceData };
                } catch (e) {
                    console.error("Failed to parse template output", output);
                    // noinspection ExceptionCaughtLocallyJS
                    throw e;
                }
            } catch {
                console.error("Failed to evaluate template", serviceCall.serviceData);
            }
        }
        return serviceCall;
    }

    public toMapModeConfig(): MapModeConfig {
        return {
            name: this.name,
            icon: this.icon,
            run_immediately: this.runImmediately,
            coordinates_rounding: this.coordinatesRounding,
            coordinates_to_meters_divider: this.coordinatesToMetersDivider,
            selection_type: SelectionType[this.selectionType],
            id_type: this.idType,
            max_selections: this.maxSelections,
            repeats_type: RepeatsType[this.repeatsType],
            max_repeats: this.maxRepeats,
            service_call_schema: JSON.parse(JSON.stringify(this.serviceCallSchema.config)),
            predefined_selections: this.predefinedSelections,
            variables: Object.fromEntries(
                Object.entries(this.variables ?? {}).map(([k, v]) => [k.substr(2, k.length - 4), v]),
            ),
        };
    }

    private _applyTemplateIfPossible(vacuumPlatform: string, config: MapModeConfig, language: Language): void {
        if (!config.template || !PlatformGenerator.isValidModeTemplate(vacuumPlatform, config.template)) return;
        const templateValue = PlatformGenerator.getModeTemplate(vacuumPlatform, config.template);
        if (!config.name && templateValue.name) this.name = localize(templateValue.name, language);
        if (!config.icon && templateValue.icon) this.icon = templateValue.icon;
        if (!config.selection_type && templateValue.selection_type)
            this.selectionType = SelectionType[templateValue.selection_type];
        if (!config.id_type && templateValue.id_type)
            this.idType = templateValue.id_type;
        if (!config.max_selections && templateValue.max_selections) this.maxSelections = templateValue.max_selections;
        if (config.coordinates_rounding === undefined && templateValue.coordinates_rounding !== undefined)
            this.coordinatesRounding = templateValue.coordinates_rounding;
        if (config.coordinates_to_meters_divider === undefined && templateValue.coordinates_to_meters_divider !== undefined)
            this.coordinatesToMetersDivider = templateValue.coordinates_to_meters_divider;
        if (config.run_immediately === undefined && templateValue.run_immediately !== undefined)
            this.runImmediately = templateValue.run_immediately;
        if (!config.repeats_type && templateValue.repeats_type)
            this.repeatsType = RepeatsType[templateValue.repeats_type];
        if (!config.max_repeats && templateValue.max_repeats) this.maxRepeats = templateValue.max_repeats;
        if (!config.service_call_schema && templateValue.service_call_schema)
            this.serviceCallSchema = new ServiceCallSchema(templateValue.service_call_schema);
    }

    private _applyData(
        entityId: string,
        selection: unknown[],
        repeats: number,
        selectionVariables: VariablesStorage,
    ): ServiceCall {
        return this.serviceCallSchema.apply(entityId, selection, repeats, { ...this.variables, ...selectionVariables });
    }
}
