import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { ugImportPlugin } from "./server/ugImportPlugin.js";

export default defineConfig({
  plugins: [react(), ugImportPlugin()],
  server: {
    port: 5173,
  },
});
