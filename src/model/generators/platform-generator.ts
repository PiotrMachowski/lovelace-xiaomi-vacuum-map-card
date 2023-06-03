import * as xiaomiMiioTemplate from "./platform_templates/xiaomiMiio.json";
import * as krzysztofHajdamowiczMiio2Template from "./platform_templates/KrzysztofHajdamowicz_miio2.json";
import * as marotowebViomiseTemplate from "./platform_templates/marotoweb_viomise.json";
import * as rand256ValetudoReTemplate from "./platform_templates/rand256_valetudo_re.json";
import * as sendCommandTemplate from "./platform_templates/send-command.json";
import * as alOneHassXiaomiMiotTemplate from "./platform_templates/al-one_hass-xiaomi-miot.json";
import * as tykarolViomiVacuumV8Template from "./platform_templates/tykarol_viomi_vacuum_v8.json";
import * as hypferValetudoTemplate from "./platform_templates/hypfer_valetudo.json";
import * as neatoTemplate from "./platform_templates/neato.json";
import * as roombaTemplate from "./platform_templates/roomba.json";
import * as deebotTemplate from "./platform_templates/DeebotUniverse_Deebot-4-Home-Assistant.json";
import * as tasshackDreameVacuumTemplate from "./platform_templates/Tasshack_dreame-vacuum.json";
import * as roborockTemplate from "./platform_templates/humbertogontijo_homeassistant-roborock.json";
import * as simpleWyzeTemplate from "./platform_templates/romedtino_simple-wyze-vac.json";
import * as myneatoTemplate from "./platform_templates/BenjaminPaap_myneato.json";
import * as setupDecimalTemplate from "./platform_templates/setup_decimal.json";
import * as setupIntegerTemplate from "./platform_templates/setup_integer.json";
import {
    CalibrationPoint,
    IconTemplate,
    MapModeConfig,
    PlatformTemplate,
    TileFromAttributeTemplate,
    TileFromSensorTemplate,
    VariablesStorage,
} from "../../types/types";
import { SelectionType } from "../map_mode/selection-type";

export class PlatformGenerator {
    public static XIAOMI_MIIO_PLATFORM = "default";
    public static KRZYSZTOFHAJDAMOWICZ_MIIO2_PLATFORM = "KrzysztofHajdamowicz/miio2";
    public static MAROTOWEB_VIOMISE_PLATFORM = "marotoweb/viomise";
    public static RAND256_VALETUDO_RE_PLATFORM = "rand256/ValetudoRE";
    public static SEND_COMMAND_PLATFORM = "send_command";
    public static ALONE_XIAOMI_MIOT_PLATFORM = "al-one/hass-xiaomi-miot";
    public static TYKAROL_VIOMI_VACUUM_V8_PLATFORM = "tykarol/viomi-vacuum-v8";
    public static HYPFER_VALETUDO_PLATFORM = "Hypfer/Valetudo";
    public static NEATO_PLATFORM = "Neato";
    public static ROOMBA_PLATFORM = "Roomba";
    public static TASSHACK_DREAME_VACUUM_PLATFORM = "Tasshack/dreame-vacuum";
    public static DEEBOTUNIVERSE_DEEBOT_4_HOME_ASSISTANT_PLATFORM = "DeebotUniverse/Deebot-4-Home-Assistant";
    public static HUMBERTOGONTIJO_ROBOROCK_PLATFORM = "humbertogontijo/homeassistant-roborock";
    public static ROMEDTINO_SIMPLE_WAZE_PLATFORM = "romedtino/simple-wyze-vac";
    public static BENJAMIN_PAAP_MYNEATO_PLATFORM = "BenjaminPaap/home-assistant-myneato";
    public static SETUP_INTEGER_PLATFORM = "Setup integer";
    public static SETUP_DECIMAL_PLATFORM = "Setup decimal";

    private static DOCUMENTATION_URL_FORMAT =
        "https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/tree/master/docs/templates/{0}.md";

    private static TEMPLATES = new Map<string, PlatformTemplate>([
        [PlatformGenerator.XIAOMI_MIIO_PLATFORM, xiaomiMiioTemplate as PlatformTemplate],
        [PlatformGenerator.KRZYSZTOFHAJDAMOWICZ_MIIO2_PLATFORM, krzysztofHajdamowiczMiio2Template],
        [PlatformGenerator.MAROTOWEB_VIOMISE_PLATFORM, marotowebViomiseTemplate],
        [PlatformGenerator.TYKAROL_VIOMI_VACUUM_V8_PLATFORM, tykarolViomiVacuumV8Template],
        [PlatformGenerator.HYPFER_VALETUDO_PLATFORM, hypferValetudoTemplate],
        [PlatformGenerator.RAND256_VALETUDO_RE_PLATFORM, rand256ValetudoReTemplate as PlatformTemplate],
        [PlatformGenerator.TASSHACK_DREAME_VACUUM_PLATFORM, tasshackDreameVacuumTemplate as PlatformTemplate],
        [PlatformGenerator.HUMBERTOGONTIJO_ROBOROCK_PLATFORM, roborockTemplate as PlatformTemplate],
        [PlatformGenerator.SEND_COMMAND_PLATFORM, sendCommandTemplate],
        [PlatformGenerator.ALONE_XIAOMI_MIOT_PLATFORM, alOneHassXiaomiMiotTemplate],
        [PlatformGenerator.NEATO_PLATFORM, neatoTemplate],
        [PlatformGenerator.ROOMBA_PLATFORM, roombaTemplate],
        [PlatformGenerator.DEEBOTUNIVERSE_DEEBOT_4_HOME_ASSISTANT_PLATFORM, deebotTemplate as PlatformTemplate],
        [PlatformGenerator.ROMEDTINO_SIMPLE_WAZE_PLATFORM, simpleWyzeTemplate],
        [PlatformGenerator.BENJAMIN_PAAP_MYNEATO_PLATFORM, myneatoTemplate as PlatformTemplate],
        [PlatformGenerator.SETUP_INTEGER_PLATFORM, setupIntegerTemplate],
        [PlatformGenerator.SETUP_DECIMAL_PLATFORM, setupDecimalTemplate],
    ]);

    private static TEMPLATE_DOCUMENTATIONS_URLS = new Map<string, string>([
        [PlatformGenerator.XIAOMI_MIIO_PLATFORM, "xiaomiMiio"],
        [PlatformGenerator.KRZYSZTOFHAJDAMOWICZ_MIIO2_PLATFORM, "krzysztofHajdamowiczMiio2"],
        [PlatformGenerator.MAROTOWEB_VIOMISE_PLATFORM, "marotowebViomise"],
        [PlatformGenerator.TYKAROL_VIOMI_VACUUM_V8_PLATFORM, "tykarolViomiVacuumV8"],
        [PlatformGenerator.HYPFER_VALETUDO_PLATFORM, "hypferValetudo"],
        [PlatformGenerator.RAND256_VALETUDO_RE_PLATFORM, "rand256ValetudoRe"],
        [PlatformGenerator.TASSHACK_DREAME_VACUUM_PLATFORM, "tasshackDreameVacuum"],
        [PlatformGenerator.HUMBERTOGONTIJO_ROBOROCK_PLATFORM, "humbertogontijoHomeassistantRoborock"],
        [PlatformGenerator.SEND_COMMAND_PLATFORM, "sendCommand"],
        [PlatformGenerator.ALONE_XIAOMI_MIOT_PLATFORM, "alOneHassXiaomiMiot"],
        [PlatformGenerator.NEATO_PLATFORM, "neato"],
        [PlatformGenerator.ROOMBA_PLATFORM, "roomba"],
        [PlatformGenerator.DEEBOTUNIVERSE_DEEBOT_4_HOME_ASSISTANT_PLATFORM, "DeebotUniverseDeebot4homeAssistant"],
        [PlatformGenerator.ROMEDTINO_SIMPLE_WAZE_PLATFORM, "romedtinoSimpleWyze"],
        [PlatformGenerator.BENJAMIN_PAAP_MYNEATO_PLATFORM, "BenjaminPaapMyNeato"],
        [PlatformGenerator.SETUP_INTEGER_PLATFORM, "setup"],
        [PlatformGenerator.SETUP_DECIMAL_PLATFORM, "setup"],
    ]);

    public static getPlatformsWithDefaultCalibration(): string[] {
        return [
            PlatformGenerator.BENJAMIN_PAAP_MYNEATO_PLATFORM,
            PlatformGenerator.DEEBOTUNIVERSE_DEEBOT_4_HOME_ASSISTANT_PLATFORM,
            PlatformGenerator.NEATO_PLATFORM,
            PlatformGenerator.ROMEDTINO_SIMPLE_WAZE_PLATFORM,
            PlatformGenerator.ROOMBA_PLATFORM,
        ];
    }

    public static getPlatforms(): string[] {
        return Array.from(PlatformGenerator.TEMPLATES.keys());
    }

    public static getPlatformName(platform: string | undefined): string {
        return platform ?? PlatformGenerator.XIAOMI_MIIO_PLATFORM;
    }

    public static getPlatformsDocumentationUrl(platform: string): string {
        const file =
            PlatformGenerator.TEMPLATE_DOCUMENTATIONS_URLS.get(platform) ??
            PlatformGenerator.TEMPLATE_DOCUMENTATIONS_URLS.get(PlatformGenerator.XIAOMI_MIIO_PLATFORM) ??
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
        return this.getPlatformTemplate(platform).map_modes.default_templates.map(dt => ({ template: dt }));
    }

    public static getTilesFromAttributesTemplates(platform: string): TileFromAttributeTemplate[] {
        return this.getPlatformTemplate(platform).tiles?.from_attributes ?? [];
    }

    public static getTilesFromSensorsTemplates(platform: string): TileFromSensorTemplate[] {
        return this.getPlatformTemplate(platform).tiles?.from_sensors ?? [];
    }

    public static getIconsTemplates(platform: string): IconTemplate[] {
        return this.getPlatformTemplate(platform).icons ?? [];
    }

    public static getRoomsTemplate(platform: string): string | undefined {
        const platformTemplate = this.getPlatformTemplate(platform);
        for (const templateName in platformTemplate.map_modes.templates) {
            const template = platformTemplate.map_modes.templates[templateName];
            if (template.selection_type === SelectionType[SelectionType.ROOM]) {
                return templateName;
            }
        }
        return undefined;
    }

    public static getCalibration(platform: string | undefined): CalibrationPoint[] | undefined {
        return this.getPlatformTemplate(PlatformGenerator.getPlatformName(platform)).calibration_points;
    }

    public static getVariables(platform: string | undefined): VariablesStorage | undefined {
        return this.getPlatformTemplate(PlatformGenerator.getPlatformName(platform)).internal_variables;
    }

    private static getPlatformTemplate(platform: string): PlatformTemplate {
        return (
            this.TEMPLATES.get(platform) ??
            this.TEMPLATES.get(this.XIAOMI_MIIO_PLATFORM) ??
            ({
                templates: [],
                default_templates: {},
            } as unknown as PlatformTemplate)
        );
    }
}
