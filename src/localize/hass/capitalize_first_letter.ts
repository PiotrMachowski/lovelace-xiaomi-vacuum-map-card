// home-assistant/frontend/src/common/string/capitalize-first-letter.ts

export const capitalizeFirstLetter = (str: string) =>
    str.charAt(0).toUpperCase() + str.slice(1);
