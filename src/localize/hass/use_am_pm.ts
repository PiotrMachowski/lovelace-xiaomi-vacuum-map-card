// home-assistant/frontend/src/common/datetime/use_am_pm.ts

import { TimeFormat } from "custom-card-helpers";
import { FrontendLocaleDataFixed } from "../../types/fixes";

export const useAmPm = (locale: FrontendLocaleDataFixed): boolean => {
    if (
        locale.time_format === TimeFormat.language ||
        locale.time_format === TimeFormat.system
    ) {
        const testLanguage =
            locale.time_format === TimeFormat.language ? locale.language : undefined;
        const test = new Date().toLocaleString(testLanguage);
        return test.includes("AM") || test.includes("PM");
    }

    return locale.time_format === TimeFormat.am_pm;
};
