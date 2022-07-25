import { KeyReplacer, ReplacedKey, ServiceCallSchemaConfig, VariablesStorage } from "../../types/types";
import { TemplatableValue } from "./templatable-value";
import { ServiceCall } from "./service-call";
import { Modifier } from "./modifier";

export class ServiceCallSchema {
    public readonly evaluateDataAsTemplate: boolean;
    private readonly service: string;
    private readonly serviceData?: Record<string, unknown>;
    private readonly target?: Record<string, unknown>;

    constructor(public readonly config: ServiceCallSchemaConfig) {
        this.service = config.service;
        this.serviceData = config.service_data;
        this.target = config.target;
        this.evaluateDataAsTemplate = config.evaluate_data_as_template ?? false;
    }

    private static getReplacedValue(
        value: string,
        entityId: string,
        selection: unknown[],
        repeats: number,
        variables: VariablesStorage,
    ): ReplacedKey {
        const vars = Object.fromEntries(Object.entries(variables ?? {}).map(([k, v]) => [`[[${k}]]`, v]));
        const fullValueReplacer = (v: string): ReplacedKey | null => {
            switch (v) {
                case TemplatableValue.ENTITY_ID:
                    return entityId;
                case TemplatableValue.SELECTION:
                    return selection;
                case TemplatableValue.SELECTION_SIZE:
                    return selection.length;
                case TemplatableValue.SELECTION_UNWRAPPED:
                    return JSON.stringify(selection).replaceAll("[", "").replaceAll("]", "").replaceAll('"', "");
                case TemplatableValue.REPEATS:
                    return repeats;
                case TemplatableValue.POINT_X:
                    return this.isPoint(selection) ? (selection[0] as number) : value;
                case TemplatableValue.POINT_Y:
                    return this.isPoint(selection) ? (selection[1] as number) : value;
                default:
                    if (v in vars) {
                        return vars[v];
                    }
                    return null;
            }
        };
        return fullValueReplacer(value) ?? ServiceCallSchema.replaceInStr(value, vars, fullValueReplacer);
    }

    private static replaceInStr(
        value: string,
        variables: VariablesStorage,
        kr: (string) => ReplacedKey | null,
    ): ReplacedKey {
        let output = value;
        [...Object.values(TemplatableValue), ...Object.keys(variables)].forEach(tv => {
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

    private static isPoint(selection: unknown[]): boolean {
        return typeof selection[0] === "number" && selection.length == 2;
    }

    public apply(entityId: string, selection: unknown[], repeats: number, variables: VariablesStorage): ServiceCall {
        const keyReplacer = (key: string): ReplacedKey =>
            ServiceCallSchema.getReplacedValue(key, entityId, selection, repeats, variables);
        let serviceData: ReplacedKey | undefined = undefined;
        let target: ReplacedKey | undefined = undefined;
        if (this.serviceData) {
            serviceData = this.getFilledTemplate(this.serviceData, keyReplacer);
        }
        if (this.target) {
            target = this.getFilledTemplate(this.target, keyReplacer);
        }
        const service = this.service.split(".");
        return new ServiceCall(
            service[0],
            service[1],
            serviceData as Record<string, unknown> | undefined,
            target as Record<string, unknown> | undefined,
        );
    }

    private getFilledTemplate(template: Record<string, unknown>, keyReplacer: KeyReplacer): ReplacedKey {
        const target = JSON.parse(JSON.stringify(template));
        this.replacer(target, keyReplacer);
        return target;
    }

    private replacer(target: Record<string, unknown>, keyReplacer: KeyReplacer): void {
        for (const [key, value] of Object.entries(target)) {
            if (typeof value == "object") {
                this.replacer(value as Record<string, unknown>, keyReplacer);
            } else if (typeof value == "string") {
                target[key] = keyReplacer(value as string);
            }
        }
    }
}
