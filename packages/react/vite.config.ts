import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
	plugins: [
		react(),
		dts({
			insertTypesEntry: true,
			tsconfigPath: "./tsconfig.json",
		}),
	],
	build: {
		lib: {
			entry: resolve(__dirname, "src/index.ts"),
			name: "MiniblockReact",
			formats: ["es", "cjs"],
			fileName: (format) => `miniblock-react.${format === "es" ? "js" : "cjs"}`,
		},
		rollupOptions: {
			external: [
				"react",
				"react-dom",
				"react/jsx-runtime",
				"react/jsx-dev-runtime",
				"@miniblock/core",
			],
		},
	},
});
