import { resolve } from "node:path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
	plugins: [
		dts({
			insertTypesEntry: true,
			tsconfigPath: "./tsconfig.json",
		}),
	],
	build: {
		lib: {
			entry: resolve(__dirname, "src/index.ts"),
			name: "MiniblockDom",
			formats: ["es", "cjs"],
			fileName: (format) => `miniblock-dom.${format === "es" ? "js" : "cjs"}`,
		},
		rollupOptions: {
			external: ["@miniblock/core"],
		},
	},
});
