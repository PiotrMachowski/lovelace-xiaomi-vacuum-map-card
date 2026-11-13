import { defineConfig } from "vitest/config";

export default defineConfig({
    // The source imports extensionless Lit subpaths (`lit/decorators`). Rollup resolves them, but
    // Vite enforces package "exports", so point the three used subpaths at their real files.
    resolve: {
        alias: [
            { find: /^lit\/decorators$/, replacement: "lit/decorators.js" },
            { find: /^lit\/directive$/, replacement: "lit/directive.js" },
            { find: /^lit\/directives\/if-defined$/, replacement: "lit/directives/if-defined.js" },
        ],
    },
    test: {
        environment: "happy-dom",
        include: ["test/**/*.test.ts"],
        setupFiles: ["test/harness/setup.ts"],
        clearMocks: true,
        restoreMocks: true,
        // A mount helper that never settles is a harness bug, not a slow test. Fail fast and loud.
        testTimeout: 10000,
        hookTimeout: 10000,
        reporters: ["default"],
    },
});
