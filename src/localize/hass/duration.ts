// home-assistant/frontend/src/common/datetime/duration.ts

const DAY_IN_SECONDS = 86400;
const HOUR_IN_SECONDS = 3600;
const MINUTE_IN_SECONDS = 60;

export const UNIT_TO_SECOND_CONVERT = {
    s: 1,
    min: MINUTE_IN_SECONDS,
    h: HOUR_IN_SECONDS,
    d: DAY_IN_SECONDS,
};

const leftPad = (num: number) => (num < 10 ? `0${num}` : num);

export function secondsToDuration(d: number) {
    const h = Math.floor(d / 3600);
    const m = Math.floor((d % 3600) / 60);
    const s = Math.floor((d % 3600) % 60);

    if (h > 0) {
        return `${h}:${leftPad(m)}:${leftPad(s)}`;
    }
    if (m > 0) {
        return `${m}:${leftPad(s)}`;
    }
    if (s > 0) {
        return "" + s;
    }
    return null;
}

export const formatDuration = (duration: string, units: string): string =>
    secondsToDuration(parseFloat(duration) * UNIT_TO_SECOND_CONVERT[units]) ||
    "0";
