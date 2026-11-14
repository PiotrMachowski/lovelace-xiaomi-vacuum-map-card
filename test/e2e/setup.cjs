#!/usr/bin/env node
/**
 * Bootstraps the Home Assistant end-to-end instance.
 *
 * Runs the onboarding API, then uses the websocket API to register the card resource and create the
 * dashboards the Playwright specs open. Idempotent: re-running against an onboarded instance only
 * refreshes the dashboards.
 *
 * Usage: node test/e2e/setup.cjs [--reset]
 */
const fs = require("node:fs");
const path = require("node:path");

const BASE = process.env.E2E_HA_URL || "http://localhost:8123";
const USERNAME = process.env.E2E_HA_USER || "e2e";
const PASSWORD = process.env.E2E_HA_PASSWORD || "e2e-password";
const NAME = "E2E";
const CLIENT_ID = `${BASE}/`;
const ARTIFACTS = path.join(__dirname, "artifacts");
const AUTH_DIR = path.join(__dirname, ".auth");
const TOKEN_FILE = path.join(AUTH_DIR, "token.json");
const CARD_ENTITIES = path.join(ARTIFACTS, "entities.json");



async function api(pathname, options = {}) {
    const response = await fetch(`${BASE}${pathname}`, options);
    const text = await response.text();
    let body;
    try {
        body = text ? JSON.parse(text) : undefined;
    } catch {
        body = text;
    }
    return { status: response.status, body };
}

async function waitForOnboarding() {
    for (let attempt = 0; attempt < 120; attempt++) {
        try {
            const { status, body } = await api("/api/onboarding");
            if (status === 200 && Array.isArray(body)) return body;
        } catch {
            // not up yet
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    throw new Error("Home Assistant did not answer /api/onboarding in time");
}

async function onboard() {
    // 1. A saved token is the normal case on a persistent instance. Validate it first: Home Assistant
    //    answers 404 to the onboarding API once the instance is set up.
    if (fs.existsSync(TOKEN_FILE)) {
        const saved = JSON.parse(fs.readFileSync(TOKEN_FILE, "utf8")).access_token;
        const check = await api("/api/", { headers: { authorization: `Bearer ${saved}` } }).catch(() => ({ status: 0 }));
        if (check.status === 200) {
            console.log("reusing the saved token");
            return saved;
        }
        fs.rmSync(TOKEN_FILE, { force: true });
    }

    // 2. A fresh instance: create the owner through the onboarding API.
    let steps;
    try {
        steps = await api("/api/onboarding");
    } catch {
        steps = { status: 0 };
    }
    const userStep = steps.status === 200 && Array.isArray(steps.body) ? steps.body.find(step => step.step === "user") : undefined;
    if (userStep && !userStep.done) {
        return await createOwner();
    }

    // 3. An instance that is already set up but whose token file was lost: log in with the known
    //    credentials, which yields a fresh authorization code.
    return await loginWithCredentials();
}

async function createOwner() {
    const created = await api("/api/onboarding/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ client_id: CLIENT_ID, name: NAME, username: USERNAME, password: PASSWORD, language: "en" }),
    });
    if (created.status !== 200) throw new Error(`onboarding/users failed: ${created.status} ${JSON.stringify(created.body)}`);

    const token = await api("/auth/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "authorization_code", code: created.body.auth_code, client_id: CLIENT_ID }).toString(),
    });
    if (token.status !== 200) throw new Error(`auth/token failed: ${token.status} ${JSON.stringify(token.body)}`);

    const auth = { headers: { authorization: `Bearer ${token.body.access_token}`, "content-type": "application/json" } };
    await api("/api/onboarding/core_config", { method: "POST", ...auth, body: "{}" });
    await api("/api/onboarding/analytics", { method: "POST", ...auth, body: "{}" });
    await api("/api/onboarding/integration", {
        method: "POST",
        ...auth,
        body: JSON.stringify({ client_id: CLIENT_ID, redirect_uri: `${BASE}/?auth_callback=1` }),
    });
    saveToken(token.body);
    console.log("onboarding complete");
    return token.body.access_token;
}

async function loginWithCredentials() {
    const flow = await api("/auth/login_flow", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ client_id: CLIENT_ID, handler: ["homeassistant", null], redirect_uri: `${BASE}/?auth_callback=1` }),
    });
    if (flow.status !== 200) throw new Error(`login_flow failed: ${flow.status} ${JSON.stringify(flow.body)}`);
    const step = await api(`/auth/login_flow/${flow.body.flow_id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ client_id: CLIENT_ID, username: USERNAME, password: PASSWORD }),
    });
    if (step.status !== 200 || !step.body.result) throw new Error(`login failed: ${step.status} ${JSON.stringify(step.body)}`);
    const token = await api("/auth/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "authorization_code", code: step.body.result, client_id: CLIENT_ID }).toString(),
    });
    if (token.status !== 200) throw new Error(`auth/token failed: ${token.status}`);
    saveToken(token.body);
    console.log("logged in with the e2e credentials");
    return token.body.access_token;
}

function saveToken(body) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
    fs.writeFileSync(TOKEN_FILE, JSON.stringify({ access_token: body.access_token, refresh_token: body.refresh_token }, null, 2));
}

function connectWebSocket(token) {
    return new Promise((resolve, reject) => {
        const socket = new WebSocket(`${BASE.replace("http", "ws")}/api/websocket`);
        let id = 0;
        const pending = new Map();
        const send = (type, payload = {}) =>
            new Promise((resolveCall, rejectCall) => {
                const messageId = ++id;
                pending.set(messageId, { resolve: resolveCall, reject: rejectCall, type });
                socket.send(JSON.stringify({ id: messageId, type, ...payload }));
            });
        socket.onmessage = event => {
            const message = JSON.parse(event.data);
            if (message.type === "auth_required") {
                socket.send(JSON.stringify({ type: "auth", access_token: token }));
            } else if (message.type === "auth_ok") {
                resolve({ send, close: () => socket.close() });
            } else if (message.type === "auth_invalid") {
                reject(new Error("websocket auth failed"));
            } else if (message.type === "result") {
                const call = pending.get(message.id);
                if (!call) return;
                pending.delete(message.id);
                if (message.success) call.resolve(message.result);
                else call.reject(new Error(`${call.type}: ${JSON.stringify(message.error)}`));
            }
        };
        socket.onerror = () => reject(new Error("websocket error"));
    });
}

function card(overrides = {}) {
    return {
        type: "custom:xiaomi-vacuum-map-card",
        entity: process.env.E2E_VACUUM || "vacuum.demo_vacuum_0_ground_floor",
        vacuum_platform: "Xiaomi Miio",
        map_source: { camera: "camera.vacuum_map" },
        calibration_source: {
            calibration_points: [
                { map: { x: 0, y: 0 }, vacuum: { x: 0, y: 0 } },
                { map: { x: 200, y: 0 }, vacuum: { x: 2000, y: 0 } },
                { map: { x: 0, y: 150 }, vacuum: { x: 0, y: 1500 } },
            ],
        },
        map_modes: [
            {
                // A ROOM mode first so the card renders rooms from the camera metadata and the map
                // colours; this is the fork's main path and the one the room badges and hit test use.
                name: "Rooms",
                icon: "mdi:floor-plan",
                selection_type: "ROOM",
                service_call_schema: {
                    service: "vacuum.send_command",
                    service_data: { command: "app_segment_clean", params: "[[selection]]" },
                },
                predefined_selections: [
                    { id: "0", label: { text: "Kitchen", x: 500, y: 450 } },
                    { id: "1", label: { text: "Living room", x: 1350, y: 450 } },
                    { id: "2", label: { text: "Bedroom", x: 500, y: 1100 } },
                ],
            },
            { template: "vacuum_clean_zone" },
        ],
        ...overrides,
    };
}

async function main() {
    if (process.argv.includes("--reset")) {
        fs.rmSync(TOKEN_FILE, { force: true });
    }
    const token = await onboard();
    const ws = await connectWebSocket(token);

    // The card resource is registered by the Marketplace install (`marketplace-install.cjs`), so the
    // suite runs against the artifact a user actually gets. Only the older manual path registers a
    // resource here; keep that out of the way when one exists.

    // Storage dashboards used by the specs.
    const dashboards = [
        {
            url_path: "e2e-map",
            title: "E2E map",
            config: {
                title: "E2E map",
                views: [
                    {
                        title: "Map",
                        path: "map",
                        cards: [card({ map_view: { scale: 2.5, x: 40, y: -20, rotation: 90 } })],
                    },
                ],
            },
        },
        {
            url_path: "e2e-stale",
            title: "E2E stale rooms",
            config: {
                title: "E2E stale rooms",
                views: [{ title: "Rooms", path: "rooms", cards: [card()] }],
            },
        },
        {
            url_path: "e2e-editor",
            title: "E2E editor",
            config: {
                title: "E2E editor",
                views: [
                    {
                        title: "Editor",
                        path: "editor",
                        cards: [
                            card({
                                map_modes: [
                                    {
                                        // A ROOM mode with no rooms yet: the editor's "Generate rooms
                                        // config" is the only thing that can fill it, so the test can
                                        // prove the button did the work.
                                        name: "Rooms",
                                        icon: "mdi:floor-plan",
                                        selection_type: "ROOM",
                                        service_call_schema: {
                                            service: "vacuum.send_command",
                                            service_data: { command: "app_segment_clean", params: "[[selection]]" },
                                        },
                                        predefined_selections: [],
                                    },
                                ],
                            }),
                        ],
                    },
                ],
            },
        },
        {
            url_path: "e2e-layout",
            title: "E2E layout",
            config: {
                title: "E2E layout",
                views: [
                    {
                        title: "Sections",
                        path: "sections",
                        type: "sections",
                        sections: [
                            {
                                type: "grid",
                                cards: [
                                    card({
                                        layout: "horizontal",
                                        map_modes: [
                                            {
                                                name: "Clean selected rooms with the longest possible name",
                                                icon: "mdi:broom",
                                                selection_type: "ROOM",
                                                service_call_schema: {
                                                    service: "vacuum.send_command",
                                                    service_data: { command: "app_segment_clean", params: "[[selection]]" },
                                                },
                                            },
                                            { template: "vacuum_clean_zone" },
                                        ],
                                    }),
                                ],
                            },
                        ],
                    },
                    {
                        title: "Vertical",
                        path: "vertical",
                        cards: [card()],
                    },
                ],
            },
        },
    ];

    for (const dashboard of dashboards) {
        try {
            await ws.send("lovelace/dashboards/create", {
                url_path: dashboard.url_path,
                title: dashboard.title,
                icon: "mdi:test-tube",
                show_in_sidebar: true,
                require_admin: false,
                mode: "storage",
            });
        } catch (error) {
            if (!String(error.message).includes("already_exists")) throw error;
        }
        await ws.send("lovelace/config/save", { url_path: dashboard.url_path, config: dashboard.config });
    }

    const entities = await ws.send("get_states");
    const summary = entities
        .filter(entity => /^(vacuum|camera)\./.test(entity.entity_id))
        .map(entity => ({ entity_id: entity.entity_id, state: entity.state, attributes: Object.keys(entity.attributes) }));
    fs.writeFileSync(CARD_ENTITIES, JSON.stringify(summary, null, 2));
    console.log(`dashboards ready: ${dashboards.map(d => d.url_path).join(", ")}`);
    console.log(`entities: ${summary.map(entity => entity.entity_id).join(", ")}`);
    ws.close();
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
