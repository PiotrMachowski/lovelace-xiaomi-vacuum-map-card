import { describe, expect, it } from "vitest";

import { Tile } from "../../src/components/tile";
import { TilesGenerator } from "../../src/model/generators/tiles-generator";
import type { HomeAssistantFixed } from "../../src/types/fixes";
import type { TileConfig } from "../../src/types/types";
import { fixtureHass, loadSyntheticFixture, withRegistryEntries, withState, type MockHass } from "../harness";

// Component registration is a side effect of this import; keep it alive for esbuild.
void Tile;

const VACUUM = "vacuum.roborock_s7";
const DEVICE = "device-roborock-s7";

interface DurationSensor {
    entityId: string;
    uniqueId: string;
    state: string;
    unit?: string;
}

/** Builds a hass holding the synthetic vacuum plus one Roborock-core style sensor. */
function hassWithSensor(sensor: DurationSensor): MockHass {
    const fixture = loadSyntheticFixture();
    const withRegistry = withRegistryEntries(fixtureHass(fixture), [
        {
            entity_id: sensor.entityId,
            unique_id: sensor.uniqueId,
            device_id: DEVICE,
            original_name: sensor.entityId,
        },
    ]);
    return withState(withRegistry, sensor.entityId, {
        state: sensor.state,
        attributes: {
            friendly_name: sensor.entityId,
            ...(sensor.unit === undefined ? {} : { unit_of_measurement: sensor.unit }),
        },
    }).hass;
}

async function generatedTiles(hass: HomeAssistantFixed): Promise<TileConfig[]> {
    return TilesGenerator.generate(hass, VACUUM, "Roborock", "en", [], {});
}

/** Mounts the real `<xvmc-tile>` element and returns its rendered value. */
async function renderTileValue(config: TileConfig, hass: HomeAssistantFixed): Promise<string> {
    const tile = document.createElement("xvmc-tile") as Tile;
    Object.assign(tile, {
        config,
        hass,
        isInEditor: false,
        onAction: () => () => undefined,
        internalVariables: {},
    });
    document.body.appendChild(tile);
    await tile.updateComplete;
    return tile.querySelector(".tile-value")?.textContent?.trim() ?? "";
}

function findTile(tiles: TileConfig[], tileId: string): TileConfig {
    const tile = tiles.find(candidate => candidate.tile_id === tileId);
    if (!tile) throw new Error(`no generated tile with id ${tileId}`);
    return tile;
}

describe("Roborock duration tiles (#965)", () => {
    // `main_brush_time_left` asks for hours. Roborock core reports the remaining life in ms, s,
    // min, h or d depending on the firmware, so the multiplier has to follow the sensor unit.
    const hoursCases: Array<{ unit: string; state: string; multiplier: number; rendered: string }> = [
        { unit: "ms", state: "7200000", multiplier: 1 / 3600000, rendered: "2 h" },
        { unit: "s", state: "7200", multiplier: 1 / 3600, rendered: "2 h" },
        { unit: "min", state: "120", multiplier: 1 / 60, rendered: "2 h" },
        { unit: "h", state: "2", multiplier: 1, rendered: "2 h" },
        { unit: "d", state: "0.08333333333333333", multiplier: 24, rendered: "2 h" },
    ];

    for (const testCase of hoursCases) {
        it(`derives the hours multiplier from a sensor reporting ${testCase.unit}`, async () => {
            const hass = hassWithSensor({
                entityId: "sensor.main_brush_time_left",
                uniqueId: "main_brush_time_left_1",
                state: testCase.state,
                unit: testCase.unit,
            });
            const tile = findTile(await generatedTiles(hass), "main_brush_left");

            expect(tile.multiplier).toBeCloseTo(testCase.multiplier, 10);
            expect(await renderTileValue(tile, hass)).toBe(testCase.rendered);
        });
    }

    it("assumes seconds for an unknown sensor unit", async () => {
        const hass = hassWithSensor({
            entityId: "sensor.main_brush_time_left",
            uniqueId: "main_brush_time_left_1",
            state: "7200",
            unit: "weeks",
        });
        const tile = findTile(await generatedTiles(hass), "main_brush_left");

        expect(tile.multiplier).toBeCloseTo(1 / 3600, 10);
        expect(await renderTileValue(tile, hass)).toBe("2 h");
    });

    // Roborock core reports the cleaning time in minutes, which the old seconds-based multiplier
    // truncated to 0 min.
    it("renders a minute sensor as minutes", async () => {
        const hass = hassWithSensor({
            entityId: "sensor.cleaning_time",
            uniqueId: "cleaning_time_1",
            state: "31",
            unit: "min",
        });
        const tile = findTile(await generatedTiles(hass), "cleaning_time");

        expect(tile.multiplier).toBe(1);
        expect(await renderTileValue(tile, hass)).toBe("31 min");
    });

    it("leaves a template without duration_unit on its configured multiplier", async () => {
        const hass = hassWithSensor({
            entityId: "sensor.total_cleaning_count",
            uniqueId: "total_cleaning_count_1",
            state: "42",
        });
        const tile = findTile(await generatedTiles(hass), "cleaning_count");

        expect(tile.multiplier).toBeUndefined();
        expect(await renderTileValue(tile, hass)).toBe("42");
    });
});
