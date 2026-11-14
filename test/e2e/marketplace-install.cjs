#!/usr/bin/env node
/**
 * Installs the card from the renamed repository URL on a current Home Assistant.
 *
 * Home Assistant 2026.11 ships the core `marketplace` integration, which supersedes HACS: it
 * installs custom integrations, dashboard resources, themes and templates from GitHub, and it
 * removes a HACS config entry as a duplicate when both are present. This script runs the same
 * repository-add and install commands the Marketplace panel calls, then proves the asset and the
 * Lovelace resource.
 */
const fs = require("node:fs");
const path = require("node:path");

const BASE = process.env.E2E_HA_URL || "http://localhost:8123";
const REPO_URL = "https://github.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card";
const REPO_NAME = "Igloczek/lovelace-better-xiaomi-vacuum-map-card";
const AUTH = path.join(__dirname, ".auth", "token.json");
const CONFIG = path.join(__dirname, "ha", "config");

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
    const info = await ws.send("marketplace/info");
    console.log(`marketplace ${info.version}, github_connected=${info.github_connected}, stage=${info.stage}`);

    await ws.send("marketplace/warning/accept");
    const detected = await ws.send("marketplace/repositories/detect", { repository: REPO_URL });
    console.log(`detected categories: ${detected.categories.join(", ")}`);
    if (!detected.categories.includes("plugin")) throw new Error("the repository is not detected as a dashboard resource");

    try {
        await ws.send("marketplace/repositories/add", { repository: REPO_URL, category: "plugin" });
    } catch (error) {
        if (!String(error.message).includes("already")) throw error;
    }

    const repositories = await ws.send("marketplace/repositories/list", { categories: ["plugin"] });
    const repository = repositories.find(entry => entry.full_name === REPO_NAME);
    if (!repository) throw new Error(`marketplace did not register ${REPO_NAME}`);
    console.log(`registered ${repository.full_name} id=${repository.id} version=${repository.available_version}`);

    await ws.send("marketplace/repository/install", { repository: repository.id });

    const installedFile = path.join(CONFIG, "www", "community", "lovelace-better-xiaomi-vacuum-map-card", "xiaomi-vacuum-map-card.js");
    for (let attempt = 0; attempt < 60 && !fs.existsSync(installedFile); attempt++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    if (!fs.existsSync(installedFile)) throw new Error(`marketplace did not install ${installedFile}`);
    console.log(`installed ${installedFile} (${fs.statSync(installedFile).size} bytes)`);

    const after = (await ws.send("marketplace/repositories/list", { categories: ["plugin"] })).find(
        entry => entry.full_name === REPO_NAME,
    );
    console.log(`marketplace reports installed=${after?.installed} version=${after?.installed_version}`);

    const resources = await ws.send("lovelace/resources");
    const resource = resources.find(entry => entry.url.includes("lovelace-better-xiaomi-vacuum-map-card"));
    if (!resource) throw new Error("no Lovelace resource was registered for the installed card");
    console.log(`lovelace resource: ${resource.url} (type ${resource.type})`);
    ws.close();
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
