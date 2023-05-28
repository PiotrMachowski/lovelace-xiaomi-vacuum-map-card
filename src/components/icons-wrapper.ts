import { css, CSSResultGroup, html, TemplateResult } from "lit";
import { customElement, property } from "lit/decorators";

import {
    ActionHandlerFunctionCreator,
    DropdownIconActionConfig,
    IconActionConfig, VariablesStorage,
} from "../types/types";
import { DropdownIcon } from "./dropdown-icon";
import { SingleIcon } from "./single-icon";
import { RootlessLitElement } from "./rootless-lit-element";
import { HomeAssistantFixed } from "../types/fixes";
import { areConditionsMet } from "../utils";

@customElement("xvmc-icons-wrapper")
export class IconsWrapper extends RootlessLitElement {

    @property({attribute: false})
    private icons!: (IconActionConfig | DropdownIconActionConfig)[];

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
          
          ${SingleIcon.styles}
          ${DropdownIcon.styles}
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
