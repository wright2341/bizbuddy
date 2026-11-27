import { useState } from "react";
import { useBusiness } from "../businessContext";
import { request } from "../operationsApi";
import {
  Button,
  Channel,
  Icon,
  InlineError,
  Modal,
  PageHeader,
  Status,
} from "../components/ui";

export default function ConnectionsPage() {
  const { inbox, bot, busy, error, action, onNavigate } = useBusiness();
  const [setup, setSetup] = useState(null),
    [disconnect, setDisconnect] = useState(null);
  const connected = (id) =>
    inbox.channels.some((c) => c.channel === id && c.status === "connected");
  const cards = [
    [
      "website",
      "Website chat",
      "Your own customer chat page. No external account needed.",
      "Included",
    ],
    [
      "telegram",
      "Telegram",
      "Bring messages from your bot into one shared inbox.",
      "Free Bot API",
    ],
    [
      "email",
      "Gmail",
      "Sync unread email and review every reply before sending.",
      "Your Gmail account",
    ],
    [
      "twilio_whatsapp",
      "WhatsApp & SMS",
      "Connect a verified Twilio sender or the WhatsApp sandbox.",
      "Provider charges apply",
    ],
  ];
  async function connect(event) {
    event.preventDefault();
    const f = Object.fromEntries(new FormData(event.currentTarget));
    await action(async () => {
      if (setup === "website") {
        await request("/operations/website/setup", {});
        if (f.origin && f.origin !== window.location.origin) {
          const next = await request("/chatbot");
          await request(
            "/chatbot",
            { ...next, website_domain: f.origin },
            "PUT",
          );
        }
      } else if (setup === "telegram") {
        await request("/chatbot/channels", {
          channel: "telegram",
          bot_token: f.bot_token,
        });
        await request("/chatbot/activate", {});
      } else if (setup === "email") {
        await request("/operations/email/connect", {
          address: f.address,
          app_password: f.app_password,
        });
      } else {
        await request("/chatbot/channels", { channel: setup, ...f });
        await request("/chatbot/activate", {});
      }
      setSetup(null);
    }, "Channel connected. Your customer conversations will appear in the inbox.");
  }
  const publicLink = bot.public_id
    ? `${window.location.origin}/chat/${bot.public_id}`
    : "";
  const embed = `<script src="${window.location.origin}/chatbot-widget.js?bot=${bot.public_id}" defer></script>`;
  async function copy(value) {
    await action(async () => {
      await navigator.clipboard.writeText(value);
    }, "Copied to clipboard.");
  }
  return (
    <>
      <PageHeader
        title="Connections"
        description="Meet your customers where they are. Manage the conversation here."
      />
      <div className="bb-connections-grid">
        {cards.map(([id, label, description, note]) => {
          const live =
            id === "twilio_whatsapp"
              ? connected(id) || connected("sms")
              : connected(id);
          return (
            <section className="bb-panel bb-connection-card" key={id}>
              <div className="bb-connection-card-top">
                <span className="bb-connection-icon">
                  <Channel name={id} withLabel={false} />
                </span>
                <Status tone={live ? "success" : "neutral"}>
                  {live ? "Connected" : "Not connected"}
                </Status>
              </div>
              <h2>{label}</h2>
              <p>{description}</p>
              <small>{note}</small>
              <div className="bb-connection-actions">
                <Button
                  variant={live ? "secondary" : "primary"}
                  icon={live ? "settings" : "plus"}
                  onClick={() =>
                    id === "twilio_whatsapp"
                      ? onNavigate("twilio")
                      : setSetup(id)
                  }
                >
                  {live
                    ? "Manage connection"
                    : "Connect " +
                      (id === "website"
                        ? "web chat"
                        : id === "twilio_whatsapp"
                          ? "Twilio"
                          : label)}
                </Button>
                {live && (
                  <Button variant="ghost" onClick={() => setDisconnect(id)}>
                    Disconnect
                  </Button>
                )}
              </div>
            </section>
          );
        })}
      </div>
      {connected("website") && (
        <section className="bb-panel bb-widget-panel">
          <div className="bb-panel-heading">
            <div>
              <h2>Your customer chat is ready</h2>
              <p>
                Share the link, or embed the widget on your allowed website.
              </p>
            </div>
            <Status tone={bot.enabled ? "success" : "neutral"}>
              {bot.enabled ? "Available" : "Paused"}
            </Status>
          </div>
          <div className="bb-panel-body">
            <div className="bb-copy-row">
              <label>
                Customer chat link
                <input
                  readOnly
                  aria-label="Customer chat link"
                  value={publicLink}
                />
              </label>
              <Button
                variant="secondary"
                icon="copy"
                onClick={() => copy(publicLink)}
              >
                Copy link
              </Button>
              {bot.website_domain === window.location.origin && (
                <Button
                  variant="secondary"
                  icon="external"
                  onClick={() =>
                    window.open(publicLink, "_blank", "noopener,noreferrer")
                  }
                >
                  Open customer chat
                </Button>
              )}
            </div>
            <div className="bb-copy-row">
              <label>
                Embed code
                <input
                  readOnly
                  aria-label="Website chat embed code"
                  value={embed}
                />
              </label>
              <Button
                variant="secondary"
                icon="copy"
                onClick={() => copy(embed)}
              >
                Copy code
              </Button>
            </div>
            <p className="bb-form-help">
              Allowed website: {bot.website_domain}. The embedded widget only
              responds on this origin. The hosted chat link works when this is
              your BizBuddy origin.
            </p>
          </div>
        </section>
      )}
      <section className="bb-panel bb-meta-panel">
        <div className="bb-panel-heading">
          <div>
            <h2>More ways to connect</h2>
            <p>
              Official Meta integrations require your own approved app or tester
              accounts.
            </p>
          </div>
        </div>
        <div className="bb-provider-rows">
          {[
            ["instagram", "Instagram"],
            ["messenger", "Facebook Messenger"],
            ["whatsapp", "Meta WhatsApp Business"],
          ].map(([id, label]) => (
            <div key={id}>
              <div>
                <Channel name={id} />
                <span>
                  <strong>{label}</strong>
                  <small>
                    {connected(id)
                      ? "Connected account"
                      : "External provider setup required"}
                  </small>
                </span>
              </div>
              <Status tone={connected(id) ? "success" : "neutral"}>
                {connected(id) ? "Connected" : "Needs Meta setup"}
              </Status>
              <Button variant="secondary" onClick={() => setSetup(id)}>
                Setup details
              </Button>
              {connected(id) && (
                <Button variant="ghost" onClick={() => setDisconnect(id)}>
                  Disconnect
                </Button>
              )}
            </div>
          ))}
        </div>
      </section>
      {setup && (
        <Modal
          title={
            setup === "website"
              ? "Set up website chat"
              : setup === "telegram"
                ? "Connect Telegram"
                : setup === "email"
                  ? "Connect Gmail"
                  : "Connect an official Meta channel"
          }
          description={
            setup === "website"
              ? "A hosted customer chat page and a widget for your website."
              : setup === "telegram"
                ? "Create a bot with @BotFather, then paste its bot token below."
                : setup === "email"
                  ? "Use a dedicated inbox with a Google app password. Every generated reply waits for your approval."
                  : "Provide credentials from your approved Meta developer app. Production access depends on Meta app review."
          }
          onClose={() => setSetup(null)}
        >
          <form className="bb-form" onSubmit={connect}>
            <InlineError>{error}</InlineError>
            {setup === "website" ? (
              <>
                <label>
                  Allowed website origin
                  <input
                    aria-label="Allowed website origin"
                    name="origin"
                    type="url"
                    required
                    defaultValue={bot.website_domain || window.location.origin}
                    placeholder="https://yourwebsite.com"
                  />
                  <span className="bb-form-help">
                    Use your BizBuddy origin for the hosted chat page. Use your
                    own website origin for an embedded widget.
                  </span>
                </label>
                <div className="bb-note">
                  <Icon name="shield" size={19} />
                  <span>
                    The assistant uses your saved products and policies.
                    Unrecognized questions and order requests are handed to you.
                  </span>
                </div>
              </>
            ) : setup === "telegram" ? (
              <>
                <label>
                  Telegram bot token
                  <input
                    name="bot_token"
                    required
                    type="password"
                    autoComplete="off"
                    placeholder="Paste the token from BotFather"
                    maxLength={255}
                  />
                </label>
                <p className="bb-form-help">
                  BizBuddy verifies the token and registers the webhook
                  automatically. Then message your bot to start a conversation.
                </p>
              </>
            ) : setup === "email" ? (
              <>
                <label>
                  Gmail address
                  <input
                    name="address"
                    required
                    type="email"
                    autoComplete="off"
                    placeholder="yourbusiness@gmail.com"
                  />
                </label>
                <label>
                  Google app password
                  <input
                    name="app_password"
                    required
                    type="password"
                    autoComplete="off"
                    minLength={8}
                  />
                </label>
                <p className="bb-form-help">
                  Google requires two-step verification to create an app
                  password. Use an app password, not your regular account
                  password. Some managed Google accounts restrict this feature.
                </p>
                <p className="bb-form-help">
                  Unread plain-text messages sync once a minute. Attachments are
                  not read. Automated and bulk emails are skipped.
                </p>
              </>
            ) : (
              <>
                {[
                  ["account_id", "Account or page ID"],
                  ["access_token", "Access token"],
                  ["app_secret", "Meta app secret"],
                ].map(([name, label]) => (
                  <label key={name}>
                    {label}
                    <input
                      name={name}
                      type={name === "account_id" ? "text" : "password"}
                      autoComplete="off"
                      required
                    />
                  </label>
                ))}
                <div className="bb-note">
                  <Icon name="link" size={18} />
                  <span>
                    Webhook callback: {window.location.origin}
                    /api/webhooks/meta. Your Meta verification token must also
                    be configured on the server. Instagram and Messenger reply
                    windows and WhatsApp template rules apply.
                  </span>
                </div>
              </>
            )}
            <div className="bb-form-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setSetup(null)}
              >
                Cancel
              </Button>
              <Button busy={busy}>
                {setup === "website"
                  ? "Enable website chat"
                  : "Verify & connect"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {disconnect && (
        <Modal
          title="Disconnect this channel?"
          description="Your saved conversations stay in the inbox. New messages and replies will stop until you reconnect."
          onClose={() => setDisconnect(null)}
        >
          <InlineError>{error}</InlineError>
          <div className="bb-form-actions">
            <Button variant="secondary" onClick={() => setDisconnect(null)}>
              Keep connected
            </Button>
            <Button
              variant="danger"
              busy={busy}
              onClick={() =>
                action(async () => {
                  await request(
                    ["twilio_whatsapp", "sms"].includes(disconnect)
                      ? "/twilio/disconnect"
                      : `/chatbot/channels/${disconnect}`,
                    {},
                    "DELETE",
                  );
                  setDisconnect(null);
                }, "Channel disconnected. Your conversation history is still available.")
              }
            >
              Disconnect channel
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
