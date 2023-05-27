import { css, CSSResultGroup, html, LitElement, TemplateResult } from "lit";

import { areConditionsMet } from "../utils";
import {
    ActionHandlerFunctionCreator,
    DropdownIconActionConfig,
    IconActionConfig,
    VariablesStorage,
} from "../types/types";
import { HomeAssistantFixed } from "../types/fixes";
import "./single-icon";
import { DropdownIcon } from "./dropdown-icon";
import { customElement, property } from "lit/decorators";
import { SingleIcon } from "./single-icon";

@customElement("xvmc-icon")
export class Icon extends LitElement {

    @property({attribute: false})
    private config!: IconActionConfig | DropdownIconActionConfig;

    @property({attribute: false})
    private onAction!: ActionHandlerFunctionCreator;

    public render(): TemplateResult {
        if (Array.isArray(this.config)) {
            return html`
                <xvmc-dropdown-icon
                    .config=${this.config}
                    .onAction=${this.onAction}>
                </xvmc-dropdown-icon>
        `;
        }
        return html`
            <xvmc-single-icon
                .config=${this.config}
                .onAction=${this.onAction}>
            </xvmc-single-icon>
        `;
    }

    protected createRenderRoot(): Element | ShadowRoot {
        return this;
    }

    public static get styles(): CSSResultGroup {
        return css`
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
