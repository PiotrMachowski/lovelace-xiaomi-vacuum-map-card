#!/usr/bin/env node
/**
 * Puts the locally built bundle in front of the end-to-end tests.
 *
 * The installer step (`marketplace-install.cjs`) proves that a user can install a released version
 * from the repository URL. Behaviour tests, however, must run against the code in this checkout, not
 * the last release, otherwise a pull request can never be proven before it is released.
 *
 * This copies `dist/xiaomi-vacuum-map-card.js` over the installed file and gives the Lovelace
 * resource a fresh cache-buster, so the browser loads the branch build from the same path the
 * installer created.
 */
const fs = require("node:fs");
const path = require("node:path");

const BASE = process.env.E2E_HA_URL || "http://localhost:8123";
const AUTH = path.join(__dirname, ".auth", "token.json");
const CONFIG = path.join(__dirname, "ha", "config");
const BUNDLE = path.join(__dirname, "..", "..", "dist", "xiaomi-vacuum-map-card.js");
const INSTALLED = path.join(CONFIG, "www", "community", "lovelace-better-xiaomi-vacuum-map-card", "xiaomi-vacuum-map-card.js");

if (!fs.existsSync(BUNDLE)) {
    console.error(`missing ${BUNDLE}; run npm run build first`);
    process.exit(1);
}
if (!fs.existsSync(INSTALLED)) {
    console.error(`missing ${INSTALLED}; run node test/e2e/marketplace-install.cjs first`);
    process.exit(1);
}
fs.copyFileSync(BUNDLE, INSTALLED);
// The installer also writes pre-compressed siblings; a stale `.gz`/`.br` is preferred by Home
// Assistant's static handler and the browser would keep executing the released bundle.
for (const suffix of [".gz", ".br"]) {
    const sibling = `${INSTALLED}${suffix}`;
    if (fs.existsSync(sibling)) {
        fs.rmSync(sibling);
        console.log(`removed stale ${path.basename(sibling)}`);
    }
}
const bytes = fs.statSync(INSTALLED).size;
console.log(`branch build installed over the Marketplace copy (${bytes} bytes)`);

const { access_token: accessToken } = JSON.parse(fs.readFileSync(AUTH, "utf8"));

function socket() {
    return new Promise((resolve, reject) => {
        const connection = new WebSocket(`${BASE.replace("http", "ws")}/api/websocket`);
        let id = 0;
        const pending = new Map();
        connection.onmessage = event => {
            const message = JSON.parse(event.data);
            if (message.type === "auth_required") connection.send(JSON.stringify({ type: "auth", access_token: accessToken }));
            else if (message.type === "auth_ok") resolve({ send, close: () => connection.close() });
            else if (message.type === "result") {
                const call = pending.get(message.id);
                if (!call) return;
                pending.delete(message.id);
                if (message.success) call.resolve(message.result);
                else call.reject(new Error(`${call.type}: ${JSON.stringify(message.error)}`));
            }
        };
        connection.onerror = () => reject(new Error("websocket error"));
        function send(type, payload = {}) {
            return new Promise((resolveCall, rejectCall) => {
                const messageId = ++id;
                pending.set(messageId, { resolve: resolveCall, reject: rejectCall, type });
                connection.send(JSON.stringify({ id: messageId, type, ...payload }));
            });
        }
    });
}

async function main() {
    const ws = await socket();
    const resources = await ws.send("lovelace/resources");
    const resource = resources.find(entry => entry.url.includes("lovelace-better-xiaomi-vacuum-map-card"));
    if (!resource) throw new Error("no installed card resource; run marketplace-install.cjs first");
    const base = resource.url.split("?")[0];
    const version = Date.now().toString(36);
    await ws.send("lovelace/resources/update", {
        resource_id: resource.id,
        res_type: "module",
        url: `${base}?v=branch-${version}`,
    });
    console.log(`resource cache-buster updated: ${base}?v=branch-${version}`);
    ws.close();
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
