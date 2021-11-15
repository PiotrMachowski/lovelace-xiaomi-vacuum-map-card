import * as defaultTemplate from "./platform_templates/default.json";
import * as miio2KHTemplate from "./platform_templates/miio2-KH.json";
import { MapModeConfig, PlatformTemplate, TileFromAttributeTemplate, TileFromSensorTemplate } from "../../types/types";

export class PlatformGenerator {
    public static DEFAULT_PLATFORM = "default";
    public static MIIO2_KH_PLATFORM = "KrzysztofHajdamowicz/miio2";

    private static TEMPLATES = new Map<string, PlatformTemplate>([
        [PlatformGenerator.DEFAULT_PLATFORM, defaultTemplate],
        [PlatformGenerator.MIIO2_KH_PLATFORM, miio2KHTemplate],
    ]);

    private static PLATFORMS = Array.from(PlatformGenerator.TEMPLATES.keys());

    public static getPlatforms(): string[] {
        return this.PLATFORMS;
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
