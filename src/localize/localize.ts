import * as it from "./languages/it.json";
import * as en from "./languages/en.json";
import * as es from "./languages/es.json";
import * as fr from "./languages/fr.json";
import * as pl from "./languages/pl.json";
import * as ru from "./languages/ru.json";
import * as uk from "./languages/uk.json";
import { TranslatableString } from "../types/types";

const languages: Record<string, unknown> = {
    it: it,
    en: en,
    es: es,
    fr: fr,
    pl: pl,
    ru: ru,
};

export function localize(string: string, search = "", replace = ""): string {
    const lang = (localStorage.getItem("selectedLanguage") || "en").replace(/['"]+/g, "").replace("-", "_");

    let translated: string;

    try {
        translated = evaluateForLanguage(string, lang);
    } catch (e) {
        translated = evaluateForLanguage(string, "en");
    }

    if (translated === undefined) translated = evaluateForLanguage(string, "en");

    translated = translated ?? string;
    if (search !== "" && replace !== "") {
        translated = translated.replace(search, replace);
    }
    return translated;
}

function evaluateForLanguage(string: string, lang: string): string {
    return string.split(".").reduce((o, i) => (o as Record<string, unknown>)[i], languages[lang]) as string;
}

export function localizeTranslatable(ts: TranslatableString): string {
    if (typeof ts === "string") {
        return localize(ts as string);
    } else {
        return localize(...ts);
    }
}
