import { css, CSSResultGroup, html, TemplateResult } from "lit";

import { MapMode } from "../model/map_mode/map-mode";

export class ModesMenuRenderer {
    public static render(modes: MapMode[], getMode: number, setMode: (number) => void): TemplateResult {
        const getCurrentMode = (): MapMode => modes[getMode];
        return html`
            <ha-button-menu>
                <mwc-button raised slot="trigger" expandContent="true" label="${getCurrentMode().name}">
                    <ha-icon slot="icon" icon="${getCurrentMode().icon}"></ha-icon>
                </mwc-button>
                ${modes.map(
                    (mode, index) => html`<mwc-list-item
                        ?activated=${getMode === index}
                        @click=${(): void => setMode(index)}
                    >
                        <ha-icon icon="${mode.icon}"></ha-icon>
                        ${mode.name}
                    </mwc-list-item>`,
                )}
            </ha-button-menu>
        `;
    }

    public static get styles(): CSSResultGroup {
        return css`
            mwc-button {
                --mdc-theme-primary: var(--map-card-internal-primary-color);
                --mdc-icon-size: 22px;
                --mdc-shape-small: var(--map-card-internal-big-radius);
            }
        `;
    }
}
