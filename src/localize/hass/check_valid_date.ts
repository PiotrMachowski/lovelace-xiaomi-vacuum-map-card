// home-assistant/frontend/src/common/datetime/check_valid_date.ts

export default function checkValidDate(date?: Date): boolean {
    if (!date) {
        return false;
    }

    return date instanceof Date && !isNaN(date.valueOf());
}
