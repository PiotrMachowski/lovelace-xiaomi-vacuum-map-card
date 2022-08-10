import { HomeAssistant } from "custom-card-helpers";

export interface HomeAssistantFixed extends HomeAssistant {
    hassUrl(path?): string;
}
