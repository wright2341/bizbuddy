import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
import process from "node:process";
const baseURL = process.env.BIZBUDDY_E2E_BASE_URL || "http://127.0.0.1:5176";
if (!["127.0.0.1", "localhost"].includes(new URL(baseURL).hostname))
  throw new Error(
    "Workspace tests require a local preview so presentation fixtures cannot reach production.",
  );
const python = existsSync("backend/.venv/bin/python")
  ? "backend/.venv/bin/python"
  : ".venv/bin/python";
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180000,
  expect: { timeout: 10000 },
  reporter: "list",
  outputDir: "/tmp/bizbuddy-playwright-results",
  use: {
    actionTimeout: 15000,
    navigationTimeout: 30000,
    baseURL,
    viewport: { width: 1440, height: 1000 },
    headless: true,
    reducedMotion: "reduce",
    trace: "retain-on-failure",
  },
  webServer: process.env.BIZBUDDY_E2E_BASE_URL
    ? undefined
    : [
        {
          command: `${python} -m uvicorn main:app --app-dir backend --host 127.0.0.1 --port 8012`,
          url: "http://127.0.0.1:8012/api/health",
          reuseExistingServer: false,
          env: {
            DATABASE_URL: `sqlite:////tmp/bizbuddy-e2e-${process.pid}.db`,
            PUBLIC_API_URL: baseURL,
            OPENAI_API_KEY: "",
            BIZBUDDY_AI_PROVIDER: "grounded",
          },
        },
        {
          command: "npm run dev -- --host 127.0.0.1 --port 5176 --strictPort",
          url: baseURL,
          reuseExistingServer: false,
          env: {
            BIZBUDDY_API_TARGET: "http://127.0.0.1:8012",
            BIZBUDDY_VITE_CACHE: "/tmp/bizbuddy-e2e-vite",
          },
        },
      ],
});
