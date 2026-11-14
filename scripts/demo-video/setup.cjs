#!/usr/bin/env node
/**
 * Prepares the demo Home Assistant for recording: onboards it, copies this checkout's build into
 * `/local`, registers it as a dashboard resource and writes the demo dashboard.
 *
 * Idempotent. Usage: node scripts/demo-video/setup.cjs
 */
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const BASE = process.env.DEMO_HA_URL || "http://localhost:8130";
const USERNAME = "demo";
const PASSWORD = "demo-password";
const CLIENT_ID = `${BASE}/`;
const AUTH_FILE = path.join(__dirname, ".auth", "token.json");
const WWW = path.join(__dirname, "ha", "config", "www");

async function api(pathname, options = {}) {
    const response = await fetch(`${BASE}${pathname}`, options);
    const text = await response.text();
    try {
        return { status: response.status, body: text ? JSON.parse(text) : undefined };
    } catch {
        return { status: response.status, body: text };
    }
}

async function waitForHomeAssistant() {
    for (let attempt = 0; attempt < 120; attempt++) {
        const result = await api("/api/onboarding").catch(() => undefined);
        if (result && (result.status === 200 || result.status === 404)) return result;
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    throw new Error(`Home Assistant did not start at ${BASE}`);
}

async function exchange(code) {
    const token = await api("/auth/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "authorization_code", code, client_id: CLIENT_ID }).toString(),
    });
    if (token.status !== 200) throw new Error(`auth/token failed: ${token.status}`);
    fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
    fs.writeFileSync(AUTH_FILE, JSON.stringify(token.body, null, 2));
    return token.body.access_token;
}

async function authenticate(onboarding) {
    const userStep = Array.isArray(onboarding.body) ? onboarding.body.find(step => step.step === "user") : undefined;
    if (userStep && !userStep.done) {
        const created = await api("/api/onboarding/users", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ client_id: CLIENT_ID, name: "Demo", username: USERNAME, password: PASSWORD, language: "en" }),
        });
        if (created.status !== 200) throw new Error(`onboarding failed: ${created.status}`);
        const token = await exchange(created.body.auth_code);
        const auth = { headers: { authorization: `Bearer ${token}`, "content-type": "application/json" } };
        await api("/api/onboarding/core_config", { method: "POST", ...auth, body: "{}" });
        await api("/api/onboarding/analytics", { method: "POST", ...auth, body: "{}" });
        await api("/api/onboarding/integration", {
            method: "POST",
            ...auth,
            body: JSON.stringify({ client_id: CLIENT_ID, redirect_uri: `${BASE}/?auth_callback=1` }),
        });
        return token;
    }
    const flow = await api("/auth/login_flow", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ client_id: CLIENT_ID, handler: ["homeassistant", null], redirect_uri: `${BASE}/?auth_callback=1` }),
    });
    const step = await api(`/auth/login_flow/${flow.body.flow_id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ client_id: CLIENT_ID, username: USERNAME, password: PASSWORD }),
    });
    if (!step.body?.result) throw new Error(`login failed: ${JSON.stringify(step.body)}`);
    return exchange(step.body.result);
}

function connect(token) {
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
            if (message.type === "auth_required") socket.send(JSON.stringify({ type: "auth", access_token: token }));
            else if (message.type === "auth_ok") resolve({ send, close: () => socket.close() });
            else if (message.type === "auth_invalid") reject(new Error("websocket auth failed"));
            else if (message.type === "result") {
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

const roomsMode = { template: "vacuum_clean_segment" };

/** The card on the recorded dashboard: two floors, the fork's room detection and every map mode. */
const CARD = {
    type: "custom:xiaomi-vacuum-map-card",
    title: "Robot vacuum",
    preset_name: "Ground floor",
    entity: "vacuum.robot_vacuum",
    vacuum_platform: "Xiaomi Miio",
    map_source: { camera: "camera.ground_floor_map" },
    calibration_source: { camera: true },
    map_modes: [roomsMode, { template: "vacuum_clean_zone" }, { template: "vacuum_goto" }, { template: "vacuum_follow_path" }],
    additional_presets: [
        {
            preset_name: "First floor",
            entity: "vacuum.robot_vacuum",
            vacuum_platform: "Xiaomi Miio",
            map_source: { camera: "camera.first_floor_map" },
            calibration_source: { camera: true },
            map_modes: [roomsMode, { template: "vacuum_clean_zone" }],
        },
    ],
};

async function main() {
    const bundle = path.join(ROOT, "dist", "xiaomi-vacuum-map-card.js");
    if (!fs.existsSync(bundle)) throw new Error("Run `npm run build` first: dist/xiaomi-vacuum-map-card.js is missing");
    fs.mkdirSync(WWW, { recursive: true });
    fs.copyFileSync(bundle, path.join(WWW, "xiaomi-vacuum-map-card.js"));

    const token = await authenticate(await waitForHomeAssistant());
    const ws = await connect(token);

    const url = `/local/xiaomi-vacuum-map-card.js?v=${Date.now()}`;
    const resources = await ws.send("lovelace/resources");
    for (const resource of resources.filter(entry => entry.url.includes("xiaomi-vacuum-map-card"))) {
        await ws.send("lovelace/resources/delete", { resource_id: resource.id });
    }
    await ws.send("lovelace/resources/create", { res_type: "module", url });

    try {
        await ws.send("lovelace/dashboards/create", {
            url_path: "vacuum-demo",
            title: "Vacuum",
            icon: "mdi:robot-vacuum",
            show_in_sidebar: true,
            require_admin: false,
            mode: "storage",
        });
    } catch (error) {
        if (!String(error.message).includes("already_exists")) throw error;
    }
    await ws.send("lovelace/config/save", {
        url_path: "vacuum-demo",
        config: { title: "Vacuum", views: [{ title: "Map", path: "map", cards: [CARD] }] },
    });

    const states = await ws.send("get_states");
    const ids = states.map(state => state.entity_id).filter(id => /^(vacuum|camera)\./.test(id));
    console.log(`demo dashboard ready at ${BASE}/vacuum-demo/map (${ids.join(", ")})`);
    ws.close();
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
