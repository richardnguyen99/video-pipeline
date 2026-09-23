import { defineConfig } from "vite";
import { devtools } from "@tanstack/devtools-vite";
import path from "node:path";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const backendOrigin = process.env.VITE_BACKEND_ORIGIN ?? "http://localhost:8000";

const config = defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: backendOrigin,
        changeOrigin: true,
      },
    },
  },
  plugins: [devtools(), tailwindcss(), tanstackStart(), viteReact()],
});

export default config;
