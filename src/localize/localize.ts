import * as de from "./languages/de.json";
import * as en from "./languages/en.json";
import * as es from "./languages/es.json";
import * as fr from "./languages/fr.json";
import * as it from "./languages/it.json";
import * as pl from "./languages/pl.json";
import * as ptBr from "./languages/pt-BR.json";
import * as ru from "./languages/ru.json";
import * as uk from "./languages/uk.json";
import { Language, TranslatableString } from "../types/types";

const languages: Record<string, unknown> = {
    de: de,
    en: en,
    es: es,
    fr: fr,
    it: it,
    pl: pl,
    "pt-BR": ptBr,
    ru: ru,
    uk: uk,
};

function localizeString(string: string, search = "", replace = "", lang: Language = ""): string {
    const defaultLang = "en";
    if (!lang) {
        try {
            lang = JSON.parse(localStorage.getItem("selectedLanguage") || `"${defaultLang}"`);
        } catch {
            lang = (localStorage.getItem("selectedLanguage") || defaultLang).replace(/['"]+/g, "");
        }
    }

    let translated: string;

    try {
        translated = evaluateForLanguage(string, lang ?? defaultLang);
    } catch (e) {
        translated = evaluateForLanguage(string, defaultLang);
    }

    if (translated === undefined) translated = evaluateForLanguage(string, defaultLang);

    translated = translated ?? string;
    if (search !== "" && replace !== "") {
        translated = translated.replace(search, replace);
    }
    return translated;
}

function evaluateForLanguage(string: string, lang: string): string {
    return string.split(".").reduce((o, i) => (o as Record<string, unknown>)[i], languages[lang]) as string;
}

export function localize(ts: TranslatableString, lang?: Language): string {
    if (typeof ts === "string") {
        return localizeString(ts as string, "", "", lang);
    } else {
        return localizeString(...ts, lang);
    }
}
