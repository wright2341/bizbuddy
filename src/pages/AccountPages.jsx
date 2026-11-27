import { useEffect, useState } from "react";
import { request } from "../operationsApi";
import {
  Button,
  Channel,
  EmptyState,
  Icon,
  InlineError,
  LoadingPage,
  Modal,
  PageHeader,
  Status,
} from "../components/ui";
import { dateLabel, downloadCSV, initials, money } from "../components/format";

export function OrdersPage({ openNew, setNotice }) {
  const [orders, setOrders] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("All orders"),
    [newOrder, setNewOrder] = useState(openNew),
    [selected, setSelected] = useState(null);
  useEffect(() => {
    let active = true;
    request("/orders")
      .then((rows) => {
        if (active) setOrders(rows);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  async function create(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const fields = Object.fromEntries(new FormData(event.currentTarget));
      const order = await request("/orders", {
        ...fields,
        amount: money(Math.round(Number(fields.amount) * 100)),
      });
      setOrders((current) => [order, ...current]);
      setNewOrder(false);
      setNotice("Order created.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function updateStatus(status) {
    setBusy(true);
    try {
      const updated = await request(
        "/orders/" + selected.id,
        { status },
        "PATCH",
      );
      setOrders((current) =>
        current.map((o) => (o.id === updated.id ? updated : o)),
      );
      setSelected(updated);
      setNotice("Order status updated.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (!orders && !error) return <LoadingPage />;
  const rows = (orders || []).filter(
    (o) =>
      (filter === "All orders" ||
        (filter === "Pending"
          ? o.status === "Pending"
          : filter === "In progress"
            ? ["Confirmed", "In Transit"].includes(o.status)
            : ["Delivered", "Settled"].includes(o.status))) &&
      [o.name, o.cuts, o.id, o.channel].some((v) =>
        String(v).toLowerCase().includes(query.toLowerCase()),
      ),
  );
  const counts = [
    ["Total orders", orders?.length || 0, "box"],
    [
      "Pending",
      orders?.filter((o) => o.status === "Pending").length || 0,
      "clock",
    ],
    [
      "In progress",
      orders?.filter((o) => ["Confirmed", "In Transit"].includes(o.status))
        .length || 0,
      "stock",
    ],
    [
      "Completed",
      orders?.filter((o) => ["Delivered", "Settled"].includes(o.status))
        .length || 0,
      "circleCheck",
    ],
  ];
  return (
    <>
      <PageHeader
        title="Orders"
        description="From the first request to the final delivery. All in order."
      >
        <Button
          variant="secondary"
          icon="download"
          onClick={() =>
            downloadCSV(
              "bizbuddy-orders.csv",
              [
                "Reference",
                "Customer",
                "Product",
                "Quantity",
                "Amount",
                "Channel",
                "Status",
              ],
              rows.map((o) => [
                o.id,
                o.name,
                o.cuts,
                o.yards,
                o.amount,
                o.channel,
                o.status,
              ]),
            )
          }
          disabled={!orders?.length}
        >
          Export
        </Button>
        <Button icon="plus" onClick={() => setNewOrder(true)}>
          New order
        </Button>
      </PageHeader>
      <InlineError>{error}</InlineError>
      <div className="bb-stats">
        {counts.map(([label, value, icon]) => (
          <article key={label}>
            <span className="bb-stat-icon">
              <Icon name={icon} />
            </span>
            <div>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          </article>
        ))}
      </div>
      <section className="bb-panel">
        <div className="bb-table-toolbar">
          <div className="bb-tabs" aria-label="Filter orders">
            {["All orders", "Pending", "In progress", "Completed"].map(
              (tab) => (
                <button
                  className={filter === tab ? "is-active" : ""}
                  aria-pressed={filter === tab}
                  key={tab}
                  onClick={() => setFilter(tab)}
                >
                  {tab}
                </button>
              ),
            )}
          </div>
          <div className="bb-search-field">
            <Icon name="search" size={18} />
            <input
              aria-label="Search orders"
              placeholder="Search orders…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        {rows.length ? (
          <div className="bb-table-scroll">
            <table className="bb-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Product</th>
                  <th>Channel</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>
                    <span className="bb-sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <div className="bb-person">
                        <span className="bb-avatar bb-avatar-soft">
                          {initials(o.name)}
                        </span>
                        <span>
                          <strong>{o.name}</strong>
                          <small>#{o.id.slice(0, 8)}</small>
                        </span>
                      </div>
                    </td>
                    <td>
                      <strong>{o.cuts}</strong>
                      <small>
                        {o.yards} units · {o.material}
                      </small>
                    </td>
                    <td>
                      <Channel name={o.channel} />
                    </td>
                    <td className="bb-number">{o.amount}</td>
                    <td>
                      <Status
                        tone={
                          ["Delivered", "Settled"].includes(o.status)
                            ? "success"
                            : o.status === "Pending"
                              ? "warning"
                              : "info"
                        }
                      >
                        {o.status}
                      </Status>
                    </td>
                    <td>
                      <Button variant="ghost" onClick={() => setSelected(o)}>
                        View order <Icon name="arrow" size={16} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon="box"
            title={
              orders?.length
                ? "No orders match your search."
                : "Your next order starts here."
            }
            description={
              orders?.length
                ? "Try another search or filter."
                : "Confirm a request from your inbox, or add a walk-in order yourself."
            }
            action={
              !orders?.length && (
                <Button icon="plus" onClick={() => setNewOrder(true)}>
                  Create your first order
                </Button>
              )
            }
          />
        )}
      </section>
      {newOrder && (
        <Modal
          title="Create an order"
          description="Record a walk-in or an order received outside your inbox."
          onClose={() => setNewOrder(false)}
        >
          <form className="bb-form" onSubmit={create}>
            <InlineError>{error}</InlineError>
            <div className="bb-form-grid">
              <label>
                Customer name
                <input name="name" required maxLength={255} />
              </label>
              <label>
                Channel
                <select name="channel" defaultValue="Walk-in">
                  <option>Walk-in</option>
                  <option>WhatsApp</option>
                  <option>Instagram</option>
                  <option>Email</option>
                  <option>Other</option>
                </select>
              </label>
              <label>
                Product or item
                <input name="cuts" required maxLength={255} />
              </label>
              <label>
                Material or description
                <input name="material" required maxLength={255} />
              </label>
              <label>
                Quantity
                <input name="yards" type="number" min="1" step="1" required />
              </label>
              <label>
                Amount (NGN)
                <input
                  name="amount"
                  type="number"
                  min="0"
                  step=".01"
                  required
                />
              </label>
            </div>
            <input name="vip" type="hidden" value="Customer" />
            <p className="bb-form-help">
              Manual orders do not adjust inventory. Confirm inbox requests to
              update stock automatically.
            </p>
            <div className="bb-form-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setNewOrder(false)}
              >
                Cancel
              </Button>
              <Button busy={busy}>Create order</Button>
            </div>
          </form>
        </Modal>
      )}
      {selected && (
        <Modal
          title="Order details"
          description={"Reference #" + selected.id.slice(0, 8)}
          onClose={() => setSelected(null)}
        >
          <dl className="bb-details">
            <div>
              <dt>Customer</dt>
              <dd>{selected.name}</dd>
            </div>
            <div>
              <dt>Product</dt>
              <dd>{selected.cuts}</dd>
            </div>
            <div>
              <dt>Description</dt>
              <dd>{selected.material}</dd>
            </div>
            <div>
              <dt>Quantity</dt>
              <dd>{selected.yards}</dd>
            </div>
            <div>
              <dt>Amount</dt>
              <dd>{selected.amount}</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{dateLabel(selected.time)}</dd>
            </div>
          </dl>
          <label className="bb-field">
            Order status
            <select
              aria-label="Order status"
              value={selected.status}
              disabled={busy}
              onChange={(e) => updateStatus(e.target.value)}
            >
              {[
                "Pending",
                "Confirmed",
                "In Transit",
                "Delivered",
                "Settled",
              ].map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>
          <InlineError>{error}</InlineError>
        </Modal>
      )}
    </>
  );
}

export function SettingsPage({ profile, setProfile, setNotice }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notifications, setNotifications] = useState(null),
    [tab, setTab] = useState("Profile");
  useEffect(() => {
    let active = true;
    request("/operations")
      .then((data) => {
        if (active) setNotifications(data.notifications);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      if (tab === "Profile") {
        const next = await request("/profile", values, "PUT");
        setProfile(next);
        setNotice("Your profile has been updated.");
      } else {
        const next = await request(
          "/operations/notifications",
          { ...values, hour_utc: Number(values.hour_utc) },
          "PUT",
        );
        setNotifications(next);
        setNotice("Daily summary preferences saved.");
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        title="Settings"
        description="A few details that make this workspace yours."
      />
      <div className="bb-settings-layout">
        <nav className="bb-settings-nav" aria-label="Settings sections">
          {[
            ["Profile", "users"],
            ["Daily summary", "calendar"],
          ].map(([label, icon]) => (
            <button
              key={label}
              className={tab === label ? "is-active" : ""}
              onClick={() => setTab(label)}
            >
              <Icon name={icon} size={18} />
              {label}
            </button>
          ))}
        </nav>
        <section className="bb-panel bb-settings-panel">
          <div className="bb-panel-heading">
            <div>
              <h2>
                {tab === "Profile"
                  ? "Your profile & business"
                  : "Your daily summary"}
              </h2>
              <p>
                {tab === "Profile"
                  ? "Keep your contact and business information up to date."
                  : "One useful message at the end of your business day."}
              </p>
            </div>
            {tab === "Profile" && (
              <span className="bb-avatar bb-avatar-large">
                {initials(profile.name)}
              </span>
            )}
          </div>
          <form className="bb-form" key={tab} onSubmit={save}>
            <InlineError>{error}</InlineError>
            {tab === "Profile" ? (
              <div className="bb-form-grid">
                {[
                  ["name", "Full name", "text", "name"],
                  ["business", "Business name", "text", "organization"],
                  ["email", "Email address", "email", "email"],
                  ["phone", "Phone number", "tel", "tel"],
                  ["role", "Your role", "text", "organization-title"],
                  ["location", "Business location", "text", "address-level2"],
                ].map(([name, label, type, autocomplete]) => (
                  <label key={name}>
                    {label}
                    <input
                      name={name}
                      type={type}
                      autoComplete={autocomplete}
                      defaultValue={profile[name] || ""}
                      required={["name", "email", "business"].includes(name)}
                      maxLength={255}
                    />
                  </label>
                ))}
              </div>
            ) : notifications ? (
              <>
                <label>
                  Deliver my summary to
                  <select name="channel" defaultValue={notifications.channel}>
                    <option value="dashboard">Dashboard only</option>
                    <option value="telegram">Telegram</option>
                    <option value="email">Gmail</option>
                  </select>
                </label>
                <label>
                  Your email address or Telegram chat ID
                  <input
                    name="recipient"
                    defaultValue={notifications.recipient}
                    maxLength={255}
                  />
                  <span className="bb-form-help">
                    Connect your chosen channel first. Telegram chat IDs appear
                    in Customers after you message your bot.
                  </span>
                </label>
                <label>
                  Send at (UTC hour)
                  <select
                    aria-label="Send at (UTC hour)"
                    name="hour_utc"
                    defaultValue={notifications.hour_utc}
                  >
                    {Array.from({ length: 24 }, (_, n) => (
                      <option value={n} key={n}>
                        {String(n).padStart(2, "0")}:00 UTC
                      </option>
                    ))}
                  </select>
                </label>
                <div className="bb-note">
                  <Icon name="clock" size={18} />
                  <span>
                    Last delivery:{" "}
                    {notifications.sent_day
                      ? dateLabel(notifications.sent_day)
                      : "Not sent yet"}
                    . Delivery status:{" "}
                    {notifications.last_status.replaceAll("_", " ")}.
                  </span>
                </div>
              </>
            ) : (
              <LoadingPage />
            )}
            <div className="bb-form-actions">
              <p className="bb-form-help">
                Your workspace is private to your account.
              </p>
              <Button busy={busy}>Save changes</Button>
            </div>
          </form>
        </section>
      </div>
    </>
  );
}
export function PlanPage({ onNavigate }) {
  return (
    <>
      <PageHeader
        title="Your workspace plan"
        description="Everything you need to put a little more order into your day."
      />
      <div className="bb-plan-layout">
        <section className="bb-panel bb-plan">
          <Status tone="success">Current workspace</Status>
          <h2>BizBuddy essentials</h2>
          <p className="bb-plan-price">
            Free <span>to use</span>
          </p>
          <p>
            The working small-business toolkit. No subscription checkout or
            payment processing is enabled.
          </p>
          <ul>
            {[
              "One private business workspace",
              "Unified customer inbox and owner replies",
              "Products, stock and confirmed orders",
              "Invoices and reviewed payment reminders",
              "Daily summaries and customer linking",
              "Website chat with grounded product replies",
            ].map((f) => (
              <li key={f}>
                <Icon name="circleCheck" size={19} />
                {f}
              </li>
            ))}
          </ul>
          <Button onClick={() => onNavigate("connections")}>
            Manage your connections
          </Button>
        </section>
        <section className="bb-panel">
          <div className="bb-panel-heading">
            <div>
              <h2>Connected service costs</h2>
              <p>You choose which external services to connect.</p>
            </div>
          </div>
          <dl className="bb-costs">
            {[
              ["Website chat", "Included. No external account needed."],
              ["Telegram", "Free Bot API. A bot token is required."],
              ["Gmail", "Uses your own account and its sending limits."],
              [
                "WhatsApp & SMS",
                "Twilio provider pricing and account requirements apply.",
              ],
              [
                "Optional AI provider",
                "The default reply engine needs no paid API key. An OpenAI key enables usage-billed responses.",
              ],
            ].map(([name, description]) => (
              <div key={name}>
                <dt>{name}</dt>
                <dd>{description}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </>
  );
}
