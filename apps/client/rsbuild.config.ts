import { defineConfig } from "@rsbuild/core";
import { pluginBabel } from "@rsbuild/plugin-babel";
import { pluginReact } from "@rsbuild/plugin-react";

export default defineConfig({
  html: { template: "./public/index.html" },
  // Fonts as files: the CSP (default-src 'self') blocks data: fonts
  output: { distPath: "./build", dataUriLimit: { font: 0 } },
  performance: { chunkSplit: { strategy: "all-in-one" } },
  plugins: [
    pluginReact({ fastRefresh: true }),
    pluginBabel({
      include: /\.(?:jsx|tsx)$/,
      babelLoaderOptions(opts) {
        opts.plugins?.unshift("babel-plugin-react-compiler");
      },
    }),
  ],
});
