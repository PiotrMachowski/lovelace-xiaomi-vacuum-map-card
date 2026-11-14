import { expect, openDashboard, shot, test, waitForCard } from "./helpers";

/**
 * The real card editor on the real Home Assistant frontend.
 *
 * The Vitest harness can only prove the branch it stubs; this opens the visual editor in edit mode,
 * checks which text-field element the frontend actually provides, edits the title and runs
 * "Generate rooms config" against the fixture camera's room metadata.
 */
test("card editor renders, edits the title and generates rooms", async ({ loggedIn: page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", error => pageErrors.push(error.message));
    await openDashboard(page, "/e2e-map/map?edit=1");
    await waitForCard(page);

    await page
        .locator("ha-button")
        .filter({ hasText: /^\s*Edit\s*$/ })
        .last()
        .click();

    const editor = page.locator("xiaomi-vacuum-map-card-editor").first();
    await editor.waitFor({ state: "attached", timeout: 60_000 });
    await editor.evaluate(async (element: any) => {
        while (!element.shadowRoot?.querySelector(".card-config")) {
            await new Promise(resolve => setTimeout(resolve, 50));
        }
    });

    const fields = await editor.evaluate((element: any) => ({
        inputs: [...element.shadowRoot.querySelectorAll("ha-input")].map((input: Element) => input.getAttribute("label")),
        textfields: [...element.shadowRoot.querySelectorAll("ha-textfield")].map((input: Element) => input.getAttribute("label")),
        buttons: [...element.shadowRoot.querySelectorAll("ha-button")].map((button: Element) => (button.textContent ?? "").trim()),
    }));

    // On this Home Assistant version the frontend provides `ha-input`, so the editor must use it and
    // not fall back to the removed `ha-textfield`.
    expect(fields.inputs).toContain("Title (optional)");
    expect(fields.textfields).toEqual([]);
    expect(fields.buttons).toContain("Generate rooms config");

    // Typing the title goes through the real input event and must reach the config.
    await editor.evaluate((element: any) => {
        const input = element.shadowRoot.querySelector("ha-input[label='Title (optional)']") as HTMLElement & {
            value?: string;
            configValue?: string;
        };
        input.value = "E2E vacuum";
        input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    });
    await expect.poll(async () => editor.evaluate((element: any) => element._config?.title)).toBe("E2E vacuum");
    await shot(page, "13-editor-title");

    // Generating rooms asks the preview card for its rooms over the event path scoped in B2.
    await editor.evaluate((element: any) => {
        const button = [...element.shadowRoot.querySelectorAll("ha-button")].find((candidate: Element) =>
            (candidate.textContent ?? "").includes("Generate rooms config"),
        ) as HTMLElement;
        button.click();
    });

    await expect
        .poll(
            async () =>
                editor.evaluate((element: any) =>
                    (element._config?.map_modes ?? [])
                        .flatMap((mode: any) => mode.predefined_selections ?? [])
                        .map((selection: any) => String(selection.id)),
                ),
            { timeout: 30_000 },
        )
        .toEqual(["0", "1", "2"]);

    // The frozen-config regression from #956 threw from the editor's event handler. Generating
    // through the real frontend must not raise a page error.
    expect(pageErrors).toEqual([]);
    await shot(page, "14-editor-generated-rooms");
});
