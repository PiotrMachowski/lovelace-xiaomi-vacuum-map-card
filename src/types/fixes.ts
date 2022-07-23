import { HomeAssistant } from "custom-card-helpers";

export interface HomeAssistantFixed extends HomeAssistant {
    hassUrl(path?): string;
}

export interface LovelaceDomEvent extends Event {
    detail: Record<string, never>;
}
