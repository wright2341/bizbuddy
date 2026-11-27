import { useEffect, useState } from "react";
import { request } from "../operationsApi";
import { Button, Icon, InlineError, Status } from "./ui";

const names = {
  chatgpt: "ChatGPT",
  openai: "OpenAI",
  groq: "Groq",
  gemini: "Google Gemini",
  opencode: "OpenCode",
  grounded: "Saved business facts",
};
const recovery = {
  key_rejected: "Your provider rejected this key. Reconnect it below.",
  limited:
    "Your provider’s usage limit was reached. Check its quota or billing.",
  limit_reached:
    "Your monthly request cap was reached. Saved facts keep replies available.",
  sign_in_required:
    "The site administrator needs to reconnect the managed model.",
  unavailable:
    "The model is temporarily unavailable. Saved facts keep replies available.",
  model_unavailable: "The selected model is unavailable for this account.",
};

export default function AIConnectionPanel({
  onConnected,
  initialEngine,
  onBusyChange,
}) {
  const [engine, setEngine] = useState(initialEngine || null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [editing, setEditing] = useState(false);
  const [provider, setProvider] = useState("openai"),
    [model, setModel] = useState("gpt-6-luna"),
    [key, setKey] = useState(""),
    [models, setModels] = useState([]);
  useEffect(() => {
    if (initialEngine) return;
    let active = true;
    request("/assistant/connection")
      .then((value) => {
        if (active) setEngine(value);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [initialEngine]);
  async function run(fn) {
    if (busy) return;
    setBusy(true);
    onBusyChange?.(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  }
  async function change(source) {
    await run(async () => {
      const next = await request("/assistant/source", { source }, "PUT");
      setEngine(next);
      onConnected?.(next);
    });
  }
  async function save(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await run(async () => {
      const next = await request("/assistant/connection", {
        provider,
        model,
        api_key: key,
        monthly_limit: Number(form.get("monthly_limit")),
        consent: form.get("consent") === "on",
      });
      setKey("");
      setEditing(false);
      setEngine(next);
      onConnected?.(next);
    });
  }
  const ai = engine && engine.source !== "grounded";
  const label =
    engine?.source === "byok"
      ? `${names[engine.provider]} · ${engine.model}`
      : engine?.source === "managed"
        ? `${names[engine.provider] || "Managed AI"} · ${engine.model || engine.managed_model}`
        : "Saved business facts";
  return (
    <section className="bb-panel bb-ai-connection" aria-label="AI connection">
      <div className="bb-ai-connection-heading">
        <span className="bb-connection-icon">
          <Icon name="sparkle" size={24} />
        </span>
        <div>
          <h2>Your reply engine</h2>
          <p>{label}</p>
        </div>
        <Status tone={ai && !engine.fallback ? "success" : "neutral"}>
          {!engine
            ? "Checking"
            : ai && !engine.fallback
              ? "AI connected"
              : ai
                ? "Using saved facts"
                : "No model connected"}
        </Status>
      </div>
      <InlineError>{error}</InlineError>
      {engine && (
        <>
          {ai && (
            <div className="bb-ai-usage">
              <div>
                <span>
                  {engine.used} of {engine.monthly_limit} AI requests this month
                </span>
                <span>{engine.month}</span>
              </div>
              <progress
                aria-label="Monthly AI usage"
                max={Math.max(1, engine.monthly_limit)}
                value={engine.used}
              />
              <p>
                Assistant test replies count toward this cap. Failed requests
                are released. Your allowance resets on the first of each month (UTC).
              </p>
            </div>
          )}
          {recovery[engine.state] && (
            <p className="bb-ai-notice" role="status">
              {recovery[engine.state]}
            </p>
          )}
          <div className="bb-ai-options">
            <div>
              <h3>BizBuddy managed AI</h3>
              <p>
                {engine.managed_available
                  ? `${engine.managed_model} is available for this workspace. Free plan: ${engine.managed_limit} managed AI requests per month. No model key needed.`
                  : "Let BizBuddy handle model access. Managed AI for new businesses is coming soon."}
              </p>
              {engine.managed_available ? (
                <Button
                  variant={
                    engine.source === "managed" ? "secondary" : "primary"
                  }
                  disabled={busy || engine.source === "managed"}
                  onClick={() => change("managed")}
                >
                  {engine.source === "managed" ? "Selected" : "Use managed AI"}
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  disabled={busy || engine.requested_access}
                  onClick={() =>
                    run(async () => {
                      await request("/assistant/managed-access", {});
                      setEngine({ ...engine, requested_access: true });
                    })
                  }
                >
                  {engine.requested_access
                    ? "Access requested"
                    : "Request managed AI access"}
                </Button>
              )}
            </div>
            <div>
              <h3>Connect your own model</h3>
              <p>
                Use an OpenAI, Groq or Google Gemini key. Your connection is
                private to this business.
              </p>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => setEditing(!editing)}
              >
                {editing
                  ? "Close key setup"
                  : engine.key_connected
                    ? "Change API connection"
                    : "Connect an API key"}
              </Button>
              {engine.key_connected && engine.source !== "byok" && (
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => change("byok")}
                >
                  Use {engine.key_provider} connection
                </Button>
              )}
            </div>
          </div>
          {editing && (
            <form onSubmit={save} className="bb-ai-key-form">
              <div className="bb-form-grid">
                <label>
                  AI provider
                  <select
                    value={provider}
                    onChange={(e) => {
                      setProvider(e.target.value);
                      setModel(e.target.value === "openai" ? "gpt-6-luna" : "");
                      setModels([]);
                    }}
                  >
                    {Object.entries(names)
                      .filter(([id]) =>
                        ["openai", "groq", "gemini"].includes(id),
                      )
                      .map(([id, name]) => (
                        <option key={id} value={id}>
                          {name}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  API key
                  <input
                    required
                    type="password"
                    autoComplete="off"
                    spellCheck="false"
                    value={key}
                    onChange={(e) => {
                      setKey(e.target.value);
                      setModels([]);
                    }}
                    placeholder="Paste your provider key"
                    minLength={10}
                    maxLength={512}
                  />
                </label>
              </div>
              <div className="bb-ai-model-row">
                <label>
                  Model ID
                  <input
                    required
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    list="business-ai-models"
                    placeholder="Choose or enter a model ID"
                    maxLength={128}
                  />
                  <datalist id="business-ai-models">
                    {models.map((id) => (
                      <option key={id} value={id} />
                    ))}
                  </datalist>
                </label>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy || key.length < 10}
                  onClick={() =>
                    run(async () => {
                      const result = await request("/assistant/models", {
                        provider,
                        api_key: key,
                      });
                      setModels(result.models);
                      if (!model && result.models.length)
                        setModel(result.models[0]);
                    })
                  }
                >
                  Load models
                </Button>
              </div>
              <label>
                Monthly AI request cap
                <input
                  type="number"
                  name="monthly_limit"
                  min="10"
                  max="10000"
                  defaultValue={500}
                  required
                />
              </label>
              <label className="bb-ai-consent">
                <input type="checkbox" name="consent" required />
                <span>
                  I authorize a test request and model replies using this key.
                  My provider may charge my account. This request cap is not a
                  monetary spending limit.
                </span>
              </label>
              <p className="bb-form-help">
                Keys are encrypted on the server and never displayed again. The
                current connection stays active if verification fails.
              </p>
              <Button busy={busy}>Verify &amp; connect model</Button>
            </form>
          )}
          <div className="bb-ai-connection-footer">
            <p>
              Orders and payments always need owner confirmation. If AI is
              unavailable, saved facts and human handoffs remain available.
            </p>
            <div>
              {engine.source !== "grounded" && (
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => change("grounded")}
                >
                  Use saved facts only
                </Button>
              )}
              {engine.key_connected && (
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const next = await request(
                        "/assistant/connection",
                        {},
                        "DELETE",
                      );
                      setEngine(next);
                      onConnected?.(next);
                    })
                  }
                >
                  Remove saved API key
                </Button>
              )}
            </div>
          </div>
          {engine.provider === "chatgpt" && (
            <a
              className="bb-ai-usage-link"
              href="https://chatgpt.com/settings/usage"
              target="_blank"
              rel="noreferrer"
            >
              Manage ChatGPT plan usage
            </a>
          )}
        </>
      )}
    </section>
  );
}
