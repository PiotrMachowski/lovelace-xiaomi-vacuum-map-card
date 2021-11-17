import * as en from "./languages/en.json";
import * as pl from "./languages/pl.json";
import * as ptBr from "./languages/pt-BR.json";
import { TranslatableString } from "../types/types";

const languages: Record<string, unknown> = {
    en: en,
    pl: pl,
    "pt-BR": ptBr,
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
