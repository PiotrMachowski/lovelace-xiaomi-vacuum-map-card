import style from './style.js';
import {
    textMode,
    textGoToTarget,
    textZonedCleanup,
    textZones,
    textRun,
    textRepeats,
    textConfirmation
} from './texts.js'

const LitElement = Object.getPrototypeOf(
    customElements.get("ha-panel-lovelace")
);
const html = LitElement.prototype.html;

class XiaomiVacuumMapCard extends LitElement {
    constructor() {
        super();
        this.isMouseDown = false;
        this.rectangles = [];
        this.selectedRectangle = -1;
        this.selectedZones = [];
        this.currRectangle = {x: null, y: null, w: null, h: null};
        this.imageScale = -1;
        this.mode = 0;
        this.vacuumZonedCleanupRepeats = 1;
        this.currPoint = {x: null, y: null};
        this.unit = {x: null, y: null};
        this.shouldSwapAxis = false;
    }

    static get properties() {
        return {
            hass: {},
            config: {},
            isMouseDown: {},
            rectangles: {},
            selectedRectangle: {},
            selectedZones: {},
            currRectangle: {},
            mode: {},
            vacuumZonedCleanupRepeats: {},
            currPoint: {},
            mapDrawing: {},
        };
    }

    set hass(hass) {
        this._hass = hass;
    }

    setConfig(config) {
        const availableModes = new Map();
        availableModes.set("go_to_target", textGoToTarget);
        availableModes.set("zoned_cleanup", textZonedCleanup);
        availableModes.set("predefined_zones", textZones);

        if (!config.entity) {
            throw new Error("Missing configuration: entity");
        }
        if (!config.map_image) {
            throw new Error("Missing configuration: map_image");
        }
        if (!config.base_position) {
            throw new Error("Missing configuration: base_position");
        }
        if (!config.base_position.x) {
            throw new Error("Missing configuration: base_position.x");
        }
        if (!config.base_position.y) {
            throw new Error("Missing configuration: base_position.y");
        }
        if (!config.reference_point) {
            throw new Error("Missing configuration: reference_point");
        }
        if (!config.reference_point.x) {
            throw new Error("Missing configuration: reference_point.x");
        }
        if (!config.reference_point.y) {
            throw new Error("Missing configuration: reference_point.y");
        }
        if (config.modes) {
            if (!Array.isArray(config.modes) || config.modes.length < 1 || config.modes.length > 3) {
                throw new Error("Invalid configuration: modes");
            }
            this.modes = [];
            for (const mode of config.modes) {
                if (!availableModes.has(mode)) {
                    throw new Error("Invalid mode: " + mode);
                }
                this.modes.push(availableModes.get(mode));
            }
        } else {
            this.modes = [textGoToTarget, textZonedCleanup, textZones];
        }
        if (!config.zones || !Array.isArray(config.zones) || config.zones.length === 0 && this.modes.includes(textZones)) {
            this.modes.splice(this.modes.indexOf(textZones), 1);
        }
        if (config.default_mode) {
            if (!availableModes.has(config.default_mode) || !this.modes.includes(availableModes.get(config.default_mode))) {
                throw new Error("Invalid default mode: " + config.default_mode);
            }
            this.defaultMode = this.modes.indexOf(availableModes.get(config.default_mode));
        } else {
            this.defaultMode = -1;
        }
        if (config.service && config.service.split(".").length === 2) {
            this.service_domain = config.service.split(".")[0];
            this.service_method = config.service.split(".")[1];
        } else {
            this.service_domain = "vacuum";
            this.service_method = "send_command";
        }
        this.config = config;
        const diffX = config.reference_point.x - config.base_position.x;
        const diffY = config.reference_point.y - config.base_position.y;
        this.shouldSwapAxis = diffX * diffY > 0;
        if (this.shouldSwapAxis) {
            this.unit = {
                x: diffY,
                y: diffX
            };
            const temp = config.base_position.x;
            config.base_position.x = config.base_position.y;
            config.base_position.y = temp;
        } else {
            this.unit = {
                x: diffX,
                y: diffY
            };
        }
    }

    render() {
        const modesDropdown = this.modes.map(m => html`<paper-item>${m}</paper-item>`);
        const rendered = html`
        ${style}
        <ha-card id="xiaomiCard">
            <div id="mapWrapper">
                <div id="map">
                    <img id="mapBackground" @load="${() => this.mapOnLoad()}" src="${this.config.map_image}">
                    <canvas id="mapDrawing" style="${this.getCanvasStyle()}"
                        @mousemove="${e => this.onMouseMove(e)}"
                        @mousedown="${e => this.onMouseDown(e)}"
                        @mouseup="${e => this.onMouseUp(e)}"
                        @touchstart="${e => this.onTouchStart(e)}"
                        @touchend="${e => this.onTouchEnd(e)}"
                        @touchmove="${e => this.onTouchMove(e)}" />
                </div>
            </div>
            <div class="dropdownWrapper">
                <paper-dropdown-menu label="${textMode}" @value-changed="${e => this.modeSelected(e)}" class="vacuumDropdown" selected="${this.defaultMode}">
                    <paper-listbox slot="dropdown-content" class="dropdown-content" selected="${this.defaultMode}">
                        ${modesDropdown}
                    </paper-listbox>
                </paper-dropdown-menu>
            </div>
            <p class="buttonsWrapper">
                <span id="increaseButton" hidden><mwc-button @click="${() => this.vacuumZonedIncreaseButton()}">${textRepeats} ${this.vacuumZonedCleanupRepeats}</mwc-button></span>
                <mwc-button class="vacuumRunButton" @click="${() => this.vacuumStartButton(true)}">${textRun}</mwc-button>
            </p>
            <div id="toast"><div id="img"><ha-icon icon="mdi:check" style="vertical-align: center"></ha-icon></div><div id="desc">${textConfirmation}</div></div>
        </ha-card>
        `;
        if (this.getMapImage()) {
            this.mapOnLoad();
        }
        return rendered;
    }

    mapOnLoad() {
        const img = this.getMapImage();
        const canvas = this.getCanvas();
        this.imageScale = img.width / img.naturalWidth;
        const mapHeight = Math.round(this.imageScale * img.naturalHeight);
        img.parentElement.parentElement.style.height = mapHeight + "px";
        canvas.width = img.width;
        canvas.height = mapHeight;
        this.drawCanvas();
    }

    onMouseDown(e) {
        const pos = this.getMousePos(e);
        this.isMouseDown = true;
        if (this.mode === 1) {
            this.currPoint.x = pos.x;
            this.currPoint.y = pos.y;
        } else if (this.mode === 2) {
            const {selected, shouldDelete, shouldResize} = this.getSelectedRectangle(pos.x, pos.y);
            this.currRectangle.x = pos.x;
            this.currRectangle.y = pos.y;
            if (shouldDelete) {
                this.rectangles.splice(selected, 1);
                this.drawCanvas();
                return;
            }
            if (shouldResize) {
                this.currRectangle.x = this.rectangles[selected].x;
                this.currRectangle.y = this.rectangles[selected].y;
                this.rectangles.splice(selected, 1);
                this.drawCanvas();
                return;
            }
            this.selectedRectangle = selected;
            if (this.selectedRectangle >= 0) {
                this.currRectangle.w = this.rectangles[this.selectedRectangle].x;
                this.currRectangle.h = this.rectangles[this.selectedRectangle].y;
            } else {
                this.currRectangle.w = 0;
                this.currRectangle.h = 0;
            }
        } else if (this.mode === 3) {
            const selectedZone = this.getSelectedZone(pos.x, pos.y);
            if (selectedZone >= 0) {
                if (this.selectedZones.includes(selectedZone)) {
                    this.selectedZones.splice(this.selectedZones.indexOf(selectedZone), 1);
                } else {
                    if (this.selectedZones.length < 5) {
                        this.selectedZones.push(selectedZone);
                    }
                }
            }
        }
        this.drawCanvas();
    }

    onMouseUp(e) {
        this.isMouseDown = false;
        if (this.selectedRectangle >= 0 || this.mode !== 2 || this.mode === 2 && this.rectangles.length >= 5) {
            this.selectedRectangle = -1;
            this.drawCanvas();
            return;
        }
        const {x, y} = this.getMousePos(e);
        const rx = Math.min(x, this.currRectangle.x);
        const ry = Math.min(y, this.currRectangle.y);
        const rw = Math.max(x, this.currRectangle.x) - rx;
        const rh = Math.max(y, this.currRectangle.y) - ry;
        this.currRectangle.x = rx;
        this.currRectangle.y = ry;
        this.currRectangle.w = rw;
        this.currRectangle.h = rh;
        if (rw > 5 && rh > 5) {
            this.rectangles.push({x: rx, y: ry, w: rw, h: rh});
        }
        this.drawCanvas();
    }

    onMouseMove(e) {
        if (this.isMouseDown && this.mode === 2) {
            const {x, y} = this.getMousePos(e);
            if (this.selectedRectangle < 0) {
                this.currRectangle.w = x - this.currRectangle.x;
                this.currRectangle.h = y - this.currRectangle.y;
            } else {
                this.rectangles[this.selectedRectangle].x = this.currRectangle.w + x - this.currRectangle.x;
                this.rectangles[this.selectedRectangle].y = this.currRectangle.h + y - this.currRectangle.y;
            }
            this.drawCanvas();
        }
    }

    onTouchStart(e) {
        if (this.mode === 2)
            this.onMouseDown(this.convertTouchToMouse(e));
    }

    onTouchEnd(e) {
        if (this.mode === 2)
            this.onMouseUp(this.convertTouchToMouse(e));
    }

    onTouchMove(e) {
        if (this.mode === 2)
            this.onMouseMove(this.convertTouchToMouse(e));
    }

    modeSelected(e) {
        const selected = e.detail.value;
        this.mode = 0;
        if (selected === textGoToTarget) {
            this.mode = 1;
        } else if (selected === textZonedCleanup) {
            this.mode = 2;
        } else if (selected === textZones) {
            this.mode = 3;
        }
        this.getPredefinedZonesIncreaseButton().hidden = this.mode !== 3 && this.mode !== 2;
        this.drawCanvas();
    }

    vacuumZonedIncreaseButton() {
        this.vacuumZonedCleanupRepeats++;
        if (this.vacuumZonedCleanupRepeats > 3)
            this.vacuumZonedCleanupRepeats = 1;
    }

    vacuumStartButton(debug) {
        if (this.mode === 1 && this.currPoint.x != null) {
            this.vacuumGoToPoint(debug);
        } else if (this.mode === 2 && !this.rectangles.empty) {
            this.vacuumStartZonedCleanup(debug);
        } else if (this.mode === 3 && !this.selectedZones.empty) {
            this.vacuumStartPreselectedZonesCleanup(debug);
        }
    }

    drawCanvas() {
        const canvas = this.getCanvas();
        const context = canvas.getContext("2d");
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.translate(0.5, 0.5);
        if (this.config.debug) {
            const p1 = this.convertRealToCanvasCoordinates(25500, 25500);
            this.drawCircle(context, p1.x, p1.y, 4, 'red', 1);
            const p2 = this.convertRealToCanvasCoordinates(26500, 26500);
            this.drawCircle(context, p2.x, p2.y, 4, 'red', 1);
        }
        if (this.mode === 1 && this.currPoint.x != null) {
            this.drawCircle(context, this.currPoint.x, this.currPoint.y, 4, 'yellow', 1);
        } else if (this.mode === 2) {
            for (let i = 0; i < this.rectangles.length; i++) {
                const rect = this.rectangles[i];
                context.beginPath();
                if (i === this.selectedRectangle) {
                    context.setLineDash([10, 5]);
                    context.strokeStyle = 'white';
                } else {
                    context.setLineDash([]);
                    context.strokeStyle = 'white';
                    context.fillStyle = 'rgba(255, 255, 255, 0.25)';
                    context.fillRect(rect.x, rect.y, rect.w, rect.h);
                }
                context.rect(rect.x, rect.y, rect.w, rect.h);
                context.lineWidth = 1;
                context.stroke();
                this.drawDelete(context, rect.x + rect.w, rect.y);
                this.drawResize(context, rect.x + rect.w, rect.y + rect.h);
            }
            if (this.isMouseDown && this.selectedRectangle < 0) {
                context.beginPath();
                context.setLineDash([10, 5]);
                context.strokeStyle = 'white';
                context.lineWidth = 1;
                context.rect(this.currRectangle.x, this.currRectangle.y, this.currRectangle.w, this.currRectangle.h);
                context.stroke();
            }
        } else if (this.mode === 3) {
            for (let i = 0; i < this.config.zones.length; i++) {
                const zone = this.config.zones[i];
                for (const rect of zone) {
                    const {x, y, w, h} = this.convertRealToCanvasZone(rect[0], rect[1], rect[2], rect[3]);
                    context.beginPath();
                    context.setLineDash([]);
                    if (!this.selectedZones.includes(i)) {
                        context.strokeStyle = 'red';
                        context.fillStyle = 'rgba(255, 0, 0, 0.25)';
                    } else {
                        context.strokeStyle = 'green';
                        context.fillStyle = 'rgba(0, 255, 0, 0.25)';
                    }
                    context.lineWidth = 1;
                    context.rect(x, y, w, h);
                    context.fillRect(x, y, w, h);
                    context.stroke();
                }
            }
        }
        context.translate(-0.5, -0.5);
    }

    drawCircle(context, x, y, r, style, lineWidth) {
        context.beginPath();
        context.arc(x, y, r, 0, Math.PI * 2);
        context.strokeStyle = style;
        context.lineWidth = lineWidth;
        context.stroke();
    }

    drawDelete(context, x, y) {
        context.setLineDash([]);
        this.drawCircle(context, x, y, 8, 'black', 1.2);
        const diff = 4;
        context.moveTo(x - diff, y - diff);
        context.lineTo(x + diff, y + diff);
        context.moveTo(x - diff, y + diff);
        context.lineTo(x + diff, y - diff);
        context.stroke();
    }

    drawResize(context, x, y) {
        context.setLineDash([]);
        this.drawCircle(context, x, y, 8, 'black', 1.2);
        const diff = 4;
        context.moveTo(x - diff, y - diff);
        context.lineTo(x + diff, y + diff);
        context.lineTo(x + diff, y + diff - 4);
        context.lineTo(x + diff - 4, y + diff);
        context.lineTo(x + diff, y + diff);
        context.moveTo(x - diff, y - diff);
        context.lineTo(x - diff, y - diff + 4);
        context.lineTo(x - diff + 4, y - diff);
        context.lineTo(x - diff, y - diff);
        context.stroke();
    }

    getSelectedRectangle(x, y) {
        let selected = -1;
        let shouldDelete = false;
        let shouldResize = false;
        for (let i = this.rectangles.length - 1; i >= 0; i--) {
            const rect = this.rectangles[i];
            if (Math.pow(x - rect.x - rect.w, 2) + Math.pow(y - rect.y, 2) <= 64) {
                selected = i;
                shouldDelete = true;
                break;
            }
            if (Math.pow(x - rect.x - rect.w, 2) + Math.pow(y - rect.y - rect.h, 2) <= 64) {
                selected = i;
                shouldResize = true;
                break;
            }
            if (x >= rect.x && y >= rect.y && x <= rect.x + rect.w && y <= rect.y + rect.h) {
                selected = i;
                break;
            }
        }
        return {selected, shouldDelete, shouldResize};
    }

    getSelectedZone(mx, my) {
        let selected = -1;
        for (let i = 0; i < this.config.zones.length && selected === -1; i++) {
            const zone = this.config.zones[i];
            for (const rect of zone) {
                const {x, y, w, h} = this.convertRealToCanvasZone(rect[0], rect[1], rect[2], rect[3]);
                if (mx >= x && my >= y && mx <= x + w && my <= y + h) {
                    selected = i;
                    break;
                }
            }
        }
        return selected;
    }

    getCanvasStyle() {
        if (this.mode === 2) return html`touch-action: none;`;
        else return html``;
    }

    vacuumGoToPoint(debug) {
        const mapPos = this.convertCanvasToRealCoordinates(this.currPoint.x, this.currPoint.y);
        if (debug && this.config.debug) {
            alert(JSON.stringify([mapPos.x, mapPos.y]));
        } else {
            this._hass.callService(this.service_domain, this.service_method, {
                entity_id: this.config.entity,
                command: "app_goto_target",
                params: [mapPos.x, mapPos.y]
            }).then(() => this.launch_toast());
        }
    }

    vacuumStartZonedCleanup(debug) {
        const zone = [];
        for (const rect of this.rectangles) {
            zone.push(this.convertCanvasToRealRect(rect, this.vacuumZonedCleanupRepeats));
        }
        if (debug && this.config.debug) {
            alert(JSON.stringify(zone));
        } else {
            this._hass.callService(this.service_domain, this.service_method, {
                entity_id: this.config.entity,
                command: "app_zoned_clean",
                params: zone
            }).then(() => this.launch_toast());
        }
    }

    vacuumStartPreselectedZonesCleanup(debug) {
        const zone = [];
        for (let i = 0; i < this.selectedZones.length; i++) {
            const selectedZone = this.selectedZones[i];
            const preselectedZone = this.config.zones[selectedZone];
            for (const rect of preselectedZone) {
                zone.push([rect[0], rect[1], rect[2], rect[3], this.vacuumZonedCleanupRepeats])
            }
        }
        if (debug && this.config.debug) {
            alert(JSON.stringify(zone));
        } else {
            this._hass.callService(this.service_domain, this.service_method, {
                entity_id: this.config.entity,
                command: "app_zoned_clean",
                params: zone
            }).then(() => this.launch_toast());
        }
    }

    getCardSize() {
        return 3;
    }

    convertCanvasToRealRect(rect, repeats) {
        const xy1 = this.convertCanvasToRealCoordinates(rect.x, rect.y);
        const xy2 = this.convertCanvasToRealCoordinates(rect.x + rect.w, rect.y + rect.h);
        const x1 = Math.min(xy1.x, xy2.x);
        const y1 = Math.min(xy1.y, xy2.y);
        const x2 = Math.max(xy1.x, xy2.x);
        const y2 = Math.max(xy1.y, xy2.y);
        return [x1, y1, x2, y2, repeats];
    }

    convertCanvasToRealCoordinates(canvasX, canvasY) {
        const {x, y} = this.swapAxisIfNeeded(canvasX, canvasY);
        const mapX = 25500 + (x / this.imageScale - this.config.base_position.x) / this.unit.x * 1000;
        const mapY = 25500 + (y / this.imageScale - this.config.base_position.y) / this.unit.y * 1000;
        return {x: Math.round(mapX), y: Math.round(mapY)};
    }

    convertRealToCanvasZone(mapX1, mapY1, mapX2, mapY2) {
        const {x: x1, y: y1} = this.convertRealToCanvasCoordinates(mapX1, mapY1);
        const {x: x2, y: y2} = this.convertRealToCanvasCoordinates(mapX2, mapY2);
        let x = Math.min(x1, x2);
        let y = Math.min(y1, y2);
        let w = Math.abs(x2 - x1);
        let h = Math.abs(y2 - y1);
        return {x, y, w, h};
    }

    convertRealToCanvasCoordinates(mapX, mapY) {
        const canvasX = ((mapX - 25500) / 1000 * this.unit.x + this.config.base_position.x) * this.imageScale;
        const canvasY = ((mapY - 25500) / 1000 * this.unit.y + this.config.base_position.y) * this.imageScale;
        return this.swapAxisIfNeeded(Math.round(canvasX), Math.round(canvasY));
    }

    swapAxisIfNeeded(x, y) {
        if (this.shouldSwapAxis) {
            return {x: y, y: x};
        }
        return {x: x, y: y};
    }

    getMapImage() {
        return this.shadowRoot.getElementById("mapBackground");
    }

    getCanvas() {
        return this.shadowRoot.getElementById("mapDrawing");
    }

    getPredefinedZonesIncreaseButton() {
        return this.shadowRoot.getElementById("increaseButton");
    }

    getMousePos(evt) {
        const canvas = this.getCanvas();
        const rect = canvas.getBoundingClientRect();
        return {
            x: Math.round(evt.clientX - rect.left),
            y: Math.round(evt.clientY - rect.top)
        };
    }

    convertTouchToMouse(evt) {
        if (evt.cancelable && this.mode === 2) {
            evt.preventDefault();
        }
        return {
            clientX: evt.changedTouches[0].clientX,
            clientY: evt.changedTouches[0].clientY,
            currentTarget: evt.currentTarget
        };
    }

    launch_toast() {
        const x = this.shadowRoot.getElementById("toast");
        x.className = "show";
        setTimeout(function () {
            x.className = x.className.replace("show", "");
        }, 2000);
    }

}

customElements.define('xiaomi-vacuum-map-card', XiaomiVacuumMapCard);
