import { HomeAssistant, NumberFormat, TimeFormat } from "custom-card-helpers";
import { Connection } from "home-assistant-js-websocket";

export interface HomeAssistantFixed extends Omit<HomeAssistant, "connection"> {
    hassUrl(path?): string;

    entities: { [id: string]: EntityRegistryDisplayEntry };

    connection: Connection;
    locale: FrontendLocaleDataFixed;
}

export enum FirstWeekday {
    language = "language",
    monday = "monday",
    tuesday = "tuesday",
    wednesday = "wednesday",
    thursday = "thursday",
    friday = "friday",
    saturday = "saturday",
    sunday = "sunday",
}

export interface FrontendLocaleDataFixed {
    language: string;
    number_format: NumberFormat;
    time_format: TimeFormat;
    first_weekday: FirstWeekday;
}

type entityCategory = "config" | "diagnostic";

export interface EntityRegistryDisplayEntry {
    entity_id: string;
    name?: string;
    device_id?: string;
    area_id?: string;
    hidden?: boolean;
    entity_category?: entityCategory;
    translation_key?: string;
    platform?: string;
    display_precision?: number;
}