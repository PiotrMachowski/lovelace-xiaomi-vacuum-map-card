// home-assistant/frontend/src/common/entity/compute_attribute_display.ts

import { HassEntity } from "home-assistant-js-websocket";
import { LocalizeFunc } from "./localize";
import { computeDomain } from "./compute_domain";
import { EntityRegistryDisplayEntry, FrontendLocaleDataFixed, HomeAssistantFixed } from "../../types/fixes";
import { formatAttributeName } from "./entity_attributes";
import { FrontendLocaleData } from "./translation";
import { capitalizeFirstLetter } from "./capitalize_first_letter";
import { isDate } from "./is_date";
import { isTimestamp } from "./is_timestamp";
import checkValidDate from "./check_valid_date";
import { formatDateTimeWithSeconds } from "./format_date_time";
import { formatDate } from "./format_date";
import { formatNumber } from "./format_number";


export const computeAttributeValueDisplay = (
    localize: LocalizeFunc,
    stateObj: HassEntity,
    locale: FrontendLocaleDataFixed,
    entities: HomeAssistantFixed["entities"],
    attribute: string,
    value?: any
): string => {
    const attributeValue =
        value !== undefined ? value : stateObj.attributes[attribute];

    // Null value, the state is unknown
    if (attributeValue === null) {
        return localize("state.default.unknown");
    }

    // Number value, return formatted number
    if (typeof attributeValue === "number") {
        return formatNumber(attributeValue, locale);
    }

    // Special handling in case this is a string with an known format
    if (typeof attributeValue === "string") {

        // Date handling
        if (isDate(attributeValue, true)) {
            // Timestamp handling
            if (isTimestamp(attributeValue)) {
                const date = new Date(attributeValue);
                if (checkValidDate(date)) {
                    return formatDateTimeWithSeconds(date, locale);
                }
            }

            // Value was not a timestamp, so only do date formatting
            const date = new Date(attributeValue);
            if (checkValidDate(date)) {
                return formatDate(date, locale);
            }
        }
    }

    // Values are objects, render object
    if (
        (Array.isArray(attributeValue) &&
            attributeValue.some((val) => val instanceof Object)) ||
        (!Array.isArray(attributeValue) && attributeValue instanceof Object)
    ) {
        return JSON.stringify(attributeValue);
    }

    // If this is an array, try to determine the display value for each item
    if (Array.isArray(attributeValue)) {
        return attributeValue
            .map((item) =>
                computeAttributeValueDisplay(
                    localize,
                    stateObj,
                    locale,
                    entities,
                    attribute,
                    item
                )
            )
            .join(", ");
    }

    // We've explored all known value handling, so now we'll try to find a
    // translation for the value.
    const entityId = stateObj.entity_id;
    const domain = computeDomain(entityId);
    const deviceClass = stateObj.attributes.device_class;
    const registryEntry = entities?.[entityId] as
        | EntityRegistryDisplayEntry
        | undefined;
    const translationKey = registryEntry?.translation_key;

    return (
        (translationKey &&
            localize(
                `component.${registryEntry.platform}.entity.${domain}.${translationKey}.state_attributes.${attribute}.state.${attributeValue}`
            )) ||
        (deviceClass &&
            localize(
                `component.${domain}.entity_component.${deviceClass}.state_attributes.${attribute}.state.${attributeValue}`
            )) ||
        localize(
            `component.${domain}.entity_component._.state_attributes.${attribute}.state.${attributeValue}`
        ) ||
        attributeValue
    );
};

export const computeAttributeNameDisplay = (
    localize: LocalizeFunc,
    stateObj: HassEntity,
    entities: HomeAssistantFixed["entities"],
    attribute: string
): string => {
    const entityId = stateObj.entity_id;
    const deviceClass = stateObj.attributes.device_class;
    const domain = computeDomain(entityId);
    const entity = entities[entityId] as EntityRegistryDisplayEntry | undefined;
    const translationKey = entity?.translation_key;

    return (
        (translationKey &&
            localize(
                `component.${entity.platform}.entity.${domain}.${translationKey}.state_attributes.${attribute}.name`
            )) ||
        (deviceClass &&
            localize(
                `component.${domain}.entity_component.${deviceClass}.state_attributes.${attribute}.name`
            )) ||
        localize(
            `component.${domain}.entity_component._.state_attributes.${attribute}.name`
        ) ||
        capitalizeFirstLetter(
            attribute
                .replace(/_/g, " ")
                .replace(/\bid\b/g, "ID")
                .replace(/\bip\b/g, "IP")
                .replace(/\bmac\b/g, "MAC")
                .replace(/\bgps\b/g, "GPS")
        )
    );
};