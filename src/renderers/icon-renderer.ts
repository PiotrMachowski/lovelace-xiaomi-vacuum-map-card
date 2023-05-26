import { css, CSSResultGroup, html, TemplateResult } from "lit";
import { handleAction, hasAction, HomeAssistant } from "custom-card-helpers";

import { actionHandler } from "../action-handler-directive";
import { areConditionsMet, handleActionWithConfig } from "../utils";
import {
    DropdownIconActionConfig,
    IconActionConfig,
    VariablesStorage,
} from "../types/types";
import { XiaomiVacuumMapCard } from "../xiaomi-vacuum-map-card";
import { DropdownMenuRenderer } from "./dropdown-menu-renderer";
import { HomeAssistantFixed } from "../types/fixes";

export class IconRenderer extends DropdownMenuRenderer {

    public static render(config: IconActionConfig | DropdownIconActionConfig, card: XiaomiVacuumMapCard, menus: HTMLElement[]): TemplateResult {
        if (Array.isArray(config)) {
            return this.renderIconDropdown(config as DropdownIconActionConfig, card, menus);
        }
        return this.renderSingleIcon(config, card);
    }

    public static renderSingleIcon(config: IconActionConfig, card: XiaomiVacuumMapCard): TemplateResult {
        return html`
            <paper-button
                class="icon-dropdown-menu-button-button clickable ripple"
                .title=${config.tooltip ?? ""}
                @action=${handleActionWithConfig(card, config)}
                .actionHandler=${actionHandler({
                    hasHold: hasAction(config?.hold_action),
                    hasDoubleClick: hasAction(config?.double_tap_action),
                })}>
                <ha-icon icon="${config.icon}"></ha-icon>
            </paper-button>
        `;
    }

    public static renderIconDropdown(config: DropdownIconActionConfig, card: XiaomiVacuumMapCard, menus: HTMLElement[]): TemplateResult {
        const items = config.map(i => {
            return {icon: i.icon, name: (i.label??"")};
        });
        const selected = config.findIndex(i => i.isSelected);
        const itemClass = `icon-menu-${config[0].menu_id}`;
        const menu = menus.find(m => m.classList.contains(itemClass));
        return this._render(
            items,
            selected,
            (v) => {
                handleAction(card, card.hass as unknown as HomeAssistant, config[v], "tap");
            },
            menu,
            "icon",
            false,
            [itemClass]
        );
    }

    public static get styles(): CSSResultGroup {
        return css`
            .icon-dropdown-menu-button-button {
                float: left;
                width: 50px;
                height: 50px;
                display: flex;
                justify-content: center;
                align-items: center;
                background-color: transparent;
                border-radius: var(--map-card-internal-big-radius);
            }

          .icon-dropdown-menu {
            --mdc-menu-item-height: 50px;
            --mdc-theme-primary: transparent;
            --mdc-list-vertical-padding: 0px;
            --mdc-list-side-padding: 0px;
            --mdc-shape-medium: var(--map-card-internal-big-radius);
            --mdc-ripple-color: transparent;
          }

          .icon-dropdown-menu-button {
            display: inline-flex;
          }

          .icon-dropdown-list-item:host:host {
            flex-grow: 1;
          }

          .icon-dropdown-menu-button-text {
            display: inline-flex;
            line-height: 50px;
            background-color: transparent;
            padding-left: 10px;
            padding-right: 15px;
          }

          .icon-dropdown-menu-entry {
            display: inline-flex;
            width: 100%;
          }

          .icon-dropdown-menu-entry.selected {
            border-radius: var(--map-card-internal-big-radius);
            background-color: var(--map-card-internal-primary-color);
            color: var(--map-card-internal-primary-text-color);
          }

          .icon-dropdown-menu-entry-button-wrapper.first:not(.selected) {
            border-top-left-radius: var(--map-card-internal-big-radius);
            border-top-right-radius: var(--map-card-internal-big-radius);
          }

          .icon-dropdown-menu-entry-button-wrapper.last:not(.selected) {
            border-bottom-left-radius: var(--map-card-internal-big-radius);
            border-bottom-right-radius: var(--map-card-internal-big-radius);
          }

          .icon-dropdown-menu-entry-button.selected {
            border-start-start-radius: var(--map-card-internal-big-radius);
            border-end-start-radius: var(--map-card-internal-big-radius);
            background-color: var(--map-card-internal-primary-color);
            color: var(--map-card-internal-primary-text-color);
          }

          .icon-dropdown-menu-entry-button-wrapper {
            background-color: var(--map-card-internal-secondary-color);
            color: var(--map-card-internal-secondary-text-color);
            overflow: hidden;
          }

          .icon-dropdown-menu-entry-button {
            width: 50px;
            height: 50px;
            display: flex;
            justify-content: center;
            align-items: center;
            background-color: var(--map-card-internal-secondary-color);
            color: var(--map-card-internal-secondary-text-color);
          }

          .icon-dropdown-menu-entry-text {
            display: inline-flex;
            line-height: 50px;
            background-color: transparent;
            padding-left: 10px;
            padding-right: 15px;
          }

          .icon-dropdown-menu-listbox {
            padding: 0;
            background-color: transparent;
          }
          
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
        icons.forEach(i => {
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
}
