import { useState } from "react";
import { request } from "../operationsApi";
import { useBusiness } from "../businessContext";
import {
  Button,
  Channel,
  EmptyState,
  Icon,
  Modal,
  PageHeader,
  Status,
} from "../components/ui";
import { dateLabel, initials, money, timeLabel } from "../components/format";

export default function OverviewPage() {
  const { data, inbox, engine, profile, busy, action, onNavigate } =
    useBusiness();
  const [history, setHistory] = useState(false);
  const s = data.summary;
  const recent = [...inbox.conversations]
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, 4);
  const channels = [
    ["website", "Website chat", "Your own customer chat page"],
    ["telegram", "Telegram", "Reply to your customers on Telegram"],
    ["email", "Gmail", "Review replies before sending"],
  ];
  const stats = [
    ["Order requests today", s.order_requests, "box"],
    ["Outstanding", money(s.unpaid_total), "invoice"],
    ["Conversations to review", s.needs_attention, "message"],
    ["Low-stock products", s.low_stock.length, "warning"],
  ];
  return (
    <>
      <PageHeader
        title="Your customer automation, at a glance."
        description={`Here’s what’s happening at ${profile?.business || "your business"}.`}
      >
        <Button
          variant="secondary"
          icon="refresh"
          busy={busy}
          onClick={() =>
            action(
              () => request("/operations/automation", {}),
              "Your daily briefing is up to date.",
            )
          }
        >
          Refresh briefing
        </Button>
      </PageHeader>
      <section className="bb-ai-overview">
        <div>
          <h2>
            {engine?.source !== "grounded" && !engine?.fallback
              ? "AI customer replies are connected."
              : "Turn your knowledge into customer replies."}
          </h2>
          <p>
            {engine?.source !== "grounded"
              ? `${engine?.model || "Your model"} · ${engine?.used || 0} / ${engine?.monthly_limit || 0} AI requests this month`
              : "Connect a model, teach it about your business, then see it answer a real question."}
          </p>
        </div>
        <Button onClick={() => onNavigate("setup")}>
          Set up &amp; test my assistant <Icon name="arrow" size={16} />
        </Button>
      </section>
      <div className="bb-stats">
        {stats.map(([label, value, icon]) => (
          <article key={label}>
            <span className="bb-stat-icon">
              <Icon name={icon} size={23} />
            </span>
            <div>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          </article>
        ))}
      </div>
      <div className="bb-dashboard-grid">
        <section className="bb-panel">
          <div className="bb-panel-heading">
            <h2>Your daily briefing</h2>
            <small>{dateLabel(s.date)}</small>
          </div>
          <div className="bb-briefing">
            <div className="bb-briefing-note">
              <Icon name="circleCheck" size={19} />
              <span>
                {s.needs_attention
                  ? `${s.needs_attention} ${s.needs_attention === 1 ? "conversation could" : "conversations could"} use your attention. Everything you need is below.`
                  : data.products.length
                    ? "You’re on top of things. There are no conversations waiting for review."
                    : "A calm workspace, ready for your first customer. Add a product to get started."}
              </span>
            </div>
            {[
              [
                "message",
                "Review customer requests",
                `${inbox.pending_order_count} order ${inbox.pending_order_count === 1 ? "request needs" : "requests need"} confirmation. ${s.needs_attention} conversations flagged for review.`,
                "Open inbox",
                "inbox",
              ],
              [
                "invoice",
                "Follow up on overdue invoices",
                `${s.overdue_count} overdue ${s.overdue_count === 1 ? "invoice" : "invoices"} totalling ${money(s.overdue_total)}. Every reminder waits for your approval.`,
                "View invoices",
                "invoices",
              ],
              [
                "stock",
                "Check low-stock products",
                s.low_stock.length
                  ? s.low_stock
                      .map((p) => `${p.name} (${p.stock} left)`)
                      .join(", ")
                  : "Your stock levels are looking healthy. Keep your catalogue up to date.",
                "View inventory",
                "inventory",
              ],
            ].map(([icon, title, description, label, slug]) => (
              <div className="bb-task" key={slug}>
                <Icon name={icon} size={22} />
                <div>
                  <strong>{title}</strong>
                  <p>{description}</p>
                </div>
                <Button variant="ghost" onClick={() => onNavigate(slug)}>
                  {label}
                  <Icon name="arrow" size={15} />
                </Button>
              </div>
            ))}
          </div>
        </section>
        <section className="bb-panel">
          <div className="bb-panel-heading">
            <h2>Connected channels</h2>
            <small>
              {inbox.channels.filter((c) => c.status === "connected").length}{" "}
              connected
            </small>
          </div>
          <div className="bb-channel-list">
            {channels.map(([id, label, description]) => {
              const connected = inbox.channels.some(
                (c) => c.channel === id && c.status === "connected",
              );
              return (
                <div className="bb-channel-row" key={id}>
                  <span className="bb-channel-symbol">
                    <Channel name={id} withLabel={false} />
                  </span>
                  <div>
                    <strong>{label}</strong>
                    <small>{description}</small>
                  </div>
                  <Status tone={connected ? "success" : "neutral"}>
                    {connected ? "Connected" : "Not connected"}
                  </Status>
                </div>
              );
            })}
          </div>
          <div className="bb-panel-footer">
            <span>Bring your conversations together.</span>
            <Button variant="ghost" onClick={() => onNavigate("connections")}>
              Manage <Icon name="arrow" size={15} />
            </Button>
          </div>
        </section>
      </div>
      <section className="bb-panel">
        <div className="bb-panel-heading">
          <div>
            <h2>Requests awaiting confirmation</h2>
            <p>Check the product and quantity, then confirm from your inbox.</p>
          </div>
          <Button variant="ghost" onClick={() => onNavigate("inbox")}>
            View inbox <Icon name="arrow" size={16} />
          </Button>
        </div>
        {inbox.order_requests.length ? (
          <div className="bb-table-scroll">
            <table className="bb-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Request</th>
                  <th>Channel</th>
                  <th>Status</th>
                  <th>Received</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {inbox.order_requests.slice(0, 5).map((o) => (
                  <tr key={o.id}>
                    <td>
                      <div className="bb-person">
                        <span className="bb-avatar bb-avatar-soft">
                          {initials(o.customer_name)}
                        </span>
                        <strong>{o.customer_name}</strong>
                      </div>
                    </td>
                    <td>
                      <span className="bb-truncate">{o.request}</span>
                    </td>
                    <td>
                      <Channel name={o.channel} />
                    </td>
                    <td>
                      <Status tone="warning">Needs review</Status>
                    </td>
                    <td>
                      <small>{timeLabel(o.created_at)}</small>
                    </td>
                    <td>
                      <Button
                        variant="ghost"
                        onClick={() => onNavigate("inbox")}
                      >
                        Review <Icon name="arrow" size={15} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon="circleCheck"
            title="No requests waiting on you."
            description="New customer order requests will appear here. You stay in control of every confirmation."
            action={
              <Button
                variant="secondary"
                onClick={() =>
                  onNavigate(data.products.length ? "connections" : "inventory")
                }
              >
                {data.products.length
                  ? "Connect a channel"
                  : "Add your first product"}
              </Button>
            }
          />
        )}
        <div className="bb-panel-footer">
          <span>Summaries refresh every minute and are saved by date.</span>
          <Button
            variant="ghost"
            icon="calendar"
            onClick={() => setHistory(true)}
          >
            Past summaries
          </Button>
        </div>
      </section>
      <section className="bb-panel bb-recent-panel">
        <div className="bb-panel-heading">
          <div>
            <h2>Recent conversations</h2>
            <p>Pick up where your customers left off.</p>
          </div>
          <Button variant="ghost" onClick={() => onNavigate("inbox")}>
            Open inbox <Icon name="arrow" size={16} />
          </Button>
        </div>
        {recent.length ? (
          <div className="bb-recent-list">
            {recent.map((c) => (
              <button key={c.id} onClick={() => onNavigate("inbox")}>
                <span className="bb-avatar bb-avatar-soft">
                  {initials(c.customer_name)}
                </span>
                <span>
                  <strong>{c.customer_name || "Customer"}</strong>
                  <small>
                    {c.messages.at(-1)?.content || "New conversation"}
                  </small>
                </span>
                <Channel name={c.channel} />
                <Icon name="arrow" size={17} />
              </button>
            ))}
          </div>
        ) : (
          <div className="bb-first-conversation">
            <span className="bb-first-conversation-icon">
              <Icon name="message" size={30} />
            </span>
            <div>
              <h3>Your next customer conversation belongs here.</h3>
              <p>
                Try a complete example now, or connect your website chat to
                start receiving real messages.
              </p>
            </div>
            <Button variant="secondary" onClick={() => onNavigate("demo")}>
              Explore example chats
            </Button>
          </div>
        )}
      </section>
      {history && (
        <Modal
          title="Your daily summaries"
          description="Saved snapshots from your business workspace."
          size="large"
          onClose={() => setHistory(false)}
        >
          <div className="bb-table-scroll">
            <table className="bb-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Requests</th>
                  <th>Outstanding</th>
                  <th>Needs review</th>
                </tr>
              </thead>
              <tbody>
                {data.summaries.map((d) => (
                  <tr key={d.date}>
                    <td>{dateLabel(d.date)}</td>
                    <td>{d.order_requests}</td>
                    <td>{money(d.unpaid_total)}</td>
                    <td>{d.needs_attention}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
    </>
  );
}
