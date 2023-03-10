// home-assistant/frontend/src/common/datetime/format_date.ts

import { FrontendLocaleDataFixed } from "../../types/fixes";

// Tuesday, August 10
export const formatDateWeekdayDay = (
    dateObj: Date,
    locale: FrontendLocaleDataFixed
): string => formatDateWeekdayDayMem(locale).format(dateObj);

const formatDateWeekdayDayMem = (
    (locale: FrontendLocaleDataFixed) =>
        new Intl.DateTimeFormat(locale.language, {
            weekday: "long",
            month: "long",
            day: "numeric",
        })
);

// August 10, 2021
export const formatDate = (dateObj: Date, locale: FrontendLocaleDataFixed): string =>
    formatDateMem(locale).format(dateObj);

const formatDateMem = (
    (locale: FrontendLocaleDataFixed) =>
        new Intl.DateTimeFormat(locale.language, {
            year: "numeric",
            month: "long",
            day: "numeric",
        })
);

// 10/08/2021
export const formatDateNumeric = (dateObj: Date, locale: FrontendLocaleDataFixed): string =>
    formatDateNumericMem(locale).format(dateObj);

const formatDateNumericMem = (
    (locale: FrontendLocaleDataFixed) =>
        new Intl.DateTimeFormat(locale.language, {
            year: "numeric",
            month: "numeric",
            day: "numeric",
        })
);

// Aug 10
export const formatDateShort = (dateObj: Date, locale: FrontendLocaleDataFixed): string =>
    formatDateShortMem(locale).format(dateObj);

const formatDateShortMem = (
    (locale: FrontendLocaleDataFixed) =>
        new Intl.DateTimeFormat(locale.language, {
            day: "numeric",
            month: "short",
        })
);

// August 2021
export const formatDateMonthYear = (
    dateObj: Date,
    locale: FrontendLocaleDataFixed
): string => formatDateMonthYearMem(locale).format(dateObj);

const formatDateMonthYearMem = (
    (locale: FrontendLocaleDataFixed) =>
        new Intl.DateTimeFormat(locale.language, {
            month: "long",
            year: "numeric",
        })
);

// August
export const formatDateMonth = (dateObj: Date, locale: FrontendLocaleDataFixed): string =>
    formatDateMonthMem(locale).format(dateObj);

const formatDateMonthMem = (
    (locale: FrontendLocaleDataFixed) =>
        new Intl.DateTimeFormat(locale.language, {
            month: "long",
        })
);

// 2021
export const formatDateYear = (dateObj: Date, locale: FrontendLocaleDataFixed): string =>
    formatDateYearMem(locale).format(dateObj);

const formatDateYearMem = (
    (locale: FrontendLocaleDataFixed) =>
        new Intl.DateTimeFormat(locale.language, {
            year: "numeric",
        })
);

// Monday
export const formatDateWeekday = (dateObj: Date, locale: FrontendLocaleDataFixed): string =>
    formatDateWeekdayMem(locale).format(dateObj);

const formatDateWeekdayMem = (
    (locale: FrontendLocaleDataFixed) =>
        new Intl.DateTimeFormat(locale.language, {
            weekday: "long",
        })
);
