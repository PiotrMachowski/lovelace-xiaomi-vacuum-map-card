#!/usr/bin/env node
/**
 * Connects a GitHub account to Home Assistant's Marketplace on the end-to-end instance.
 *
 * Home Assistant 2026.11 blocks the HACS custom integration and ships the Marketplace instead. A
 * fresh Marketplace needs a GitHub account before it can add a custom repository; the interactive
 * device flow cannot run in a headless test, so this writes the token into the Marketplace config
 * entry exactly where the flow stores it, then asks for a restart.
 *
 * The token comes from GITHUB_TOKEN (or `gh auth token` when that is available) and is written only
 * to `test/e2e/ha/config/.storage`, which is gitignored. It is never part of the repository.
 *
 * Usage: GITHUB_TOKEN=... node test/e2e/connect-github.cjs [--restart]
 */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const CONFIG = path.join(__dirname, "ha", "config");
const ENTRIES = path.join(CONFIG, ".storage", "core.config_entries");

function tokenFromEnvironment() {
    if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN.trim();
    try {
        return execFileSync("gh", ["auth", "token"], { encoding: "utf8" }).trim();
    } catch {
        throw new Error("no GitHub token: set GITHUB_TOKEN or log in with `gh auth login`");
    }
}

function main() {
    if (!fs.existsSync(ENTRIES)) {
        throw new Error(`${ENTRIES} does not exist; start Home Assistant and run test/e2e/setup.cjs first`);
    }
    const token = tokenFromEnvironment();
    const data = JSON.parse(fs.readFileSync(ENTRIES, "utf8"));
    const entries = data.data.entries;
    const marketplace = entries.find(entry => entry.domain === "marketplace");
    if (!marketplace) {
        throw new Error("no marketplace config entry; Home Assistant 2026.11 creates one on first start");
    }
    marketplace.data = { ...(marketplace.data ?? {}), token };

    const wantsRestart = process.argv.includes("--restart");
    const composeArgs = ["compose", "-f", path.join(__dirname, "compose.yaml")];
    const project = process.env.COMPOSE_PROJECT_NAME;
    if (project) composeArgs.push("-p", project);
    // Stop first: Home Assistant rewrites the config-entry store while it runs, so a token written
    // under a live instance can be overwritten on shutdown.
    if (wantsRestart) execFileSync("docker", [...composeArgs, "stop"], { stdio: "inherit" });

    fs.writeFileSync(ENTRIES, JSON.stringify(data, null, 2));
    // Keep the token off disk anywhere else, including logs.
    console.log(`marketplace GitHub token written to the ignored state file for entry ${marketplace.entry_id}`);

    if (wantsRestart) {
        execFileSync("docker", [...composeArgs, "start"], { stdio: "inherit" });
        console.log("Home Assistant restarted; wait for /api/ before running the install");
    }
    // Best-effort hygiene: no token is left in the shell history or a tracked file by this script.
    void os;
}

main();
