// home-assistant/frontend/src/common/entity/compute_attribute_display.ts

import { HassEntity } from "home-assistant-js-websocket";
import { LocalizeFunc } from "./localize";
import { computeDomain } from "./compute_domain";
import { EntityRegistryDisplayEntry, HomeAssistantFixed } from "../../types/fixes";
import { formatAttributeName } from "./entity_attributes";

export const computeAttributeValueDisplay = (
    localize: LocalizeFunc,
    stateObj: HassEntity,
    entities: HomeAssistantFixed["entities"],
    attribute: string,
    value?: any
): string => {
    const entityId = stateObj.entity_id;
    const attributeValue =
        value !== undefined ? value : stateObj.attributes[attribute];
    const domain = computeDomain(entityId);
    const entity = entities[entityId] as EntityRegistryDisplayEntry | undefined;
    const translationKey = entity?.translation_key;

    return (
        (translationKey &&
            localize(
                `component.${entity.platform}.entity.${domain}.${translationKey}.state_attributes.${attribute}.state.${attributeValue}`
            )) ||
        localize(
            `component.${domain}.state_attributes._.${attribute}.state.${attributeValue}`
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
    const domain = computeDomain(entityId);
    const entity = entities[entityId] as EntityRegistryDisplayEntry | undefined;
    const translationKey = entity?.translation_key;

    return (
        (translationKey &&
            localize(
                `component.${entity.platform}.entity.${domain}.${translationKey}.state_attributes.${attribute}.name`
            )) ||
        localize(`component.${domain}.state_attributes._.${attribute}.name`) ||
        formatAttributeName(attribute)
    );
};
