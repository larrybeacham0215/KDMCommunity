import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Member portal is served from KDMCommunity.com/app
// Source: app-src/index.html + src/*  →  build output: /app
export default defineConfig({
  plugins: [react()],
  root: "app-src",
  base: "/app/",
  build: {
    outDir: "../app",
    emptyOutDir: true,
  },
});
