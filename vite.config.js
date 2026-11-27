import process from "node:process";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  cacheDir: process.env.BIZBUDDY_VITE_CACHE || "node_modules/.vite",
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    allowedHosts: ["bizbuddy.naijatown.app"],
    fs: {
      deny: [
        "**/.env",
        "**/.env.*",
        "**/*.{crt,pem}",
        "**/.git/**",
        "**/backend/**",
        "**/ops/**",
        "**/*.pdf",
      ],
    },
    proxy: {
      "/api": process.env.BIZBUDDY_API_TARGET || "http://127.0.0.1:8000",
      "/chatbot-widget.js":
        process.env.BIZBUDDY_API_TARGET || "http://127.0.0.1:8000",
    },
  },
});
