// Agent problem reports: collection, redaction, rendering and validation.
//
// Pure functions only. The CLI (cli.mjs) and the issue workflow (ci-issue.mjs) do the I/O, so the
// redaction rules that make an unattended report safe to publish are tested in one place
// (test/agent-report.test.ts).

export const CARD_TYPE = "custom:xiaomi-vacuum-map-card";
export const SCHEMA_VERSION = 1;
export const REPO = "Igloczek/lovelace-better-xiaomi-vacuum-map-card";
export const MARKER = "<!-- agent-report:v1 -->";
export const DATA_START = "<!-- agent-report-data:start -->";
export const DATA_END = "<!-- agent-report-data:end -->";
export const AGENT_LABEL = "agent-report";
export const INCOMPLETE_LABEL = "agent-report-incomplete";
export const REDACTED_LABEL = "auto-redacted";

const ENTITY_ID = /\b([a-z_]+)\.([a-z0-9_]+)\b/g;
const LOG_LIMIT = 20;

// ---------------------------------------------------------------------------------------------
// Collection (transport-agnostic: `call` sends one Home Assistant WebSocket command)
// ---------------------------------------------------------------------------------------------

export function findCards(node, path = [], out = []) {
    if (Array.isArray(node)) {
        node.forEach((child, i) => findCards(child, [...path, i], out));
    } else if (node && typeof node === "object") {
        if (node.type === CARD_TYPE) out.push({ path: path.join("."), config: node });
        for (const [key, value] of Object.entries(node)) {
            if (value && typeof value === "object" && node.type !== CARD_TYPE) findCards(value, [...path, key], out);
        }
    }
    return out;
}

export async function collectRaw(call) {
    const attempt = async (msg) => {
        try {
            return await call(msg);
        } catch (e) {
            return { __error: String(e?.message ?? e?.code ?? e) };
        }
    };
    const ok = (v) => v && !v.__error;

    const dashboards = await attempt({ type: "lovelace/dashboards/list" });
    const urlPaths = [null, ...(Array.isArray(dashboards) ? dashboards.map((d) => d.url_path) : [])];
    const cards = [];
    for (const url_path of urlPaths) {
        const config = await attempt({ type: "lovelace/config", url_path, force: false });
        if (ok(config)) {
            for (const card of findCards(config)) cards.push({ dashboard: url_path ?? "default", ...card });
        }
    }

    const entityRegistry = await attempt({ type: "config/entity_registry/list" });
    const platforms = new Set();
    if (Array.isArray(entityRegistry)) {
        const referenced = new Set(cards.flatMap((c) => referencedEntityIds(c.config)));
        for (const e of entityRegistry) if (referenced.has(e.entity_id)) platforms.add(e.platform);
    }
    const manifests = {};
    for (const domain of platforms) {
        const manifest = await attempt({ type: "manifest/get", integration: domain });
        if (ok(manifest)) manifests[domain] = { version: manifest.version ?? null, is_built_in: manifest.is_built_in ?? null };
    }

    return {
        raw_schema: 1,
        collected_at: new Date().toISOString(),
        ha_config: await attempt({ type: "get_config" }),
        cards,
        resources: await attempt({ type: "lovelace/resources" }),
        states: await attempt({ type: "get_states" }),
        entity_registry: entityRegistry,
        device_registry: await attempt({ type: "config/device_registry/list" }),
        system_log: await attempt({ type: "system_log/list" }),
        manifests,
    };
}

export function referencedEntityIds(value, out = new Set()) {
    if (typeof value === "string") {
        for (const m of value.matchAll(ENTITY_ID)) out.add(m[0]);
    } else if (Array.isArray(value)) {
        value.forEach((v) => referencedEntityIds(v, out));
    } else if (value && typeof value === "object") {
        Object.values(value).forEach((v) => referencedEntityIds(v, out));
    }
    return out;
}

export function cardVersionFromBundle(js) {
    const m = /"v(\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?)"/.exec(js ?? "");
    return m ? `v${m[1]}` : null;
}

// ---------------------------------------------------------------------------------------------
// Report building: select only what the card reads, then redact
// ---------------------------------------------------------------------------------------------

const asArray = (v) => (Array.isArray(v) ? v : []);

export function buildReport(raw, opts = {}) {
    const cards = asArray(raw.cards);
    const card =
        (opts.entity && cards.find((c) => c.config?.entity === opts.entity)) ||
        (Number.isInteger(opts.card) ? cards[opts.card] : undefined) ||
        cards[0];
    const states = asArray(raw.states);
    const registry = asArray(raw.entity_registry);
    const devices = asArray(raw.device_registry);
    const stateIds = new Set(states.map((s) => s.entity_id));

    const config = card?.config ?? {};
    const vacuumId = config.entity ?? null;
    const cameraId = config.map_source?.camera ?? null;
    const regById = new Map(registry.map((e) => [e.entity_id, e]));
    const deviceIds = new Set([vacuumId, cameraId].map((id) => regById.get(id)?.device_id).filter(Boolean));

    const relevant = new Set([...referencedEntityIds(config)].filter((id) => stateIds.has(id) || regById.has(id)));
    for (const e of registry) if (deviceIds.has(e.device_id)) relevant.add(e.entity_id);

    const camera = states.find((s) => s.entity_id === cameraId);
    const cameraAttrs = camera?.attributes ?? {};
    const resource = asArray(raw.resources).find((r) => /xiaomi-vacuum-map-card/.test(r.url ?? ""));
    const vacuumPlatform = regById.get(vacuumId)?.platform ?? null;
    const cameraPlatform = regById.get(cameraId)?.platform ?? null;
    const manifests = raw.manifests ?? {};
    const vacuumDevice = devices.find((d) => d.id === regById.get(vacuumId)?.device_id);

    const report = {
        schema_version: SCHEMA_VERSION,
        created_at: new Date().toISOString(),
        agent: { name: opts.agentName ?? "", model: opts.agentModel ?? "" },
        card: {
            version: opts.cardVersion ?? null,
            build: resource ? (/better/i.test(resource.url) ? "fork" : "unknown") : "unknown",
            resource_url: resource?.url ?? null,
            install: resource?.url?.startsWith("/hacsfiles/") ? "hacs" : resource ? "manual" : "unknown",
            cards_found: cards.length,
            dashboard: card?.dashboard ?? null,
            path: card?.path ?? null,
        },
        home_assistant: {
            version: raw.ha_config?.version ?? null,
            installation_type: opts.installationType ?? null,
            safe_mode: raw.ha_config?.safe_mode ?? null,
        },
        client: { browser: opts.browser ?? "", os: opts.os ?? "", app: opts.app ?? "" },
        vacuum: {
            entity: vacuumId,
            integration: vacuumPlatform,
            integration_version: manifests[vacuumPlatform]?.version ?? null,
            manufacturer: vacuumDevice?.manufacturer ?? null,
            model: vacuumDevice?.model ?? null,
            model_id: vacuumDevice?.model_id ?? null,
            sw_version: vacuumDevice?.sw_version ?? null,
            platform_template: config.vacuum_platform ?? null,
        },
        map: {
            source_type: cameraId ? "camera" : config.map_source?.image ? "image" : "unknown",
            camera_entity: cameraId,
            camera_integration: cameraPlatform,
            camera_integration_version: manifests[cameraPlatform]?.version ?? null,
            calibration_source: config.calibration_source ?? null,
            calibration_points: asArray(cameraAttrs.calibration_points).length,
            rooms_count: cameraAttrs.rooms ? Object.keys(cameraAttrs.rooms).length : 0,
            has_rooms_metadata: Boolean(cameraAttrs.rooms),
        },
        card_config: config,
        camera_attributes: cameraAttrs,
        states: Object.fromEntries(
            states.filter((s) => relevant.has(s.entity_id)).map((s) => [s.entity_id, { state: s.state, attributes: s.attributes }]),
        ),
        registry: registry.filter((e) => relevant.has(e.entity_id)).map(pickRegistry),
        devices: devices.filter((d) => deviceIds.has(d.id)).map(pickDevice),
        logs: { ha: pickLogs(raw.system_log, [vacuumPlatform, cameraPlatform]), browser_console: opts.browserConsole ?? [] },
        problem: { summary: "", expected: "", actual: "", reproduction: [], diagnosis: "", workaround: "", related: [] },
        testability: "needs-fixture",
        redactions: [],
        collection_errors: Object.entries(raw)
            .filter(([, v]) => v && typeof v === "object" && v.__error)
            .map(([k, v]) => `${k}: ${v.__error}`),
    };
    return redactReport(report);
}

function pickRegistry(e) {
    return {
        entity_id: e.entity_id,
        unique_id: e.unique_id,
        platform: e.platform,
        device_id: e.device_id,
        translation_key: e.translation_key ?? null,
        original_name: e.original_name ?? null,
        has_entity_name: e.has_entity_name ?? null,
        entity_category: e.entity_category ?? null,
        disabled_by: e.disabled_by ?? null,
        hidden_by: e.hidden_by ?? null,
        renamed: Boolean(e.name),
    };
}

function pickDevice(d) {
    return {
        id: d.id,
        manufacturer: d.manufacturer ?? null,
        model: d.model ?? null,
        model_id: d.model_id ?? null,
        sw_version: d.sw_version ?? null,
        hw_version: d.hw_version ?? null,
        renamed: Boolean(d.name_by_user),
    };
}

function pickLogs(log, platforms) {
    const words = ["xiaomi", "vacuum", "map-card", "map_card", "camera", ...platforms.filter(Boolean)];
    const match = (e) => {
        const text = [e.name, e.source, ...(Array.isArray(e.message) ? e.message : [e.message])].join(" ").toLowerCase();
        return words.some((w) => text.includes(String(w).toLowerCase()));
    };
    return asArray(log)
        .filter(match)
        .slice(0, LOG_LIMIT)
        .map((e) => ({ level: e.level, name: e.name, message: e.message, source: e.source, count: e.count, first_occurred: e.first_occurred }));
}

// ---------------------------------------------------------------------------------------------
// Redaction
// ---------------------------------------------------------------------------------------------

const DROP_KEYS = /^(access_token|token|refresh_token|password|passwd|secret|api_key|apikey|auth|authorization|cookie|serial|serial_number|sn|mac|mac_address|bssid|ssid|wifi_ssid|ip|ip_address|local_ip|host|email|latitude|longitude|location|address|identifiers|connections|external_url|internal_url|webhook_id|cloudhook_url)$/i;

// High-confidence secret patterns. These run on everything, including issue bodies in CI.
const SECRET_PATTERNS = [
    ["jwt", /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, "<redacted-token>"],
    ["bearer", /\b(Bearer\s+)[A-Za-z0-9._~+/=-]{16,}/g, "$1<redacted-token>"],
    ["url-token", /([?&](?:token|access_token|auth|api_key|apikey|key|authSig)=)[^&\s"'<>)]+/gi, "$1<redacted>"],
    ["url-credentials", /(\b[a-z][a-z0-9+.-]*:\/\/)[^\s/:@"']+:[^\s/@"']+@/gi, "$1<redacted>@"],
];

// Personal-data patterns. These run on collected data, where false positives cost nothing.
const PERSONAL_PATTERNS = [
    ["email", /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "<email>"],
    ["mac", /\b[0-9A-Fa-f]{2}(?:[:-][0-9A-Fa-f]{2}){5}\b/g, "<mac>"],
    ["ipv4", /\b(?!127\.0\.0\.1\b)(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}\b/g, "<ip>"],
    ["home-path", /(\/(?:Users|home)\/)[^/\s"']+/g, "$1<user>"],
];

export function scrubSecrets(text) {
    const hits = {};
    let out = String(text ?? "");
    for (const [name, re, repl] of SECRET_PATTERNS) {
        out = out.replace(re, (...args) => {
            hits[name] = (hits[name] ?? 0) + 1;
            return repl.replace("$1", args[1] ?? "");
        });
    }
    return { text: out, hits };
}

function scrubString(s, tally) {
    const secret = scrubSecrets(s);
    let out = secret.text;
    for (const [k, n] of Object.entries(secret.hits)) tally[k] = (tally[k] ?? 0) + n;
    for (const [name, re, repl] of PERSONAL_PATTERNS) {
        out = out.replace(re, (...args) => {
            tally[name] = (tally[name] ?? 0) + 1;
            return repl.replace("$1", args[1] ?? "");
        });
    }
    return out;
}

// Device-specific chunks inside unique_id values (serials, DUIDs, MAC-derived hex). The word
// fragments platform templates match (`_battery_level`, `clean_mode_`) survive.
function scrubUniqueId(id, aliases) {
    return String(id ?? "").replace(/[0-9A-Fa-f]{2}(?:[:-]?[0-9A-Fa-f]{2}){5,}|[0-9A-Za-z]{12,}|\d{6,}/g, (chunk) => {
        if (!/\d/.test(chunk)) return chunk;
        if (!aliases.has(chunk)) aliases.set(chunk, `ID${aliases.size + 1}`);
        return aliases.get(chunk);
    });
}

export function redactReport(report) {
    const tally = {};
    const entityAliases = new Map();
    const deviceAliases = new Map();
    const idAliases = new Map();

    // Stable, readable entity aliases: the vacuum and camera keep obvious names, the rest use the
    // integration's translation key, which is what templates and maintainers care about.
    const used = new Set();
    const aliasFor = (id, hint) => {
        if (!id || entityAliases.has(id)) return;
        const domain = id.split(".")[0];
        const base = `${domain}.${(hint || "entity").replace(/[^a-z0-9_]/gi, "_").toLowerCase()}`;
        let alias = base;
        for (let n = 2; used.has(alias); n++) alias = `${base}_${n}`;
        used.add(alias);
        entityAliases.set(id, alias);
    };
    aliasFor(report.vacuum.entity, "vacuum");
    aliasFor(report.map.camera_entity, "map");
    for (const e of report.registry) aliasFor(e.entity_id, e.translation_key);
    for (const id of Object.keys(report.states)) aliasFor(id, null);
    for (const id of referencedEntityIds(report.card_config)) aliasFor(id, null);

    for (const d of report.devices) deviceAliases.set(d.id, `device_${deviceAliases.size + 1}`);

    const ids = [...entityAliases.keys()].sort((a, b) => b.length - a.length);
    const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const entityRe = ids.length ? new RegExp(`(?<![a-z0-9_.])(${ids.map(escape).join("|")})(?![a-z0-9_])`, "g") : null;

    const walk = (value, key) => {
        if (key && DROP_KEYS.test(key) && value !== null && value !== undefined && value !== "") {
            tally[`field:${key}`] = (tally[`field:${key}`] ?? 0) + 1;
            return "<redacted>";
        }
        if (key === "entity_picture" && typeof value === "string") {
            tally["entity_picture"] = (tally["entity_picture"] ?? 0) + 1;
            return value.split("?")[0].replace(entityRe ?? /$^/, (m) => entityAliases.get(m)) + "?<redacted>";
        }
        if (key === "friendly_name" && typeof value === "string") {
            tally["friendly_name"] = (tally["friendly_name"] ?? 0) + 1;
            return "<friendly name>";
        }
        if (key === "unique_id" && typeof value === "string") return scrubUniqueId(value, idAliases);
        if ((key === "device_id" || key === "id") && deviceAliases.has(value)) return deviceAliases.get(value);
        if (typeof value === "string") {
            const aliased = entityRe ? value.replace(entityRe, (m) => entityAliases.get(m)) : value;
            return scrubString(aliased, tally);
        }
        if (Array.isArray(value)) return value.map((v) => walk(v));
        if (value && typeof value === "object") {
            return Object.fromEntries(
                Object.entries(value).map(([k, v]) => {
                    const newKey = entityRe && /\./.test(k) ? k.replace(entityRe, (m) => entityAliases.get(m)) : k;
                    return [newKey, walk(v, k)];
                }),
            );
        }
        return value;
    };

    const out = walk(report);
    out.redactions = [
        ...Object.entries(tally).map(([what, count]) => `${what} ×${count}`),
        `entity ids aliased ×${entityAliases.size}`,
        ...(idAliases.size ? [`device-specific unique_id chunks aliased ×${idAliases.size}`] : []),
        ...(deviceAliases.size ? [`device ids aliased ×${deviceAliases.size}`] : []),
        "map image not collected",
    ];
    return out;
}

// ---------------------------------------------------------------------------------------------
// Rendering and validation of the issue body
// ---------------------------------------------------------------------------------------------

export const REQUIRED_FIELDS = [
    "schema_version",
    "agent.name",
    "card.version",
    "home_assistant.version",
    "vacuum.integration",
    "map.source_type",
    "card_config",
    "problem.summary",
    "problem.expected",
    "problem.actual",
    "problem.reproduction",
];

const get = (obj, path) => path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
const isBlank = (v) =>
    v === undefined || v === null || v === "" || v === "unknown" ||
    (Array.isArray(v) && v.length === 0) ||
    (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0);

export function missingFields(report) {
    return REQUIRED_FIELDS.filter((path) => isBlank(get(report, path)));
}

export function issueTitle(report) {
    const summary = String(report.problem?.summary ?? "").split(/[.\n]/)[0].trim();
    const where = [report.vacuum?.integration, report.card?.version].filter(Boolean).join(", ");
    return `${summary || "Card problem"}${where ? ` (${where})` : ""}`.slice(0, 120);
}

// GitHub rejects issue bodies over 65,536 characters. Trim long arrays (paths, obstacle lists)
// first, then whole attribute blocks, and say what was trimmed.
export const BODY_LIMIT = 60000;

function trimArrays(value, max) {
    if (Array.isArray(value)) {
        const items = value.slice(0, max).map((v) => trimArrays(v, max));
        return value.length > max ? [...items, `… ${value.length - max} more trimmed`] : items;
    }
    if (value && typeof value === "object") {
        return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, trimArrays(v, max)]));
    }
    return value;
}

export function fitReport(report, limit = BODY_LIMIT) {
    const size = (r) => renderIssueBodyUnfitted(r).length;
    if (size(report) <= limit) return report;
    let r = { ...report, redactions: [...(report.redactions ?? [])] };
    for (const max of [50, 10, 3]) {
        r = { ...r, camera_attributes: trimArrays(report.camera_attributes, max), states: trimArrays(report.states, max) };
        if (size(r) <= limit) return { ...r, redactions: [...r.redactions, `long arrays trimmed to ${max} items`] };
    }
    r = {
        ...r,
        states: Object.fromEntries(Object.entries(r.states ?? {}).map(([id, s]) => [id, { state: s.state }])),
        redactions: [...r.redactions, "state attributes dropped for size"],
    };
    if (size(r) <= limit) return r;
    return { ...r, camera_attributes: { __trimmed: "too large for an issue body" }, redactions: [...r.redactions, "camera attributes dropped for size"] };
}

export function renderIssueBody(report) {
    return renderIssueBodyUnfitted(fitReport(report));
}

function renderIssueBodyUnfitted(report) {
    const p = report.problem ?? {};
    const lines = [
        MARKER,
        `> [!NOTE]`,
        `> 🤖 **Agent report.** Collected and filed by ${report.agent?.name || "an agent"}${report.agent?.model ? ` (${report.agent.model})` : ""} with the [report-problem skill](https://github.com/${REPO}/blob/master/.agents/skills/report-problem/SKILL.md). Data was redacted automatically; the map image was not collected.`,
        "",
        "## Summary",
        p.summary || "_missing_",
        "",
        "## Expected",
        p.expected || "_missing_",
        "",
        "## Actual",
        p.actual || "_missing_",
        "",
        "## Reproduction",
        ...(Array.isArray(p.reproduction) && p.reproduction.length ? p.reproduction.map((s, i) => `${i + 1}. ${s}`) : ["_missing_"]),
        "",
        "## Environment",
        "| | |",
        "|---|---|",
        `| Card | ${report.card?.version ?? "?"} (${report.card?.build ?? "?"}, ${report.card?.install ?? "?"}) |`,
        `| Home Assistant | ${report.home_assistant?.version ?? "?"}${report.home_assistant?.installation_type ? `, ${report.home_assistant.installation_type}` : ""} |`,
        `| Vacuum | ${[report.vacuum?.manufacturer, report.vacuum?.model].filter(Boolean).join(" ") || "?"} via \`${report.vacuum?.integration ?? "?"}\`${report.vacuum?.integration_version ? ` ${report.vacuum.integration_version}` : ""} |`,
        `| Map | ${report.map?.source_type ?? "?"}${report.map?.camera_integration ? ` via \`${report.map.camera_integration}\`` : ""}; ${report.map?.rooms_count ?? 0} rooms, ${report.map?.calibration_points ?? 0} calibration points |`,
        `| Client | ${[report.client?.browser, report.client?.os, report.client?.app].filter(Boolean).join(", ") || "not reported"} |`,
        `| Testability | \`${report.testability ?? "needs-fixture"}\` |`,
        "",
    ];
    if (p.diagnosis) lines.push("## Diagnosis", p.diagnosis, "");
    if (p.workaround) lines.push("## Workaround", p.workaround, "");
    if (Array.isArray(p.related) && p.related.length) lines.push("## Related", ...p.related.map((r) => `- ${r}`), "");
    lines.push(
        "## Redactions",
        (report.redactions ?? []).join(" · ") || "none",
        "",
        DATA_START,
        "<details><summary>Report data (JSON, regression-fixture ready)</summary>",
        "",
        "```json",
        JSON.stringify(report, null, 2),
        "```",
        "",
        "</details>",
        DATA_END,
        "",
    );
    return lines.join("\n");
}

export function parseIssueBody(body) {
    const text = String(body ?? "");
    const isAgent = text.includes(MARKER);
    const start = text.indexOf(DATA_START);
    const end = text.indexOf(DATA_END);
    if (!isAgent) return { isAgent, report: null, error: null };
    if (start < 0 || end < start) return { isAgent, report: null, error: "report data block not found" };
    const block = /```json\s*([\s\S]*?)```/.exec(text.slice(start, end));
    if (!block) return { isAgent, report: null, error: "report data JSON not found" };
    try {
        return { isAgent, report: JSON.parse(block[1]), error: null };
    } catch (e) {
        return { isAgent, report: null, error: `report data JSON does not parse: ${e.message}` };
    }
}

// Decision for the issue workflow: which labels to add/remove, whether to rewrite the body.
export function reviewIssue(body) {
    const scrub = scrubSecrets(body);
    const parsed = parseIssueBody(scrub.text);
    const missing = parsed.report ? missingFields(parsed.report) : [];
    const complete = parsed.isAgent && !parsed.error && missing.length === 0;
    return {
        isAgent: parsed.isAgent,
        complete,
        error: parsed.error,
        missing,
        redactedBody: Object.keys(scrub.hits).length ? scrub.text : null,
        secretHits: scrub.hits,
    };
}
