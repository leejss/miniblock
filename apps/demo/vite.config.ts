import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: {
			"@miniblock/core": resolve(__dirname, "../../packages/core/src/index.ts"),
			"@miniblock/react": resolve(__dirname, "../../packages/react/src/index.ts"),
		},
	},
	server: {
		fs: {
			allow: [resolve(__dirname, "../..")],
		},
	},
});
