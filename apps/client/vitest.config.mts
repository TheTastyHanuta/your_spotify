import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Undo vi.stubGlobal and vi.spyOn before each test, so no test sees
    // another one's stubs
    unstubGlobals: true,
    restoreMocks: true,
    // CSS reads as empty in tests; index.css is kept so a test can check
    // the chart colours against it
    css: { include: [/index\.css/] },
    // pnpm coverage: list untested files too, not only those tests import
    coverage: { include: ["src/**/*.{ts,tsx}"] },
  },
});
