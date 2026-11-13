/*
 * Static server for the Playwright visual harness.
 *
 * Deliberately dependency-free: it serves the built bundle, the visual page and the committed
 * synthetic fixture, and answers the camera proxy path the card builds from the fixture's
 * `entity_picture`. No Home Assistant frontend and no network access are involved.
 *
 * Playwright starts this through `webServer` (see playwright.config.ts); it can also be started by
 * hand with `node test/visual/server.cjs`.
 */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const HOST = "127.0.0.1";
const PORT = Number(process.env.VISUAL_PORT ?? 4173);

const CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".css": "text/css; charset=utf-8",
};

/** URL path prefixes mapped to directories inside the repository. */
const DIRECTORIES = [
    ["/fixtures/", "test/fixtures/"],
    ["/dist/", "dist/"],
    ["/visual/", "test/visual/"],
];

/** `hass.hassUrl(...)` in the harness points the card's camera proxy request at this path. */
const CAMERA_PROXY_PREFIX = "/api/camera_proxy/";

function resolveFile(urlPath) {
    if (urlPath === "/" || urlPath === "/index.html") {
        return path.join(ROOT, "test/visual/index.html");
    }
    if (urlPath === "/harness.js") {
        return path.join(ROOT, "test/visual/harness.js");
    }
    if (urlPath.startsWith(CAMERA_PROXY_PREFIX)) {
        // Any token/version query is irrelevant: every camera proxy request serves the fixture map.
        return path.join(ROOT, "test/fixtures/synthetic/map.png");
    }
    for (const [prefix, directory] of DIRECTORIES) {
        if (!urlPath.startsWith(prefix)) continue;
        const candidate = path.resolve(ROOT, directory, urlPath.slice(prefix.length));
        const base = path.resolve(ROOT, directory);
        // Reject traversal such as /fixtures/../../etc/passwd.
        if (candidate !== base && !candidate.startsWith(base + path.sep)) return undefined;
        return candidate;
    }
    return undefined;
}

function send(response, status, body, type) {
    response.writeHead(status, {
        "Content-Type": type,
        "Content-Length": Buffer.byteLength(body),
        // Screenshots must not depend on a cached response from an earlier run.
        "Cache-Control": "no-store",
    });
    response.end(body);
}

const server = http.createServer((request, response) => {
    const urlPath = decodeURIComponent((request.url ?? "/").split("?")[0]);
    const file = resolveFile(urlPath);
    if (!file) {
        send(response, 404, `Not found: ${urlPath}`, "text/plain; charset=utf-8");
        return;
    }
    fs.readFile(file, (error, data) => {
        if (error) {
            send(response, 404, `Not found: ${urlPath}`, "text/plain; charset=utf-8");
            return;
        }
        send(response, 200, data, CONTENT_TYPES[path.extname(file)] ?? "application/octet-stream");
    });
});

server.listen(PORT, HOST, () => {
    process.stdout.write(`visual harness server listening on http://${HOST}:${PORT}\n`);
});

const shutdown = () => server.close(() => process.exit(0));
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
