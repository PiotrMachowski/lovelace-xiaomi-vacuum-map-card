import * as ca from "./languages/ca.json";
import * as cs from "./languages/cs.json";
import * as da from "./languages/da.json";
import * as de from "./languages/de.json";
import * as el from "./languages/el.json";
import * as en from "./languages/en.json";
import * as es from "./languages/es.json";
import * as fi from "./languages/fi.json";
import * as fr from "./languages/fr.json";
import * as he from "./languages/he.json";
import * as hu from "./languages/hu.json";
import * as is from "./languages/is.json";
import * as it from "./languages/it.json";
import * as nbNo from "./languages/nb-NO.json";
import * as nl from "./languages/nl.json";
import * as pl from "./languages/pl.json";
import * as pt from "./languages/pt.json";
import * as ptBr from "./languages/pt-BR.json";
import * as ro from "./languages/ro.json";
import * as ru from "./languages/ru.json";
import * as sk from "./languages/sk.json";
import * as sv from "./languages/sv.json";
import * as tr from "./languages/tr.json";
import * as uk from "./languages/uk.json";
import * as zh from "./languages/zh.json";
import * as zhHant from "./languages/zh-Hant.json";
import { EntityConfig, Language, TranslatableString, XiaomiVacuumMapCardConfig } from "../types/types";
import { HomeAssistantFixed } from "../types/fixes";
import { HassEntity } from "home-assistant-js-websocket/dist/types";
import { formatAttributeValue } from "./hass/entity_attributes";
import { computeStateDisplay } from "./hass/compute_state_display";
import { computeAttributeValueDisplay } from "./hass/compute_attribute_display";

const languages: Record<string, unknown> = {
    ca: ca,
    cs: cs,
    da: da,
    de: de,
    el: el,
    en: en,
    es: es,
    fi: fi,
    fr: fr,
    he: he,
    hu: hu,
    is: is,
    it: it,
    "nb-NO": nbNo,
    nl: nl,
    pl: pl,
    pt: pt,
    "pt-BR": ptBr,
    ro: ro,
    ru: ru,
    sk: sk,
    sv: sv,
    tr: tr,
    uk: uk,
    zh: zh,
    "zh-Hant": zhHant,
};

function localizeString(string: string, search = "", replace = "", lang: Language = "", fallback = string): string {
    const defaultLang = "en";
    if (!lang) {
        try {
            lang = JSON.parse(localStorage.getItem("selectedLanguage") || `"${defaultLang}"`);
        } catch {
            lang = (localStorage.getItem("selectedLanguage") || defaultLang).replace(/['"]+/g, "");
        }
    }

    let translated: string | undefined;

    try {
        translated = evaluateForLanguage(string, lang ?? defaultLang);
    } catch (e) {
        translated = evaluateForLanguage(string, defaultLang);
    }

    if (translated === undefined) translated = evaluateForLanguage(string, defaultLang);

    translated = translated ?? fallback;
    if (search !== "" && replace !== "") {
        translated = translated.replace(search, replace);
    }
    return translated;
}

function evaluateForLanguage(string: string, lang: string): string | undefined {
    try {
        return string.split(".").reduce((o, i) => (o as Record<string, unknown>)[i], languages[lang]) as string;
    } catch (_) {
        return undefined;
    }
}

export function localize(ts: TranslatableString, lang?: Language, fallback?: string): string {
    if (typeof ts === "string") {
        return localizeString(ts as string, "", "", lang, fallback);
    } else {
        return localizeString(...ts, lang, fallback);
    }
}

export function localizeWithHass(
    ts: TranslatableString,
    hass?: HomeAssistantFixed,
    config?: XiaomiVacuumMapCardConfig,
    fallback?: string,
): string {
    return localize(ts, config?.language ?? hass?.locale?.language, fallback);
}

export function localizeEntity(hass: HomeAssistantFixed, config: EntityConfig, entity: HassEntity): string {
    return "attribute" in config && config.attribute !== undefined
        ? entity.attributes[config.attribute] !== undefined
            ? formatAttributeValue(
                hass,
                entity,
                config.attribute,
            )
            : hass.localize("state.default.unknown")
        : computeStateDisplay(
            hass.localize,
            entity,
            hass.locale,
            hass.entities,
        );
}

export function localizeStateForValue(hass: HomeAssistantFixed, entity: HassEntity, state: string): string {
    return computeStateDisplay(
        hass.localize,
        entity,
        hass.locale,
        hass.entities,
        state
    )
}

export function localizeAttributeForValue(hass: HomeAssistantFixed, entity: HassEntity, attribute: string, value: string): string {
    return computeAttributeValueDisplay(
        hass.localize,
        entity,
        hass.locale,
        hass.entities,
        attribute,
        value
    )
}
