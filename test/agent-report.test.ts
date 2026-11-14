import { describe, expect, it } from "vitest";
import {
    buildReport,
    cardVersionFromBundle,
    collectRaw,
    findCards,
    issueTitle,
    missingFields,
    parseIssueBody,
    renderIssueBody,
    reviewIssue,
    scrubSecrets,
    BODY_LIMIT,
    MARKER,
} from "../scripts/agent-report/core.mjs";

const JWT = "eyJhbGciOiJIUzI1NiJ9.eyJpc3MiOiIxMjM0NTY3ODkwYWJjZGVmIn0.c2lnbmF0dXJlLXNpZ25hdHVyZQ";
const DUID = "5ab3Cd9eF0a1b2C3d4E5";

function rawSnapshot() {
    const card = {
        type: "custom:xiaomi-vacuum-map-card",
        entity: "vacuum.bartek_roborock",
        vacuum_platform: "Roborock",
        map_source: { camera: "image.bartek_roborock_downstairs" },
        calibration_source: { camera: true },
        tiles: [{ entity: "sensor.bartek_roborock_battery", label: "Battery" }],
    };
    return {
        raw_schema: 1,
        ha_config: { version: "2026.11.1", latitude: 52.1, longitude: 21.0, location_name: "Home", external_url: "https://my.home.example" },
        cards: [{ dashboard: "default", path: "views.0.cards.2", config: card }],
        resources: [{ url: "/hacsfiles/lovelace-better-xiaomi-vacuum-map-card/xiaomi-vacuum-map-card.js?hacstag=12345", type: "module" }],
        states: [
            { entity_id: "vacuum.bartek_roborock", state: "docked", attributes: { friendly_name: "Bartek's Roborock", battery_level: 100 } },
            {
                entity_id: "image.bartek_roborock_downstairs",
                state: "2026-11-14T10:00:00",
                attributes: {
                    friendly_name: "Downstairs",
                    entity_picture: `/api/image_proxy/image.bartek_roborock_downstairs?token=${"a".repeat(64)}`,
                    calibration_points: [{ vacuum: { x: 1, y: 2 }, map: { x: 3, y: 4 } }, {}, {}],
                    rooms: { 16: { name: "Kitchen", x0: 1, y0: 2, x1: 3, y1: 4 }, 17: { name: "Office" } },
                    ip: "192.168.1.23",
                    path: Array.from({ length: 3000 }, (_, i) => [i, i * 2]),
                },
            },
            { entity_id: "sensor.bartek_roborock_battery", state: "100", attributes: { unit_of_measurement: "%" } },
            { entity_id: "light.unrelated", state: "on", attributes: {} },
        ],
        entity_registry: [
            { entity_id: "vacuum.bartek_roborock", unique_id: `roborock.vacuum.${DUID}`, platform: "roborock", device_id: "dev123", translation_key: null },
            { entity_id: "image.bartek_roborock_downstairs", unique_id: `${DUID}_map_0`, platform: "roborock", device_id: "dev123", translation_key: "map" },
            { entity_id: "sensor.bartek_roborock_battery", unique_id: `battery_${DUID}`, platform: "roborock", device_id: "dev123", translation_key: "battery" },
            { entity_id: "sensor.bartek_roborock_main_brush", unique_id: `main_brush_time_left_${DUID}`, platform: "roborock", device_id: "dev123", translation_key: "main_brush_time_left", name: "Brush of Bartek" },
            { entity_id: "light.unrelated", unique_id: "x", platform: "hue", device_id: "other" },
        ],
        device_registry: [
            { id: "dev123", manufacturer: "Roborock", model: "roborock.vacuum.a15", sw_version: "4.3.5", serial_number: "R1234567890", name_by_user: "Bartek's bot", connections: [["mac", "aa:bb:cc:dd:ee:ff"]] },
            { id: "other", manufacturer: "Signify" },
        ],
        system_log: [
            { level: "ERROR", name: "homeassistant.components.roborock", message: ["Failed to connect to 192.168.1.23 for bartek@example.com"], source: ["/home/bartek/x.py", 1], count: 2 },
            { level: "ERROR", name: "homeassistant.components.hue", message: ["unrelated"], count: 1 },
        ],
        manifests: { roborock: { version: null, is_built_in: true } },
    };
}

function filled(report) {
    return {
        ...report,
        agent: { name: "Claude Code", model: "claude-opus-5-5" },
        problem: {
            summary: "Room outlines are offset after rotating the map. More detail.",
            expected: "Outlines stay on the rooms.",
            actual: "Outlines shift right by about 40 px.",
            reproduction: ["Open the dashboard", "Rotate the map 90°"],
            diagnosis: "",
            workaround: "",
            related: [],
        },
    };
}

describe("agent report collection", () => {
    it("finds the card inside nested stacks and sections, not other cards", () => {
        const found = findCards({
            views: [{ sections: [{ cards: [{ type: "vertical-stack", cards: [{ type: "custom:xiaomi-vacuum-map-card", entity: "vacuum.a" }] }] }] }, { cards: [{ type: "entities" }] }],
        });
        expect(found).toHaveLength(1);
        expect(found[0].path).toBe("views.0.sections.0.cards.0.cards.0");
    });

    it("keeps collecting when one Home Assistant command fails", async () => {
        const raw = await collectRaw(async (msg: { type: string; url_path?: string | null }) => {
            if (msg.type === "lovelace/dashboards/list") return [{ url_path: "vacuum" }];
            if (msg.type === "lovelace/config") {
                if (msg.url_path === null) throw new Error("config not found");
                return { views: [{ cards: [{ type: "custom:xiaomi-vacuum-map-card", entity: "vacuum.a" }] }] };
            }
            if (msg.type === "system_log/list") throw new Error("unknown command");
            return [];
        });
        expect(raw.cards).toEqual([expect.objectContaining({ dashboard: "vacuum" })]);
        expect(raw.system_log).toEqual({ __error: "unknown command" });
    });

    it("reads the card version from the bundle", () => {
        expect(cardVersionFromBundle('var a="v1.0.1",b=1')).toBe("v1.0.1");
        expect(cardVersionFromBundle("nothing")).toBeNull();
    });
});

describe("agent report redaction", () => {
    const report = buildReport(rawSnapshot(), { cardVersion: "v1.0.1" });
    const text = JSON.stringify(report);

    it("selects only what the card reads", () => {
        expect(text).not.toContain("light.");
        expect(text).not.toContain("Signify");
        expect(report.registry).toHaveLength(4);
        expect(report.logs.ha).toHaveLength(1);
        expect(report.map).toMatchObject({ source_type: "camera", rooms_count: 2, calibration_points: 3, camera_integration: "roborock" });
        expect(report.card).toMatchObject({ version: "v1.0.1", install: "hacs", build: "fork" });
    });

    it("removes tokens, network identifiers, serials, personal names and home location", () => {
        for (const leak of ["bartek", "Bartek", DUID, "R1234567890", "aa:bb:cc", "192.168.1.23", "example.com", "a".repeat(64), "52.1", "my.home.example"]) {
            expect(text).not.toContain(leak);
        }
        expect(report.states["vacuum.vacuum"].attributes.friendly_name).toBe("<friendly name>");
        expect(report.camera_attributes.entity_picture).toBe("/api/image_proxy/image.map?<redacted>");
    });

    it("aliases entity ids consistently across config, states and registry", () => {
        expect(report.card_config.entity).toBe("vacuum.vacuum");
        expect(report.card_config.map_source.camera).toBe("image.map");
        expect(report.card_config.tiles[0].entity).toBe("sensor.battery");
        expect(Object.keys(report.states).sort()).toEqual(["image.map", "sensor.battery", "vacuum.vacuum"]);
        expect(report.registry.map((e) => e.entity_id)).toContain("sensor.main_brush_time_left");
        expect(report.registry.find((e) => e.entity_id === "sensor.main_brush_time_left").renamed).toBe(true);
    });

    it("keeps the unique_id words platform templates match", () => {
        const ids = report.registry.map((e) => e.unique_id);
        expect(ids).toContain("main_brush_time_left_ID1");
        expect(ids).toContain("battery_ID1");
        expect(ids).toContain("ID1_map_0");
    });

    it("keeps the room geometry and names a map bug needs", () => {
        expect(report.camera_attributes.rooms["16"]).toEqual({ name: "Kitchen", x0: 1, y0: 2, x1: 3, y1: 4 });
    });

    it("lists what it redacted", () => {
        expect(report.redactions).toEqual(expect.arrayContaining(["map image not collected", expect.stringMatching(/^entity ids aliased/)]));
    });
});

describe("agent report issue body", () => {
    const base = buildReport(rawSnapshot(), { cardVersion: "v1.0.1" });

    it("requires the narrative fields before filing", () => {
        expect(missingFields(base)).toEqual(["agent.name", "problem.summary", "problem.expected", "problem.actual", "problem.reproduction"]);
        expect(missingFields(filled(base))).toEqual([]);
    });

    it("renders a marked body under GitHub's size limit that round-trips", () => {
        const body = renderIssueBody(filled(base));
        expect(body.startsWith(MARKER)).toBe(true);
        expect(body.length).toBeLessThanOrEqual(BODY_LIMIT);
        const parsed = parseIssueBody(body);
        expect(parsed.error).toBeNull();
        expect(parsed.report.camera_attributes.path.at(-1)).toMatch(/more trimmed/);
        expect(reviewIssue(body)).toMatchObject({ isAgent: true, complete: true, redactedBody: null });
        expect(issueTitle(filled(base))).toBe("Room outlines are offset after rotating the map (roborock, v1.0.1)");
    });

    it("flags an agent report whose data is missing or incomplete", () => {
        expect(reviewIssue(`${MARKER}\nno data`)).toMatchObject({ isAgent: true, complete: false, error: "report data block not found" });
        expect(reviewIssue(renderIssueBody(base))).toMatchObject({ isAgent: true, complete: false, missing: expect.arrayContaining(["problem.summary"]) });
    });

    it("leaves human reports unlabelled but still strips leaked secrets", () => {
        const review = reviewIssue(`My config\n\`\`\`\ntoken: ${JWT}\nurl: http://user:pass@ha.local/api?access_token=abc123\n\`\`\``);
        expect(review.isAgent).toBe(false);
        expect(review.redactedBody).not.toContain(JWT);
        expect(review.redactedBody).not.toContain("user:pass");
        expect(review.redactedBody).not.toContain("abc123");
        expect(review.secretHits).toMatchObject({ jwt: 1, "url-credentials": 1, "url-token": 1 });
    });

    it("does not rewrite ordinary text", () => {
        expect(scrubSecrets("Vacuum at 192.168.1.5 stops at room 16").hits).toEqual({});
    });
});
