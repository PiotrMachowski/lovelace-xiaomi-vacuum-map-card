import * as cs from "./languages/cs.json";
import * as da from "./languages/da.json";
import * as de from "./languages/de.json";
import * as el from "./languages/el.json";
import * as en from "./languages/en.json";
import * as es from "./languages/es.json";
import * as fr from "./languages/fr.json";
import * as he from "./languages/he.json";
import * as hu from "./languages/hu.json";
import * as is from "./languages/is.json";
import * as it from "./languages/it.json";
import * as nl from "./languages/nl.json";
import * as pl from "./languages/pl.json";
import * as ptBr from "./languages/pt-BR.json";
import * as ru from "./languages/ru.json";
import * as sv from "./languages/sv.json";
import * as uk from "./languages/uk.json";
import * as zh from "./languages/zh.json";
import * as zhHant from "./languages/zh-Hant.json";
import { Language, TranslatableString, XiaomiVacuumMapCardConfig } from "../types/types";
import { HomeAssistant } from "custom-card-helpers";

const languages: Record<string, unknown> = {
    cs: cs,
    da: da,
    de: de,
    el: el,
    en: en,
    es: es,
    fr: fr,
    he: he,
    hu: hu,
    is: is,
    it: it,
    nl: nl,
    pl: pl,
    "pt-BR": ptBr,
    ru: ru,
    sv: sv,
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
    hass?: HomeAssistant,
    config?: XiaomiVacuumMapCardConfig,
    fallback?: string,
): string {
    return localize(ts, config?.language ?? hass?.locale?.language, fallback);
}
