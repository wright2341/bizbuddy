import { useEffect, useState } from "react";
import { request } from "./operationsApi";
import "./OperationsWorkspace.css";
import { PageHeader } from "./components/ui";

export default function LiveTwilioWorkspace({ setNotice }) {
  const [account, setAccount] = useState(null);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    const [status, history] = await Promise.all([
      request("/twilio/status"),
      request("/twilio/messages"),
    ]);
    setAccount(status);
    setMessages(history);
  }
  useEffect(() => {
    let active = true;
    Promise.all([request("/twilio/status"), request("/twilio/messages")])
      .then(([status, history]) => {
        if (active) {
          setAccount(status);
          setMessages(history);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  async function act(path, data, message, method) {
    setBusy(true);
    setError("");
    try {
      await request(path, data, method);
      await load();
      setNotice(message);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="ops">
      <PageHeader title="WhatsApp & SMS" description="Manage your verified Twilio connection and real message history." />
      <p>
        Twilio requires your own account and sender; usage may incur charges.
        Free web chat and Telegram are available on the Connections page.
        This page shows real Twilio message history.
      </p>
      {error && (
        <p className="ops-error" role="alert">
          {error}
        </p>
      )}
      <div className="ops-grid">
        <article className="ops-card">
          <h3>
            {account?.connected
              ? `Connected: ${account.account_name || account.account_sid}`
              : "Connect your account"}
          </h3>
          {!account?.connected ? (
            <form
              className="ops-form"
              onSubmit={(e) => {
                e.preventDefault();
                act(
                  "/twilio/connect",
                  Object.fromEntries(new FormData(e.currentTarget)),
                  "Twilio account verified and connected.",
                );
              }}
            >
              {[
                ["account_sid", "Account SID", "text"],
                ["auth_token", "Auth token", "password"],
                ["sms_sender", "SMS sender (E.164)", "tel"],
                ["whatsapp_sender", "WhatsApp sender (E.164)", "tel"],
              ].map(([key, label, type]) => (
                <label key={key}>
                  {label}
                  <input
                    name={key}
                    type={type}
                    required={["account_sid", "auth_token"].includes(key)}
                  />
                </label>
              ))}
              <button disabled={busy}>Verify & connect</button>
            </form>
          ) : (
            <>
              <p>
                SMS: {account.sms_sender || "Not configured"}
                <br />
                WhatsApp: {account.whatsapp_sender || "Not configured"}
              </p>
              <p>
                Configure this incoming webhook in Twilio:
                <br />
                <code className="ops-link">{account.webhook_url}</code>
              </p>
              <button
                disabled={busy}
                onClick={() => act("/twilio/test", {}, "Connection verified.")}
              >
                Test connection
              </button>
              <button
                disabled={busy}
                onClick={() => act("/twilio/sync", {}, "History synchronized.")}
              >
                Sync history
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  act(
                    "/twilio/disconnect",
                    {},
                    "Twilio disconnected.",
                    "DELETE",
                  )
                }
              >
                Disconnect
              </button>
            </>
          )}
        </article>
        <form
          className="ops-card ops-form"
          onSubmit={(e) => {
            e.preventDefault();
            act(
              "/twilio/send",
              Object.fromEntries(new FormData(e.currentTarget)),
              "Message submitted to Twilio.",
            );
          }}
        >
          <h3>Send a message</h3>
          <label>
            Recipient
            <input required name="to" type="tel" placeholder="+234…" />
          </label>
          <label>
            Channel
            <select name="channel">
              <option value="sms">SMS</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
          </label>
          <label>
            Message
            <textarea required name="body" maxLength={1600} />
          </label>
          <p className="ops-muted">
            Only message opted-in recipients. WhatsApp sandbox recipients must
            join your sandbox. Business-first messages may require approved
            templates.
          </p>
          <button disabled={busy || !account?.connected}>
            Send through Twilio
          </button>
        </form>
      </div>
      <article className="ops-card">
        <h3>Message history</h3>
        {messages.length ? (
          messages.map((m) => (
            <div className="ops-row" key={m.message_sid}>
              <div>
                <strong>
                  {m.direction} · {m.channel} · {m.status}
                </strong>
                <p>
                  {m.sender} → {m.recipient}
                </p>
                <p>{m.body}</p>
              </div>
            </div>
          ))
        ) : (
          <p>No stored messages.</p>
        )}
      </article>
    </section>
  );
}
