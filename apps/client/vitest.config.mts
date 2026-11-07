import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Undo vi.stubGlobal and vi.spyOn before each test, so no test sees
    // another one's stubs
    unstubGlobals: true,
    restoreMocks: true,
    // pnpm coverage: list untested files too, not only those tests import
    coverage: { include: ["src/**/*.{ts,tsx}"] },
  },
});
