import { css, CSSResultGroup, html, TemplateResult } from "lit";
import { customElement, property } from "lit/decorators";

import {
    ActionHandlerFunctionCreator,
    DropdownIconActionConfig,
    IconActionConfig, MenuIconActionConfig, VariablesStorage,
} from "../types/types";
import { RootlessLitElement } from "./rootless-lit-element";
import { HomeAssistantFixed } from "../types/fixes";
import { areConditionsMet } from "../utils";
import { Icon } from "./icon";
import { HassEntity } from "home-assistant-js-websocket";
import { localizeAttributeForValue, localizeStateForValue } from "../localize/localize";

@customElement("xvmc-icons-wrapper")
export class IconsWrapper extends RootlessLitElement {

    @property({attribute: false})
    private icons!: (IconActionConfig | DropdownIconActionConfig)[];

    @property({attribute: false})
    private isInEditor!: boolean;

    @property({attribute: false})
    private onAction!: ActionHandlerFunctionCreator;

    public render(): TemplateResult | void {
        if ((this.icons?.length ?? 0) === 0){
            return;
        }
        return html`
            <div class="icons-wrapper">
                <div class="icons-list">
                    ${this.icons?.map((icon ) => html`
                                            <xvmc-icon
                                                .config=${icon}
                                                .isInEditor=${this.isInEditor}
                                                .onAction=${this.onAction}
                                            ></xvmc-icon>
                                        `)}
                </div>
            </div>
        `;
    }

    public static get styles(): CSSResultGroup {
        return css`
          .icons-wrapper {
            display: flex;
            justify-content: center;
            align-items: center;
          }

          .icons-list {
            float: right;
            border-radius: var(--map-card-internal-big-radius);
            overflow: hidden;
            background-color: var(--map-card-internal-secondary-color);
            color: var(--map-card-internal-secondary-text-color);
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
          }
          
          ${Icon.styles}
        `;
    }


    public static preprocessIcons(icons: IconActionConfig[] | undefined,
                                  internalVariables: VariablesStorage,
                                  hass: HomeAssistantFixed,
    ): (IconActionConfig | DropdownIconActionConfig)[] {
        if (icons === undefined) {
            return [];
        }
        const output: (IconActionConfig | DropdownIconActionConfig)[] = [];
        const menuIndexes = new Map<string, number>();
        IconsWrapper.expandMenus(icons, internalVariables, hass).forEach(i => {
            const isSelected = areConditionsMet(i, internalVariables, hass);
            if (i.menu_id === undefined) {
                if (isSelected) {
                    output.push(i);
                }
            } else {
                const icon = {...i, isSelected: isSelected};
                if (menuIndexes.has(i.menu_id) && Array.isArray(output[menuIndexes.get(i.menu_id) as number])) {
                    (output[menuIndexes.get(i.menu_id) as number] as DropdownIconActionConfig).push(icon);
                } else {
                    menuIndexes.set(i.menu_id, output.length);
                    output.push([icon]);
                }
            }
        });
        for (let i = output.length - 1; i >= 0; i--) {
            if (Array.isArray(output[i])
                && !(output[i] as DropdownIconActionConfig).some(iconEntry => iconEntry.isSelected)) {
                output.splice(i, 1);
            }
        }
        return output;
    }

    private static expandMenus(
        icons: IconActionConfig[],
        internalVariables: VariablesStorage,
        hass: HomeAssistantFixed
    ): IconActionConfig[] {
        return icons.flatMap(
            i => i.type === "menu"
                ? IconsWrapper.expandMenu(i as MenuIconActionConfig, internalVariables, hass)
                : [i],
        );
    }
    private static expandMenu(
        icon: MenuIconActionConfig,
        _internalVariables: VariablesStorage,
        hass: HomeAssistantFixed
    ): IconActionConfig[] {
        const entity = hass.states[icon.entity];
        const values = entity.attributes[icon.available_values_attribute] ?? [];
        return values.map(v => {
            return {
                ...icon,
                "label": icon.value_translation_keys?.[v] ?? IconsWrapper.getLabel(hass, entity, v, icon.current_value_attribute),
                "icon": icon.icon_mapping?.[v] ?? icon.icon,
                "icon_id": `${icon.icon_id}_${v.replace(" ", "_").toLowerCase()}`,
                "conditions": [
                    ...(icon.conditions ?? []),
                    {
                        "entity": icon.entity,
                        "attribute": icon.current_value_attribute,
                        "value": `${v}`,
                    },
                ],
                "variables": {
                    ...(icon?.variables ?? {}),
                    "value": v,
                },
            }
        });
    }

    private static getLabel(hass: HomeAssistantFixed, entity: HassEntity, value: string, attribute?: string): string {
        if (attribute) {
            return localizeAttributeForValue(hass, entity, attribute, value);
        }
        return localizeStateForValue(hass, entity, value);
    }
}
