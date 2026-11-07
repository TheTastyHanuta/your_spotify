import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // src/tools/env.ts exits without these, and any import chain reaching it
    // would fail the test file. Dummy values: tests never contact anything.
    env: {
      CLIENT_ENDPOINT: "http://localhost:3000",
      API_ENDPOINT: "http://localhost:8080",
      SPOTIFY_PUBLIC: "test",
      SPOTIFY_SECRET: "test",
      // Vitest's own "test" is no value env.ts accepts
      NODE_ENV: "development",
      // Tests trigger warnings on purpose (rate limits, for instance)
      LOG_LEVEL: "error",
      // The default, pinned so a value set in the shell changes no test
      SPOTIFY_API_DELAY_MS: "2000",
    },
    // Undo vi.stubGlobal and vi.spyOn before each test, so no test sees
    // another one's stubs
    unstubGlobals: true,
    restoreMocks: true,
    // pnpm coverage: list untested files too, not only those tests import
    coverage: { include: ["src/**/*.ts"] },
  },
});
