// home-assistant/frontend/src/common/translations/blank_before_percent.ts

import { FrontendLocaleData } from "./translation";

// Logic based on https://en.wikipedia.org/wiki/Percent_sign#Form_and_spacing
export const blankBeforePercent = (
    localeOptions: FrontendLocaleData
): string => {
    switch (localeOptions.language) {
        case "cz":
        case "de":
        case "fi":
        case "fr":
        case "sk":
        case "sv":
            return " ";
        default:
            return "";
    }
};
