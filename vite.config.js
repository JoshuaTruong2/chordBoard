import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { chordImportPlugin } from "./server/importPlugin.js";

export default defineConfig({
  plugins: [react(), chordImportPlugin()],
  server: {
    port: 5173,
  },
});
