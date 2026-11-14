import { expect, test as base, type Page } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Shared login and card helpers for the real-instance suite.
 *
 * The instance is onboarded by `setup.cjs`; this logs in through the UI exactly as a user would, so
 * the session, the auth store and the frontend bootstrap are the real ones.
 */
export const USERNAME = process.env.E2E_HA_USER || "e2e";
export const PASSWORD = process.env.E2E_HA_PASSWORD || "e2e-password";
const ARTIFACTS = path.join(__dirname, "..", "artifacts");
const AUTH_DIR = path.join(__dirname, "..", ".auth");

/** Home Assistant's card element inside the ha-card shadow root. */
export const CARD_SELECTOR = "xiaomi-vacuum-map-card";

/** The refresh token the setup script obtained, shaped the way the frontend stores it. */
function hassTokens(): Record<string, unknown> {
    const raw = JSON.parse(fs.readFileSync(path.join(AUTH_DIR, "token.json"), "utf8")) as {
        access_token: string;
        refresh_token: string;
    };
    const hassUrl = process.env.E2E_HA_URL || "http://localhost:8123";
    return {
        access_token: raw.access_token,
        refresh_token: raw.refresh_token,
        expires_in: 1800,
        hassUrl,
        clientId: `${hassUrl}/`,
        expires: Date.now() + 1_500_000,
    };
}

/**
 * Restores the session the setup script created by seeding the frontend's own token store, then
 * waits for the real frontend to boot. This keeps the login out of the timing-sensitive auth form
 * while still exercising the real session, router and component bootstrap.
 */
export async function login(page: Page): Promise<void> {
    const tokens = hassTokens();
    await page.addInitScript(value => {
        window.localStorage.setItem("hassTokens", JSON.stringify(value));
    }, tokens);
    await page.goto("/");
    await page.waitForSelector("home-assistant", { timeout: 120_000 });
    await page.waitForFunction(() => !!document.querySelector("home-assistant")?.shadowRoot, null, {
        timeout: 120_000,
    });
    // Wait until the frontend has a connection, otherwise dashboard navigation races the bootstrap.
    await page.waitForFunction(
        () => {
            const app = document.querySelector("home-assistant") as any;
            return !!app?.hass;
        },
        null,
        { timeout: 120_000 },
    );
}

export async function openDashboard(page: Page, pathname: string): Promise<void> {
    await page.goto(pathname);
    await page.waitForSelector("home-assistant-main", { timeout: 120_000 });
}

/** Waits for the card element to be defined and rendered inside the dashboard view. */
export async function waitForCard(page: Page, selector = CARD_SELECTOR): Promise<void> {
    // Playwright's locators pierce shadow roots, `document.querySelector` does not: dashboard cards
    // live inside `hui-card`'s shadow tree.
    const locator = page.locator(selector).first();
    await locator.waitFor({ state: "attached", timeout: 120_000 });
    await locator.evaluate(async (element: any) => {
        if (!element.shadowRoot) {
            await customElements.whenDefined(element.localName);
        }
    });
    await locator.evaluate(async (element: any) => {
        while (!element.shadowRoot) await new Promise(resolve => setTimeout(resolve, 50));
    });
}

export interface CardHandle {
    locator: ReturnType<Page["locator"]>;
    /** Runs a function against the card element itself (in the page), so its shadow root is reachable. */
    evaluate: <T, A>(fn: (element: any, arg: A) => T, arg?: A) => Promise<T>;
}

export async function card(page: Page, selector = CARD_SELECTOR): Promise<CardHandle> {
    const locator = page.locator(selector).first();
    await locator.waitFor({ state: "attached", timeout: 120_000 });
    return {
        locator,
        evaluate: <T, A>(fn: (element: any, arg: A) => T, arg?: A) =>
            (locator.evaluate as any)(fn, arg) as Promise<T>,
    };
}

/** The map view state the card applies, as the visual harness reads it. */
export interface ViewState {
    scale: number;
    x: number;
    y: number;
    rotation: number;
}

export async function viewState(target: CardHandle): Promise<ViewState> {
    return target.evaluate(element => ({
        scale: element.mapScale,
        x: element.mapX,
        y: element.mapY,
        rotation: element.mapRotation,
    }));
}

/** Counts camera image requests recorded by the fixture camera's HTTP view. */
export async function cameraRequests(page: Page): Promise<Record<string, number>> {
    const response = await page.request.get("/api/map_fixture/stats");
    return (await response.json()) as Record<string, number>;
}

export async function resetCameraRequests(page: Page): Promise<void> {
    await page.request.post("/api/map_fixture/stats");
}

/** Asks the fixture camera to push a new map image, like an integration would. */
export async function bumpCamera(page: Page): Promise<void> {
    const token = JSON.parse(fs.readFileSync(path.join(AUTH_DIR, "token.json"), "utf8")).access_token as string;
    const response = await page.request.post("/api/services/map_fixture/bump", {
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        data: {},
    });
    if (!response.ok()) throw new Error(`bump failed: ${response.status()}`);
}

export async function resetCamera(page: Page): Promise<void> {
    const token = JSON.parse(fs.readFileSync(path.join(AUTH_DIR, "token.json"), "utf8")).access_token as string;
    await page.request.post("/api/services/map_fixture/set_image", {
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        data: { path: "/config/map_fixture.png" },
    });
}

/** Saves a screenshot into the committed-or-linked artifacts directory. */
export async function shot(page: Page, name: string): Promise<string> {
    const file = path.join(ARTIFACTS, `${name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    return file;
}


/** Sends one Home Assistant websocket command with the setup token. */
export async function wsSend<T = unknown>(type: string, payload: Record<string, unknown> = {}): Promise<T> {
    const token = JSON.parse(fs.readFileSync(path.join(AUTH_DIR, "token.json"), "utf8")).access_token as string;
    const base = process.env.E2E_HA_URL || "http://localhost:8123";
    return new Promise<T>((resolve, reject) => {
        const socket = new WebSocket(`${base.replace("http", "ws")}/api/websocket`);
        let id = 0;
        socket.onmessage = event => {
            const message = JSON.parse(event.data as string);
            if (message.type === "auth_required") {
                socket.send(JSON.stringify({ type: "auth", access_token: token }));
            } else if (message.type === "auth_ok") {
                socket.send(JSON.stringify({ id: ++id, type, ...payload }));
            } else if (message.type === "result") {
                socket.close();
                if (message.success) resolve(message.result as T);
                else reject(new Error(`${type}: ${JSON.stringify(message.error)}`));
            }
        };
        socket.onerror = () => reject(new Error("websocket error"));
    });
}

/** Reads a storage dashboard's config. */
export function getDashboardConfig(urlPath: string): Promise<any> {
    return wsSend("lovelace/config", { url_path: urlPath });
}

/** Writes a storage dashboard's config (the same call the sections resize handle causes). */
export async function saveDashboardConfig(urlPath: string, config: unknown): Promise<void> {
    await wsSend("lovelace/config/save", { url_path: urlPath, config });
}


/** Calls a Home Assistant service through the real websocket API. */
export async function serviceCall(domain: string, service: string, serviceData: Record<string, unknown> = {}): Promise<void> {
    await wsSend("call_service", { domain, service, service_data: serviceData });
}

export const test = base.extend<{ loggedIn: Page }>({
    loggedIn: async ({ page }, use) => {
        await login(page);
        await use(page);
    },
});

export { expect };
