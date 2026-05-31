import { resolve } from "node:path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
	plugins: [
		// 빌드 시 dist 폴더 내부에 자동으로 타입 정의(.d.ts)를 생성해주는 플러그인
		dts({
			tsconfigPath: "./tsconfig.json",
		}),
	],
	build: {
		lib: {
			// 라이브러리의 진입점을 지정합니다.
			entry: resolve(__dirname, "src/index.ts"),
			name: "MiniblockCore",
			// ESM(.js)과 CommonJS(.cjs) 포맷으로 각각 출력합니다.
			formats: ["es", "cjs"],
			fileName: (format) => `miniblock-core.${format === "es" ? "js" : "cjs"}`,
		},
		rollupOptions: {
			// 브라우저 기본 API 외에 번들에 포함하지 않고 외부 의존성으로 처리할 대상 정의
			external: [],
		},
	},
});
