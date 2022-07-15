import * as defaultTemplate from "./platform_templates/default.json";
import * as krzysztofHajdamowiczMiio2Template from "./platform_templates/KrzysztofHajdamowicz_miio2.json";
import * as marotowebViomiseTemplate from "./platform_templates/marotoweb_viomise.json";
import * as rand256ValetudoReTemplate from "./platform_templates/rand256_valetudo_re.json";
import * as sendCommandTemplate from "./platform_templates/send-command.json";
import * as alOneHassXiaomiMiotTemplate from "./platform_templates/al-one_hass-xiaomi-miot.json";
import * as tykarolViomiVacuumV8Template from "./platform_templates/tykarol_viomi_vacuum_v8.json";
import * as neatoTemplate from "./platform_templates/neato.json";
import * as setupOthersTemplate from "./platform_templates/setup_others.json";
import * as setupXiaomiTemplate from "./platform_templates/setup_xiaomi.json";
import { MapModeConfig, PlatformTemplate, TileFromAttributeTemplate, TileFromSensorTemplate } from "../../types/types";
import { HomeAssistant } from "custom-card-helpers";
import { compare } from "compare-versions";

export class PlatformGenerator {
    public static DEFAULT_PLATFORM = "default";
    public static KRZYSZTOFHAJDAMOWICZ_MIIO2_PLATFORM = "KrzysztofHajdamowicz/miio2";
    public static MAROTOWEB_VIOMISE_PLATFORM = "marotoweb/viomise";
    public static RAND256_VALETUDO_RE_PLATFORM = "rand256/ValetudoRE";
    public static SEND_COMMAND_PLATFORM = "send_command";
    public static ALONE_XIAOMIMIOT_PLATFORM = "al-one/hass-xiaomi-miot";
    public static TYKAROL_VIOMI_VACUUM_V8_PLATFORM = "tykarol/viomi-vacuum-v8";
    public static NEATO_PLATFORM = "Neato";
    public static SETUP_PLATFORM_XIAOMI = "Setup Xiaomi";
    public static SETUP_PLATFORM_OTHERS = "Setup Others";

    private static DOCUMENTATION_URL_FORMAT =
        "https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/tree/master/docs/templates/{0}.md";

    private static TEMPLATES = new Map<string, PlatformTemplate>([
        [PlatformGenerator.DEFAULT_PLATFORM, defaultTemplate],
        [PlatformGenerator.KRZYSZTOFHAJDAMOWICZ_MIIO2_PLATFORM, krzysztofHajdamowiczMiio2Template],
        [PlatformGenerator.MAROTOWEB_VIOMISE_PLATFORM, marotowebViomiseTemplate],
        [PlatformGenerator.RAND256_VALETUDO_RE_PLATFORM, rand256ValetudoReTemplate],
        [PlatformGenerator.SEND_COMMAND_PLATFORM, sendCommandTemplate],
        [PlatformGenerator.ALONE_XIAOMIMIOT_PLATFORM, alOneHassXiaomiMiotTemplate],
        [PlatformGenerator.TYKAROL_VIOMI_VACUUM_V8_PLATFORM, tykarolViomiVacuumV8Template],
        [PlatformGenerator.NEATO_PLATFORM, neatoTemplate],
        [PlatformGenerator.SETUP_PLATFORM_XIAOMI, setupXiaomiTemplate],
        [PlatformGenerator.SETUP_PLATFORM_OTHERS, setupOthersTemplate],
    ]);

    private static TEMPLATE_DOCUMENTATIONS_URLS = new Map<string, string>([
        [PlatformGenerator.DEFAULT_PLATFORM, "default"],
        [PlatformGenerator.KRZYSZTOFHAJDAMOWICZ_MIIO2_PLATFORM, "krzysztofHajdamowiczMiio2"],
        [PlatformGenerator.MAROTOWEB_VIOMISE_PLATFORM, "marotowebViomise"],
        [PlatformGenerator.RAND256_VALETUDO_RE_PLATFORM, "rand256ValetudoRe"],
        [PlatformGenerator.SEND_COMMAND_PLATFORM, "sendCommand"],
        [PlatformGenerator.ALONE_XIAOMIMIOT_PLATFORM, "alOneHassXiaomiMiot"],
        [PlatformGenerator.TYKAROL_VIOMI_VACUUM_V8_PLATFORM, "tykarolViomiVacuumV8"],
        [PlatformGenerator.NEATO_PLATFORM, "neato"],
        [PlatformGenerator.SETUP_PLATFORM_XIAOMI, "setupXiaomi"],
        [PlatformGenerator.SETUP_PLATFORM_OTHERS, "setupOthers"],
    ]);

    public static getPlatforms(): string[] {
        return Array.from(PlatformGenerator.TEMPLATES.keys());
    }

    public static getPlatformsDocumentationUrl(platform: string): string {
        const file =
            PlatformGenerator.TEMPLATE_DOCUMENTATIONS_URLS.get(platform) ??
            PlatformGenerator.TEMPLATE_DOCUMENTATIONS_URLS.get(PlatformGenerator.DEFAULT_PLATFORM) ??
            "";
        return PlatformGenerator.DOCUMENTATION_URL_FORMAT.replace("{0}", file);
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
