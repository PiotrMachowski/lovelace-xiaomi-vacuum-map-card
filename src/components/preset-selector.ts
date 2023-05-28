import { css, CSSResultGroup, html, TemplateResult } from "lit";
import { customElement, property } from "lit/decorators";

import { CardPresetConfig } from "../types/types";
import { RootlessLitElement } from "./rootless-lit-element";

@customElement("xvmc-preset-selector")
export class PresetSelector extends RootlessLitElement {

    @property({attribute: false})
    private availablePresets!: CardPresetConfig[];

    @property({attribute: false})
    private availablePresetIndex!: number;

    @property({attribute: false})
    private openPreviousPreset!: () => void;

    @property({attribute: false})
    private previousPresetIndex!: number;

    @property({attribute: false})
    private presetActivable!: boolean;

    @property({attribute: false})
    private presetName!: string;

    @property({attribute: false})
    private executePresetsActivation!: () => void;

    @property({attribute: false})
    private openNextPreset!: () => void;

    @property({attribute: false})
    private nextPresetIndex!: number;

    public render(): TemplateResult | void {
        if (this.availablePresets.length < 2){
            return;
        }
        const rtl = getComputedStyle(this)?.getPropertyValue("direction") === "rtl";
        return html`
            <div class="preset-selector-wrapper">
                <div class="preset-selector-icon-wrapper" @click="${this.openPreviousPreset}">
                    <ha-icon
                        icon="mdi:chevron-${rtl ? "right" : "left"}"
                        class="preset-selector-icon ${this.previousPresetIndex === -1 ? "disabled" : ""}">
                    </ha-icon>
                </div>
                <div
                    class="preset-label-wrapper ${this.presetActivable ? "clickable" : ""}"
                    @click="${(): void => this.executePresetsActivation()}">
                    <div class="preset-label">${this.presetName}</div>
                    <div class="preset-indicator">
                        ${new Array(this.availablePresets.length).fill(0).map((_, i) => (i === this.availablePresetIndex ? "●" : "○"))}
                    </div>
                </div>
                <div class="preset-selector-icon-wrapper" @click="${this.openNextPreset}">
                    <ha-icon
                        icon="mdi:chevron-${rtl ? "left" : "right"}"
                        class="preset-selector-icon ${this.nextPresetIndex === -1 ? "disabled" : ""}">
                    </ha-icon>
                </div>
            </div>
        `;
    }

    public static get styles(): CSSResultGroup {
        return css`
          .preset-selector-wrapper {
            width: 100%;
            display: inline-flex;
            align-content: center;
            justify-content: space-between;
            align-items: center;
          }

          .preset-selector-icon-wrapper {
            height: 44px;
            width: 44px;
            display: grid;
            place-items: center;
          }

          .preset-selector-icon {
            cursor: pointer;
          }

          .preset-selector-icon.disabled {
            color: var(--map-card-internal-disabled-text-color);
            cursor: default;
          }

          .preset-label-wrapper {
            display: flex;
            flex-direction: column;
            align-items: center;
          }

          .preset-indicator {
            line-height: 50%;
          }
        `;
    }
}
