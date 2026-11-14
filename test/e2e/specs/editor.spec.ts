import { expect, openDashboard, shot, test, waitForCard } from "./helpers";

/**
 * The real card editor on the real Home Assistant frontend.
 *
 * The Vitest harness can only prove the branch it stubs. This opens the visual editor on a card whose
 * ROOM mode starts with no rooms, types with the keyboard, and asserts the change in Home Assistant's
 * own edit-dialog config - so the test fails if "Generate rooms config" does nothing, or if typing
 * never reaches the config.
 */
test("card editor renders, edits the title and generates rooms", async ({ loggedIn: page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", error => pageErrors.push(error.message));
    await openDashboard(page, "/e2e-editor/editor?edit=1");
    await waitForCard(page);

    await page
        .locator("ha-button")
        .filter({ hasText: /^\s*Edit\s*$/ })
        .last()
        .click();

    const dialog = page.locator("hui-dialog-edit-card").first();
    await dialog.waitFor({ state: "attached", timeout: 60_000 });
    const editor = page.locator("xiaomi-vacuum-map-card-editor").first();
    await editor.waitFor({ state: "attached", timeout: 60_000 });
    await editor.evaluate(async (element: any) => {
        while (!element.shadowRoot?.querySelector(".card-config")) {
            await new Promise(resolve => setTimeout(resolve, 50));
        }
    });

    const dialogConfig = () => dialog.evaluate((element: any) => element._cardConfig as any);
    const roomIds = (config: any): string[] =>
        (config?.map_modes ?? []).flatMap((mode: any) =>
            (mode.predefined_selections ?? []).map((selection: any) => String(selection.id)),
        );

    // The card starts with a ROOM mode that has no rooms, so the button is the only way to fill it.
    expect(roomIds(await dialogConfig())).toEqual([]);

    const fields = await editor.evaluate((element: any) => ({
        inputs: [...element.shadowRoot.querySelectorAll("ha-input")].map((input: Element) => input.getAttribute("label")),
        textfields: [...element.shadowRoot.querySelectorAll("ha-textfield")].map((input: Element) => input.getAttribute("label")),
        buttons: [...element.shadowRoot.querySelectorAll("ha-button")].map((button: Element) => (button.textContent ?? "").trim()),
        switchLabels: [...element.shadowRoot.querySelectorAll("ha-formfield")].map((field: Element) => field.getAttribute("label")),
        fallbackLabels: [...element.shadowRoot.querySelectorAll(".switch-fallback-label")].map((label: Element) => (label.textContent ?? "").trim()),
    }));
    expect(fields.inputs).toContain("Title (optional)");
    expect(fields.textfields).toEqual([]);
    expect(fields.buttons).toContain("Generate rooms config");
    // On this frontend `ha-formfield` no longer exists, so the editor must show its labels itself.
    expect([...fields.switchLabels, ...fields.fallbackLabels].join(" | ")).toMatch(/Map locked/i);
    expect(fields.fallbackLabels.length).toBeGreaterThanOrEqual(3);

    // Real keyboard typing into the field the frontend provides.
    const title = page.locator("xiaomi-vacuum-map-card-editor").locator("ha-input").first();
    await title.click();
    await page.keyboard.type("E2E vacuum");
    await expect.poll(async () => (await dialogConfig())?.title).toBe("E2E vacuum");
    await shot(page, "13-editor-title");

    // Generate rooms config: the only way the ids can appear in the dialog config.
    await editor.evaluate((element: any) => {
        const button = [...element.shadowRoot.querySelectorAll("ha-button")].find((candidate: Element) =>
            (candidate.textContent ?? "").includes("Generate rooms config"),
        ) as HTMLElement;
        button.click();
    });
    await expect.poll(async () => roomIds(await dialogConfig()), { timeout: 30_000 }).toEqual(["0", "1", "2"]);

    // The frozen-config regression from #956 threw from the editor's event handler.
    expect(pageErrors).toEqual([]);
    await shot(page, "14-editor-generated-rooms");
});
