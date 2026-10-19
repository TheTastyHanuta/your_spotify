import { defineConfig } from "@rsbuild/core";

export default defineConfig({
  output: {
    distPath: "./build",
    target: "node",
    // Served on /static, express looks for it next to the bundle
    copy: [{ from: "./src/public", to: "public" }],
  },
});
