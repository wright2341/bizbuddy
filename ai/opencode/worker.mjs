// Private stdio bridge. Only text generation is exposed; no agent/tool execution.
import readline from "node:readline";
import path from "node:path";
import { pathToFileURL } from "node:url";
const runtime = process.env.OPENCODE_RUNTIME_DIR;
if (!runtime) throw new Error("OpenCode runtime is not installed");
const { OpenCode } = await import(
  pathToFileURL(path.join(runtime, "node_modules/@opencode/sdk/dist/index.js"))
    .href
);
const modelID = process.env.OPENCODE_MODEL || "deepseek-v4.1-flash-free";
// These documented free models have zero-retention policies. Never choose a paid model.
if (!["deepseek-v4.1-flash-free", "hy4-flash-free"].includes(modelID))
  throw new Error("Unsupported free model");
const host = await OpenCode.create({
  log: { level: "error", emit: () => {} },
  database: { path: ":memory:" },
  config: {
    directory: path.join(process.cwd(), "config"),
    project: false,
    claude: false,
    content: JSON.stringify({
      permissions: { "*": "deny" },
      plugins: [],
      mcp: {},
    }),
  },
  instructions: { claude: false },
  fs: { filewatcher: false, fff: false },
});
// Initializes location plugins without prompting an agent or making a model request.
await host.agent.list({ location: { directory: process.cwd() } });
let selected;
// Provider plugins activate asynchronously after location initialization.
for (let attempt = 0; attempt < 20; attempt++) {
  const models = await host.model.list({
    location: { directory: process.cwd() },
  });
  selected = models.data.find(
    (m) => m.providerID === "opencode" && m.id === modelID,
  );
  if (selected) break;
  await new Promise((resolve) => setTimeout(resolve, 150));
}

if (
  !selected ||
  !selected.cost.length ||
  selected.cost.some(
    (c) =>
      c.input !== 0 ||
      c.output !== 0 ||
      (c.cache?.read || 0) !== 0 ||
      (c.cache?.write || 0) !== 0,
  )
) {
  await host.close();
  throw new Error("Requested model is unavailable or no longer free");
}
const input = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});
try {
  for await (const line of input) {
    let session;
    try {
      const request = JSON.parse(line);
      if (typeof request.prompt !== "string" || request.prompt.length > 65000)
        throw new Error("Invalid prompt");
      session = await host.sessions.create({
        location: { directory: process.cwd() },
      });
      await host.sessions.switchModel({
        sessionID: session.id,
        model: { providerID: "opencode", id: modelID },
      });
      const result = await host.sessions.generate(
        { sessionID: session.id, prompt: request.prompt },
        { signal: AbortSignal.timeout(18000) },
      );
      if (result.cost !== 0) throw new Error("Unexpected model cost");
      process.stdout.write(
        JSON.stringify({ ok: true, text: result.text }) + "\n",
      );
    } catch (error) {
      const reason = /free usage|rate.limit|quota|subscribe|429/i.test(
        String(error.message),
      )
        ? "limited"
        : /abort|timeout/i.test(String(error.message))
          ? "timeout"
          : "unavailable";
      // Do not log provider error bodies, prompts or customer data.
      process.stdout.write(JSON.stringify({ ok: false, reason }) + "\n");
    } finally {
      if (session)
        await host.sessions.remove({ sessionID: session.id }).catch(() => {});
    }
  }
} finally {
  await host.close();
}
