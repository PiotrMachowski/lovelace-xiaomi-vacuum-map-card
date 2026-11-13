import { describe, expect, it, vi } from "vitest";
import type { HassEntity } from "home-assistant-js-websocket/dist/types";

import { Tile } from "../../src/components/tile";

// The component has to be registered even though the class is only used as a type below; esbuild
// would otherwise elide the import.
void Tile;
import { TilesGenerator } from "../../src/model/generators/tiles-generator";
import type { HomeAssistantFixed } from "../../src/types/fixes";
import type { TileConfig } from "../../src/types/types";
import { fixtureHass, loadSyntheticFixture, withState, type MockHass } from "../harness";

const VACUUM = "vacuum.roborock_s7";
const STATUS = "status";

interface RenderedTile {
    label: string;
    value: string;
}

/**
 * Mounts the real `<xvmc-tile>` element. The component is rootless, so the rendered nodes sit in
 * the element itself and a plain `querySelector` is enough.
 */
async function renderTile(config: TileConfig, hass: HomeAssistantFixed): Promise<RenderedTile> {
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
    return {
        label: tile.querySelector(".tile-title")?.textContent?.trim() ?? "",
        value: tile.querySelector(".tile-value")?.textContent?.trim() ?? "",
    };
}

function hassWithStatus(value: string): MockHass {
    const hass = fixtureHass(loadSyntheticFixture());
    const vacuum = hass.states[VACUUM];
    return withState(hass, VACUUM, {
        attributes: { ...vacuum.attributes, [STATUS]: value },
    }).hass;
}

/** A hass whose frontend formatter returns a registry-aware name. */
function hassWithEntityNameFormatter(name: string): MockHass & { formatEntityName: ReturnType<typeof vi.fn> } {
    const hass = fixtureHass(loadSyntheticFixture());
    return { ...hass, formatEntityName: vi.fn(() => name) } as MockHass & {
        formatEntityName: ReturnType<typeof vi.fn>;
    };
}

/**
 * The 2025.10 frontend formatter. Its signature is `(stateObj, type, separator = " ")`, and it runs
 * `ensureArray(type)` before iterating the result, so the `undefined` this card passes throws
 * `TypeError: undefined is not iterable`. Calling it on a 2025.10 hass is the crash the version
 * gate prevents.
 */
function hassWithLegacyEntityNameFormatter(version: string): MockHass & { formatEntityName: ReturnType<typeof vi.fn> } {
    const hass = fixtureHass(loadSyntheticFixture(), { configVersion: version });
    const formatEntityName = vi.fn((_stateObj: HassEntity, type?: string | string[]): string => {
        const types = type as unknown as string[];
        let joined = "";
        for (const item of types) joined += item;
        return joined;
    });
    return { ...hass, formatEntityName } as MockHass & { formatEntityName: ReturnType<typeof vi.fn> };
}

/** A hass whose formatter exists and passes the version gate but throws, like a future signature change. */
function hassWithThrowingEntityNameFormatter(): MockHass & { formatEntityName: ReturnType<typeof vi.fn> } {
    const hass = fixtureHass(loadSyntheticFixture());
    return { ...hass, formatEntityName: vi.fn(() => { throw new TypeError("formatter signature changed"); }) } as MockHass & {
        formatEntityName: ReturnType<typeof vi.fn>;
    };
}

/**
 * Simulates an older Home Assistant frontend that does not ship `hass.formatEntityName` yet.
 * `mockHass` always provides one, so the property has to be removed for this case.
 */
function hassWithoutEntityNameFormatter(): MockHass {
    const hass = fixtureHass(loadSyntheticFixture());
    delete (hass as unknown as Record<string, unknown>).formatEntityName;
    return hass;
}

describe("tile translations (#723)", () => {
    const tile = (translations: Record<string, string>): TileConfig => ({
        entity: VACUUM,
        attribute: STATUS,
        translations,
    });

    it("matches a lower-case key against a mixed-case value", async () => {
        const rendered = await renderTile(tile({ charging: "Ładowanie" }), hassWithStatus("Charging"));
        expect(rendered.value).toBe("Ładowanie");
    });

    it("matches a mixed-case key against a lower-case value", async () => {
        const rendered = await renderTile(tile({ Charging: "ŁADOWANIE" }), hassWithStatus("charging"));
        expect(rendered.value).toBe("ŁADOWANIE");
    });

    it("matches a mixed-case key against a differently-cased value and keeps the translation's casing", async () => {
        const rendered = await renderTile(tile({ cHaRgInG: "W trakcie ładowania" }), hassWithStatus("CHARGING"));
        expect(rendered.value).toBe("W trakcie ładowania");
    });

    it("keeps the value's own casing when no translation matches", async () => {
        const rendered = await renderTile(tile({}), hassWithStatus("MixedCase"));
        expect(rendered.value).toBe("MixedCase");
    });

    it("prefers an exact lower-case key over an earlier mixed-case key", async () => {
        // Master resolved the lower-cased value as an exact key, so `charging` wins over the
        // earlier `Charging`; the case-insensitive scan must not change that.
        const rendered = await renderTile(
            tile({ Charging: "A", charging: "B" }),
            hassWithStatus("Charging"),
        );
        expect(rendered.value).toBe("B");
    });
});

describe("tile labels (#957)", () => {
    function labelTile(): TileConfig {
        return { entity: "sensor.roborock_s7_status" };
    }

    it("asks hass.formatEntityName before the friendly name", async () => {
        const hass = hassWithEntityNameFormatter("Registry name");
        const rendered = await renderTile(labelTile(), hass);
        expect(rendered.label).toBe("Registry name");
        expect(hass.formatEntityName).toHaveBeenCalled();
    });

    it("returns the friendly name on a 2025.10 frontend instead of throwing", async () => {
        // The 2025.10 formatter iterates its second argument, so calling it with `undefined` throws
        // `TypeError: undefined is not iterable`. Without the version gate this render rejects.
        const hass = hassWithLegacyEntityNameFormatter("2025.10.3");
        const rendered = await renderTile(labelTile(), hass);
        expect(rendered.label).toBe("Roborock S7 Status");
        // The gate is what keeps the incompatible call from happening at all; a try/catch alone
        // would hide the crash but still call a formatter whose contract this card does not meet.
        expect(hass.formatEntityName).not.toHaveBeenCalled();
    });

    it("returns the friendly name on a 2026.3 frontend", async () => {
        const hass = hassWithLegacyEntityNameFormatter("2026.3.4");
        const rendered = await renderTile(labelTile(), hass);
        expect(rendered.label).toBe("Roborock S7 Status");
        expect(hass.formatEntityName).not.toHaveBeenCalled();
    });

    it("takes the resolver path on 2026.10 even though \"2026.10.3\" sorts below \"2026.4\" as text", async () => {
        const hass = { ...hassWithEntityNameFormatter("Registry name"), config: { version: "2026.10.3" } } as MockHass & {
            formatEntityName: ReturnType<typeof vi.fn>;
        };
        const rendered = await renderTile(labelTile(), hass);
        expect(rendered.label).toBe("Registry name");
        expect(hass.formatEntityName).toHaveBeenCalled();
    });

    it("falls back to the friendly name when hass.formatEntityName throws", async () => {
        const hass = hassWithThrowingEntityNameFormatter();
        const rendered = await renderTile(labelTile(), hass);
        expect(rendered.label).toBe("Roborock S7 Status");
        expect(hass.formatEntityName).toHaveBeenCalled();
    });

    it("falls back to the friendly name when the formatter returns nothing", async () => {
        const hass = { ...fixtureHass(loadSyntheticFixture()), formatEntityName: vi.fn(() => "") } as MockHass;
        const rendered = await renderTile(labelTile(), hass);
        expect(rendered.label).toBe("Roborock S7 Status");
    });

    it("falls back to the friendly name when hass has no formatEntityName", async () => {
        const rendered = await renderTile(labelTile(), hassWithoutEntityNameFormatter());
        expect(rendered.label).toBe("Roborock S7 Status");
    });

    it("falls back to the entity id when neither is available", async () => {
        const hass = hassWithoutEntityNameFormatter();
        const status = hass.states["sensor.roborock_s7_status"];
        const { hass: withoutFriendlyName } = withState(hass, "sensor.roborock_s7_status", {
            attributes: { ...status.attributes, friendly_name: undefined },
        });
        const rendered = await renderTile(labelTile(), withoutFriendlyName);
        expect(rendered.label).toBe("sensor.roborock_s7_status");
    });
});

describe("autogenerated tiles for the synthetic fixture", () => {
    // Captured before the #723/#957/#965 changes and deliberately left unchanged: tiles that do not
    // opt into duration_unit must render byte-identically.
    it("renders the generated tile list", async () => {
        const hass = fixtureHass(loadSyntheticFixture());
        const tiles = await TilesGenerator.generate(hass, VACUUM, "Xiaomi Miio", "en", [], {});
        expect(tiles.length).toBeGreaterThan(0);

        const rendered: Array<RenderedTile & { tile_id: string }> = [];
        for (const config of tiles) {
            rendered.push({ tile_id: config.tile_id ?? "", ...(await renderTile(config, hass)) });
        }
        expect(rendered).toMatchSnapshot();
    });
});
