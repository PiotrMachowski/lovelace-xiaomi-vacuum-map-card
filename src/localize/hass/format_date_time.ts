// home-assistant/frontend/src/common/datetime/format_date_time.ts

import { useAmPm } from "./use_am_pm";
import { FrontendLocaleDataFixed } from "../../types/fixes";


// August 9, 2021, 8:23 AM
export const formatDateTime = (dateObj: Date, locale: FrontendLocaleDataFixed): string =>
    formatDateTimeMem(locale).format(dateObj);

const formatDateTimeMem = (
    (locale: FrontendLocaleDataFixed) =>
        new Intl.DateTimeFormat(
            locale.language === "en" && !useAmPm(locale)
                ? "en-u-hc-h23"
                : locale.language,
            {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: useAmPm(locale) ? "numeric" : "2-digit",
                minute: "2-digit",
                hour12: useAmPm(locale),
            }
        )
);

// Aug 9, 8:23 AM
export const formatShortDateTime = (
    dateObj: Date,
    locale: FrontendLocaleDataFixed
): string => formatShortDateTimeMem(locale).format(dateObj);

const formatShortDateTimeMem = (
    (locale: FrontendLocaleDataFixed) =>
        new Intl.DateTimeFormat(
            locale.language === "en" && !useAmPm(locale)
                ? "en-u-hc-h23"
                : locale.language,
            {
                month: "short",
                day: "numeric",
                hour: useAmPm(locale) ? "numeric" : "2-digit",
                minute: "2-digit",
                hour12: useAmPm(locale),
            }
        )
);

// August 9, 2021, 8:23:15 AM
export const formatDateTimeWithSeconds = (
    dateObj: Date,
    locale: FrontendLocaleDataFixed
): string => formatDateTimeWithSecondsMem(locale).format(dateObj);

const formatDateTimeWithSecondsMem = (
    (locale: FrontendLocaleDataFixed) =>
        new Intl.DateTimeFormat(
            locale.language === "en" && !useAmPm(locale)
                ? "en-u-hc-h23"
                : locale.language,
            {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: useAmPm(locale) ? "numeric" : "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: useAmPm(locale),
            }
        )
);

// 9/8/2021, 8:23 AM
export const formatDateTimeNumeric = (
    dateObj: Date,
    locale: FrontendLocaleDataFixed
): string => formatDateTimeNumericMem(locale).format(dateObj);

const formatDateTimeNumericMem = (
    (locale: FrontendLocaleDataFixed) =>
        new Intl.DateTimeFormat(
            locale.language === "en" && !useAmPm(locale)
                ? "en-u-hc-h23"
                : locale.language,
            {
                year: "numeric",
                month: "numeric",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
                hour12: useAmPm(locale),
            }
        )
);
