/* eslint-disable @typescript-eslint/no-explicit-any */
import { css, CSSResultGroup, html, LitElement, TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators";
import { fireEvent, HomeAssistant, LovelaceCardEditor } from "custom-card-helpers";

import { TranslatableString, XiaomiVacuumMapCardConfig } from "./types/types";
import { localizeWithHass } from "./localize/localize";
import { PlatformGenerator } from "./model/generators/platform-generator";
import { EDITOR_CUSTOM_ELEMENT_NAME } from "./const";

@customElement(EDITOR_CUSTOM_ELEMENT_NAME)
export class XiaomiVacuumMapCardEditor extends LitElement implements LovelaceCardEditor {
    @property({ attribute: false }) public hass?: HomeAssistant;
    @state() private _config?: XiaomiVacuumMapCardConfig;
    @state() private _helpers?: any;
    private _initialized = false;

    public setConfig(config: XiaomiVacuumMapCardConfig): void {
        this._config = config;
        this.loadCardHelpers();
    }

    protected shouldUpdate(): boolean {
        if (!this._initialized) {
            this._initialize();
        }
        return true;
    }

    get _title(): string {
        return this._config?.title || "";
    }

    get _entity(): string {
        return this._config?.entity || "";
    }

    get _vacuum_platform(): string {
        return this._config?.vacuum_platform || "";
    }

    get _camera(): string {
        return this._config?.map_source?.camera || "";
    }

    get _map_locked(): boolean {
        return this._config?.map_locked || false;
    }

    get _two_finger_pan(): boolean {
        return this._config?.two_finger_pan || false;
    }

    protected render(): TemplateResult | void {
        if (!this.hass || !this._helpers) {
            return html``;
        }

        this._helpers.importMoreInfoControl("climate");

        const entityIds = Object.keys(this.hass.states);
        const cameras = entityIds.filter(e => e.substr(0, e.indexOf(".")) === "camera");
        const vacuums = entityIds.filter(e => e.substr(0, e.indexOf(".")) === "vacuum");
        const platforms = PlatformGenerator.getPlatforms();

        return html`
            <div class="card-config">
                <div class="description">
                    ${this._localize("editor.description.before_link")}<a
                        target="_blank"
                        href="https://github.com/PiotrMachowski/Home-Assistant-custom-components-Xiaomi-Cloud-Map-Extractor"
                        >${this._localize("editor.description.link_text")}</a
                    >${this._localize("editor.description.after_link")}
                </div>
                <div class="values">
                    <paper-input
                        label=${this._localize("editor.label.name")}
                        .value=${this._title}
                        .configValue=${"title"}
                        @value-changed=${this._titleChanged}></paper-input>
                </div>
                <div class="values">
                    <paper-dropdown-menu
                        label=${this._localize("editor.label.entity")}
                        @value-changed=${this._entityChanged}
                        .configValue=${"entity"}>
                        <paper-listbox slot="dropdown-content" .selected=${vacuums.indexOf(this._entity)}>
                            ${vacuums.map(entity => {
                                return html` <paper-item>${entity}</paper-item> `;
                            })}
                        </paper-listbox>
                    </paper-dropdown-menu>
                </div>
                <div class="values">
                    <paper-dropdown-menu
                        label=${this._localize("editor.label.vacuum_platform")}
                        @value-changed=${this._entityChanged}
                        .configValue=${"vacuum_platform"}>
                        <paper-listbox slot="dropdown-content" .selected=${platforms.indexOf(this._vacuum_platform)}>
                            ${platforms.map(platform => {
                                return html` <paper-item>${platform}</paper-item> `;
                            })}
                        </paper-listbox>
                    </paper-dropdown-menu>
                </div>
                <div class="values">
                    <paper-dropdown-menu
                        label=${this._localize("editor.label.camera")}
                        @value-changed=${this._cameraChanged}
                        .configValue=${"camera"}>
                        <paper-listbox slot="dropdown-content" .selected=${cameras.indexOf(this._camera)}>
                            ${cameras.map(entity => {
                                return html` <paper-item>${entity}</paper-item> `;
                            })}
                        </paper-listbox>
                    </paper-dropdown-menu>
                </div>
                <div class="values">
                    <ha-formfield .label=${this._localize("editor.label.map_locked")}>
                        <ha-switch
                            .checked=${this._map_locked}
                            .configValue=${"map_locked"}
                            @change=${this._valueChanged}></ha-switch>
                    </ha-formfield>
                </div>
                <div class="values">
                    <ha-formfield .label=${this._localize("editor.label.two_finger_pan")}>
                        <ha-switch
                            .checked=${this._two_finger_pan}
                            .configValue=${"two_finger_pan"}
                            @change=${this._valueChanged}></ha-switch>
                    </ha-formfield>
                </div>
            </div>
        `;
    }

    private _initialize(): void {
        if (this.hass === undefined) return;
        if (this._config === undefined) return;
        if (this._helpers === undefined) return;
        this._initialized = true;
    }

    private async loadCardHelpers(): Promise<void> {
        this._helpers = await (window as any).loadCardHelpers();
    }

    private _entityChanged(ev): void {
        this._valueChanged(ev);
    }

    private _cameraChanged(ev): void {
        if (!this._config || !this.hass) {
            return;
        }
        const value = ev.target.value;
        if (this._camera === value) return;
        const tmpConfig = { ...this._config };
        tmpConfig["map_source"] = { camera: value };
        tmpConfig["calibration_source"] = { camera: true };
        this._config = tmpConfig;
        fireEvent(this, "config-changed", { config: this._config });
    }

    private _titleChanged(ev): void {
        this._valueChanged(ev);
    }

    private _valueChanged(ev): void {
        if (!this._config || !this.hass) {
            return;
        }
        const target = ev.target;
        if (this[`_${target.configValue}`] === target.value) {
            return;
        }
        if (!target.configValue) {
            const tmpConfig = { ...this._config };
            delete tmpConfig[target.configValue];
            this._config = tmpConfig;
        } else {
            this._config = {
                ...this._config,
                [target.configValue]: target.checked !== undefined ? target.checked : target.value,
            };
        }
        fireEvent(this, "config-changed", { config: this._config });
    }

    private _localize(ts: TranslatableString): string {
        return localizeWithHass(ts, this.hass);
    }

    static get styles(): CSSResultGroup {
        return css`
            .values {
                padding-left: 16px;
                margin: 8px;
                display: grid;
            }

            ha-formfield {
                padding: 8px;
            }
        `;
    }
}
