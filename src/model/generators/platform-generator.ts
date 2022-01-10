import * as defaultTemplate from "./platform_templates/default.json";
import * as krzysztofHajdamowiczMiio2Template from "./platform_templates/KrzysztofHajdamowicz_miio2.json";
import * as marotowebViomiseTemplate from "./platform_templates/marotoweb_viomise.json";
import * as sendCommandTemplate from "./platform_templates/send-command.json";
import * as neatoTemplate from "./platform_templates/neato.json";
import { MapModeConfig, PlatformTemplate, TileFromAttributeTemplate, TileFromSensorTemplate } from "../../types/types";
import { HomeAssistant } from "custom-card-helpers";
import { compare } from "compare-versions";

export class PlatformGenerator {
    public static DEFAULT_PLATFORM = "default";
    public static KRZYSZTOFHAJDAMOWICZ_MIIO2_PLATFORM = "KrzysztofHajdamowicz/miio2";
    public static MAROTOWEB_VIOMISE_PLATFORM = "marotoweb/viomise";
    public static SEND_COMMAND_PLATFORM = "send_command";
    public static NEATO_PLATFORM = "Neato";

    private static TEMPLATES = new Map<string, PlatformTemplate>([
        [PlatformGenerator.DEFAULT_PLATFORM, defaultTemplate],
        [PlatformGenerator.KRZYSZTOFHAJDAMOWICZ_MIIO2_PLATFORM, krzysztofHajdamowiczMiio2Template],
        [PlatformGenerator.MAROTOWEB_VIOMISE_PLATFORM, marotowebViomiseTemplate],
        [PlatformGenerator.SEND_COMMAND_PLATFORM, sendCommandTemplate],
        [PlatformGenerator.NEATO_PLATFORM, neatoTemplate],
    ]);

    public static getPlatforms(): string[] {
        return Array.from(PlatformGenerator.TEMPLATES.keys());
    }

    public static isValidModeTemplate(platform: string, template?: string): boolean {
        return (
            template !== undefined &&
            Object.keys(this.getPlatformTemplate(platform).map_modes.templates).includes(template)
        );
    }

    public static getModeTemplate(platform: string, template: string): MapModeConfig {
        return this.getPlatformTemplate(platform).map_modes.templates[template];
    }

    public static generateDefaultModes(platform: string): MapModeConfig[] {
        return this.getPlatformTemplate(platform).map_modes.defaultTemplates.map(dt => ({ template: dt }));
    }

    public static getTilesFromAttributesTemplates(platform: string): TileFromAttributeTemplate[] {
        return this.getPlatformTemplate(platform).tiles.from_attributes ?? [];
    }

    public static getTilesFromSensorsTemplates(platform: string): TileFromSensorTemplate[] {
        return this.getPlatformTemplate(platform).tiles.from_sensors ?? [];
    }

    public static usesSensors(hass: HomeAssistant, platform: string): boolean {
        const sensorsFrom = this.getPlatformTemplate(platform).sensors_from;
        if (sensorsFrom) {
            return compare(hass.config.version.replace(/\.*[a-z].*/, ""), sensorsFrom, ">=");
        }
        return false;
    }

    private static getPlatformTemplate(platform: string): PlatformTemplate {
        return (
            this.TEMPLATES.get(platform) ??
            this.TEMPLATES.get(this.DEFAULT_PLATFORM) ??
            ({
                templates: [],
                defaultTemplates: {},
            } as unknown as PlatformTemplate)
        );
    }
}
