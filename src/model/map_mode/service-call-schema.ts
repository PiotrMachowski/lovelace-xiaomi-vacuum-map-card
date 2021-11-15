import { ServiceCallSchemaConfig } from "../../types/types";
import { ServiceCall } from "./service-call";

type ReplacedKey = string | Record<string, unknown> | number | unknown[];
type KeyReplacer = (key: string) => ReplacedKey;

export class ServiceCallSchema {
    private readonly service: string;
    private readonly serviceData?: Record<string, unknown>;
    private readonly target?: Record<string, unknown>;

    constructor(config: ServiceCallSchemaConfig) {
        this.service = config.service;
        this.serviceData = config.service_data;
        this.target = config.target;
    }

    public apply(entityId: string, selection: unknown[], repeats: number): ServiceCall {
        const keyReplacer = (key: string): ReplacedKey =>
            ServiceCallSchema.getReplacedValue(key, entityId, selection, repeats);
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

    private static getReplacedValue(
        value: string,
        entityId: string,
        selection: unknown[],
        repeats: number,
    ): ReplacedKey {
        switch (value) {
            case "[[entity_id]]":
                return entityId;
            case "[[selection]]":
                return selection;
            case "[[repeats]]":
                return repeats;
            case "[[point_x]]":
                return this.isPoint(selection) ? (selection[0] as number) : value;
            case "[[point_y]]":
                return this.isPoint(selection) ? (selection[1] as number) : value;
            default:
                return value;
        }
    }

    private static isPoint(selection: unknown[]): boolean {
        return typeof selection[0] === "number" && selection.length == 2;
    }
}
