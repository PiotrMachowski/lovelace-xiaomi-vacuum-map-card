import { css, CSSResultGroup, html, TemplateResult } from "lit";
import { customElement, property } from "lit/decorators";
import {
    ActionHandlerFunctionCreator,
    TileConfig,
    VariablesStorage,
} from "../types/types";
import { HomeAssistantFixed } from "../types/fixes";
import { RootlessLitElement } from "./rootless-lit-element";
import { Tile } from "./tile";

@customElement("xvmc-tiles-wrapper")
export class TilesWrapper extends RootlessLitElement {

    @property({attribute: false})
    private tiles!: TileConfig[] | undefined;

    @property({attribute: false})
    private hass!: HomeAssistantFixed;

    @property({attribute: false})
    private isInEditor!: boolean;

    @property({attribute: false})
    private onAction!: ActionHandlerFunctionCreator;

    @property({attribute: false})
    private internalVariables!: VariablesStorage;

    protected render(): TemplateResult | void {
        if ((this.tiles?.length ?? 0) === 0){
            return;
        }
        return html`
                <div class="tiles-wrapper">
                    ${this.tiles?.map(tile => html`
                        <xvmc-tile
                            .hass=${this.hass}
                            .config=${tile}
                            .isInEditor=${this.isInEditor}
                            .onAction=${this.onAction}
                            .internalVariables=${this.internalVariables}
                        ></xvmc-tile>
                    `)}
        `;
    }

    public static get styles(): CSSResultGroup {
        return css`
          .tiles-wrapper {
            display: flex;
            flex-wrap: wrap;
            justify-content: space-evenly;
            align-items: stretch;
            gap: 5px;
          }

          ${Tile.styles}
        `;
    }
}
