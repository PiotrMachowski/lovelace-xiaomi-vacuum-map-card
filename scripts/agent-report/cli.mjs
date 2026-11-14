#!/usr/bin/env node
// Agent problem-report CLI. Node 22+, no dependencies, read-only against Home Assistant.
//
//   HA_URL=http://homeassistant.local:8123 HA_TOKEN=... node cli.mjs collect --out report.json
//   node cli.mjs collect --raw browser-snapshot.json --out report.json
//   node cli.mjs render report.json > issue.md      # also prints the title to stderr
//   node cli.mjs check issue.md                     # the same check the issue workflow runs
//
// See .agents/skills/report-problem/SKILL.md for the full procedure.

import { readFile, writeFile } from "node:fs/promises";
import {
    buildReport,
    cardVersionFromBundle,
    collectRaw,
    issueTitle,
    missingFields,
    renderIssueBody,
    reviewIssue,
} from "./core.mjs";

const [, , command, ...rest] = process.argv;
const args = {};
const positional = [];
for (let i = 0; i < rest.length; i++) {
    if (rest[i].startsWith("--")) {
        const key = rest[i].slice(2);
        args[key] = rest[i + 1] && !rest[i + 1].startsWith("--") ? rest[++i] : true;
    } else positional.push(rest[i]);
}

function fail(message) {
    console.error(`error: ${message}`);
    process.exit(1);
}

function connect(baseUrl, token) {
    if (typeof WebSocket === "undefined") fail("Node 22 or newer is required (global WebSocket).");
    const url = baseUrl.replace(/\/+$/, "").replace(/^http/, "ws") + "/api/websocket";
    const ws = new WebSocket(url);
    let nextId = 1;
    const pending = new Map();
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`no answer from ${url}`)), 15000);
        ws.addEventListener("error", () => reject(new Error(`cannot connect to ${url}`)));
        ws.addEventListener("message", (event) => {
            const msg = JSON.parse(event.data);
            if (msg.type === "auth_required") ws.send(JSON.stringify({ type: "auth", access_token: token }));
            else if (msg.type === "auth_invalid") reject(new Error("Home Assistant rejected the token"));
            else if (msg.type === "auth_ok") {
                clearTimeout(timer);
                resolve({
                    call: (payload) =>
                        new Promise((res, rej) => {
                            const id = nextId++;
                            pending.set(id, { res, rej });
                            ws.send(JSON.stringify({ id, ...payload }));
                        }),
                    close: () => ws.close(),
                });
            } else if (msg.type === "result" && pending.has(msg.id)) {
                const { res, rej } = pending.get(msg.id);
                pending.delete(msg.id);
                msg.success ? res(msg.result) : rej(new Error(msg.error?.message ?? msg.error?.code ?? "failed"));
            }
        });
    });
}

async function fetchCardVersion(baseUrl, token, resources) {
    if (!baseUrl || !Array.isArray(resources)) return null;
    // A stale resource (an old manual copy, a removed HACS path) can sit next to the live one.
    for (const resource of resources.filter((r) => /xiaomi-vacuum-map-card/.test(r.url ?? ""))) {
        try {
            const res = await fetch(new URL(resource.url, baseUrl), { headers: token ? { Authorization: `Bearer ${token}` } : {} });
            const version = res.ok ? cardVersionFromBundle(await res.text()) : null;
            if (version) return version;
        } catch {
            // try the next resource
        }
    }
    return null;
}

async function collect() {
    let raw;
    const baseUrl = args.url ?? process.env.HA_URL;
    const token = process.env.HA_TOKEN;
    if (args.raw) {
        raw = JSON.parse(await readFile(args.raw, "utf8"));
    } else {
        if (!baseUrl || !token) fail("set HA_URL and HA_TOKEN, or pass --raw <browser snapshot>.");
        const conn = await connect(baseUrl, token).catch((e) => fail(e.message));
        raw = await collectRaw(conn.call);
        conn.close();
    }
    if (!raw.cards?.length) fail("no custom:xiaomi-vacuum-map-card found in any dashboard.");
    const cardVersion = args["card-version"] ?? raw.card_version ?? (await fetchCardVersion(baseUrl, token, raw.resources));
    const report = buildReport(raw, {
        entity: args.entity,
        card: args.card !== undefined ? Number(args.card) : undefined,
        cardVersion,
        installationType: args["installation-type"],
        agentName: args.agent,
        agentModel: args.model,
        browser: raw.client,
    });
    const json = JSON.stringify(report, null, 2);
    if (args.out) await writeFile(args.out, json + "\n");
    else console.log(json);
    console.error(
        `collected: ${raw.cards.length} card(s), ${Object.keys(report.states).length} entities, ${report.registry.length} registry entries`,
    );
    if (raw.cards.length > 1) console.error("several cards found; pick one with --entity <vacuum entity> or --card <index>");
    const missing = missingFields(report).filter((f) => !f.startsWith("problem.") && f !== "agent.name");
    if (missing.length) console.error(`still missing (fill in by hand): ${missing.join(", ")}`);
}

async function render() {
    const file = positional[0] ?? fail("usage: render <report.json>");
    const report = JSON.parse(await readFile(file, "utf8"));
    const missing = missingFields(report);
    if (missing.length) fail(`fill these fields before filing: ${missing.join(", ")}`);
    process.stdout.write(renderIssueBody(report));
    console.error(`title: ${issueTitle(report)}`);
}

async function check() {
    const file = positional[0] ?? fail("usage: check <issue.md>");
    const result = reviewIssue(await readFile(file, "utf8"));
    console.log(JSON.stringify({ ...result, redactedBody: result.redactedBody ? "(secrets found, would be rewritten)" : null }, null, 2));
    if (!result.complete || result.redactedBody) process.exit(1);
}

const commands = { collect, render, check };
if (!commands[command]) fail("usage: cli.mjs collect|render|check");
await commands[command]();
