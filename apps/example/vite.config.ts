import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const appDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({ plugins: [react()], resolve: { alias: { "@basketikun/infinite-canvas": resolve(appDir, "../../packages/core/src/index.ts") } } });
