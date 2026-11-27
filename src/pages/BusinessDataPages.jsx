import { useState } from "react";
import { useBusiness } from "../businessContext";
import { request } from "../operationsApi";
import {
  Button,
  Channel,
  EmptyState,
  Icon,
  InlineError,
  Modal,
  PageHeader,
  Status,
} from "../components/ui";
import {
  dateLabel,
  downloadCSV,
  initials,
  money,
  today,
} from "../components/format";

export function InventoryPage() {
  const { data, busy, error, action } = useBusiness();
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("All products"),
    [editor, setEditor] = useState(null);
  const products = data.products.filter(
    (p) =>
      (filter === "All products" ||
        (filter === "Low stock"
          ? p.stock <= p.threshold && p.stock > 0
          : p.stock === 0)) &&
      [p.name, p.description].some((v) =>
        v.toLowerCase().includes(query.toLowerCase()),
      ),
  );
  async function save(event) {
    event.preventDefault();
    const f = Object.fromEntries(new FormData(event.currentTarget));
    await action(async () => {
      await request(
        "/operations/products" + (editor.id ? "/" + editor.id : ""),
        {
          ...f,
          price: Math.round(Number(f.price) * 100),
          stock: Number(f.stock),
          threshold: Number(f.threshold),
        },
        editor.id ? "PUT" : "POST",
      );
      setEditor(null);
    }, "Product saved. Your assistant now has the latest price and availability.");
  }
  return (
    <>
      <PageHeader
        title="Inventory"
        description="A clear view of what you sell, what’s available, and what needs restocking."
      >
        <Button
          variant="secondary"
          icon="download"
          disabled={!data.products.length}
          onClick={() =>
            downloadCSV(
              "bizbuddy-inventory.csv",
              ["Product", "Price (NGN)", "Stock", "Low-stock threshold"],
              products.map((p) => [
                p.name,
                p.price / 100,
                p.stock,
                p.threshold,
              ]),
            )
          }
        >
          Export
        </Button>
        <Button
          icon="plus"
          onClick={() =>
            setEditor({
              name: "",
              price: 0,
              stock: 0,
              threshold: 5,
              description: "",
            })
          }
        >
          Add product
        </Button>
      </PageHeader>
      <div className="bb-stats bb-stats-three">
        {[
          ["Products in your catalogue", data.products.length, "stock"],
          [
            "Low-stock products",
            data.products.filter((p) => p.stock <= p.threshold && p.stock > 0)
              .length,
            "warning",
          ],
          [
            "Out of stock",
            data.products.filter((p) => p.stock === 0).length,
            "box",
          ],
        ].map(([label, value, icon]) => (
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
          <div className="bb-tabs" aria-label="Inventory filters">
            {["All products", "Low stock", "Out of stock"].map((tab) => (
              <button
                key={tab}
                className={filter === tab ? "is-active" : ""}
                aria-pressed={filter === tab}
                onClick={() => setFilter(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="bb-search-field">
            <Icon name="search" size={18} />
            <input
              aria-label="Search products"
              placeholder="Search your products…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        {products.length ? (
          <div className="bb-table-scroll">
            <table className="bb-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Price</th>
                  <th>Available units</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="bb-person">
                        <span className="bb-product-monogram">
                          {initials(p.name)}
                        </span>
                        <span>
                          <strong>{p.name}</strong>
                          <small>
                            {p.description || "No description added"}
                          </small>
                        </span>
                      </div>
                    </td>
                    <td className="bb-number">{money(p.price)}</td>
                    <td>
                      {p.stock}
                      <small>Low-stock alert at {p.threshold}</small>
                    </td>
                    <td>
                      <Status
                        tone={
                          p.stock === 0
                            ? "danger"
                            : p.stock <= p.threshold
                              ? "warning"
                              : "success"
                        }
                      >
                        {p.stock === 0
                          ? "Out of stock"
                          : p.stock <= p.threshold
                            ? "Low stock"
                            : "In stock"}
                      </Status>
                    </td>
                    <td>
                      <Button
                        variant="ghost"
                        icon="edit"
                        onClick={() => setEditor(p)}
                      >
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon="stock"
            title={
              data.products.length
                ? "No products match this view."
                : "Build a catalogue your assistant can rely on."
            }
            description={
              data.products.length
                ? "Try a different filter or product name."
                : "Add your first product with a verified price and stock level. Customer replies will use these details."
            }
            action={
              !data.products.length && (
                <Button
                  icon="plus"
                  onClick={() =>
                    setEditor({
                      name: "",
                      price: 0,
                      stock: 0,
                      threshold: 5,
                      description: "",
                    })
                  }
                >
                  Add your first product
                </Button>
              )
            }
          />
        )}
        <div className="bb-table-note">
          <span>
            {products.length} {products.length === 1 ? "product" : "products"}
          </span>
          <span>Confirmed inbox orders update stock automatically.</span>
        </div>
      </section>
      {editor && (
        <Modal
          title={editor.id ? "Edit product" : "Add a product"}
          description="These details are used in customer replies. Keep them accurate."
          onClose={() => setEditor(null)}
        >
          <form className="bb-form" onSubmit={save}>
            <InlineError>{error}</InlineError>
            <label>
              Product name
              <input
                name="name"
                required
                maxLength={255}
                defaultValue={editor.name}
                placeholder="e.g. Blue ankara"
              />
            </label>
            <div className="bb-form-grid">
              <label>
                Price (NGN)
                <input
                  name="price"
                  required
                  type="number"
                  min="0"
                  max="1000000000"
                  step=".01"
                  defaultValue={editor.id ? editor.price / 100 : ""}
                />
              </label>
              <label>
                Units in stock
                <input
                  name="stock"
                  required
                  type="number"
                  min="0"
                  max="10000000"
                  step="1"
                  defaultValue={editor.stock}
                />
              </label>
            </div>
            <label>
              Low-stock threshold
              <input
                aria-label="Low-stock threshold"
                name="threshold"
                required
                type="number"
                min="0"
                max="10000000"
                step="1"
                defaultValue={editor.threshold}
              />
              <span className="bb-form-help">
                We’ll flag this product when stock reaches this number.
              </span>
            </label>
            <label>
              Description
              <textarea
                name="description"
                defaultValue={editor.description}
                maxLength={2000}
                placeholder="Material, dimensions, or useful product details."
              />
            </label>
            <div className="bb-form-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setEditor(null)}
              >
                Cancel
              </Button>
              <Button busy={busy}>Save product</Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

export function InvoicesPage() {
  const { data, inbox, busy, error, action } = useBusiness();
  const [tab, setTab] = useState("Invoices"),
    [filter, setFilter] = useState("All invoices"),
    [query, setQuery] = useState(""),
    [create, setCreate] = useState(false),
    [selected, setSelected] = useState(null),
    [payment, setPayment] = useState(null),
    [draftEdits, setDraftEdits] = useState({});
  const unpaid = data.invoices.filter((i) => i.status !== "paid");
  const overdue = unpaid.filter((i) => i.due < today());
  const rows = data.invoices.filter(
    (i) =>
      (filter === "All invoices" ||
        (filter === "Paid"
          ? i.status === "paid"
          : filter === "Unpaid"
            ? i.status !== "paid"
            : i.status !== "paid" && i.due < today())) &&
      [i.customer, i.id, i.email].some((v) =>
        v.toLowerCase().includes(query.toLowerCase()),
      ),
  );
  const pending = data.drafts.filter((d) =>
    ["awaiting_approval", "email_ready"].includes(d.status),
  );
  const gmail = inbox.channels.some(
    (c) => c.channel === "email" && c.status === "connected",
  );
  async function createInvoice(event) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    await action(async () => {
      await request("/operations/invoices", {
        customer: f.get("customer"),
        email: f.get("email"),
        amount: Math.round(Number(f.get("amount")) * 100),
        due: f.get("due"),
        conversation_id: f.get("conversation_id"),
        confirmed: f.get("confirmed") === "on",
      });
      setCreate(false);
    }, "Invoice created. Your email draft is ready to review.");
  }
  async function download(draft) {
    await action(async () => {
      const response = await fetch(`/api/operations/drafts/${draft.id}/email`, {
        headers: {
          Authorization: `Bearer ${sessionStorage.getItem("bizbuddyToken")}`,
        },
      });
      if (!response.ok)
        throw new Error("We couldn’t download this draft. Please try again.");
      const url = URL.createObjectURL(await response.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `bizbuddy-${draft.id.slice(0, 8)}.eml`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, "Email draft downloaded. Open it in your email app to send.");
  }
  return (
    <>
      <PageHeader
        title="Invoices & reminders"
        description="Keep track of what’s owed, and follow up with a little less effort."
      >
        <Button icon="plus" onClick={() => setCreate(true)}>
          Create invoice
        </Button>
      </PageHeader>
      <div className="bb-stats bb-stats-three">
        {[
          [
            "Outstanding",
            money(unpaid.reduce((n, i) => n + i.amount, 0)),
            "invoice",
          ],
          [
            "Overdue",
            money(overdue.reduce((n, i) => n + i.amount, 0)),
            "clock",
          ],
          ["Drafts to review", pending.length, "mail"],
        ].map(([label, value, icon]) => (
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
      <div
        className="bb-page-tabs"
        role="tablist"
        aria-label="Invoice workspace"
      >
        <button
          role="tab"
          aria-selected={tab === "Invoices"}
          onClick={() => setTab("Invoices")}
        >
          Invoices <span>{data.invoices.length}</span>
        </button>
        <button
          role="tab"
          aria-selected={tab === "Drafts"}
          onClick={() => setTab("Drafts")}
        >
          Drafts & reminders <span>{pending.length}</span>
        </button>
      </div>
      {tab === "Invoices" ? (
        <section className="bb-panel">
          <div className="bb-table-toolbar">
            <div className="bb-tabs" aria-label="Filter invoices">
              {["All invoices", "Unpaid", "Overdue", "Paid"].map((label) => (
                <button
                  className={filter === label ? "is-active" : ""}
                  aria-pressed={filter === label}
                  onClick={() => setFilter(label)}
                  key={label}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="bb-search-field">
              <Icon name="search" size={18} />
              <input
                aria-label="Search invoices"
                placeholder="Search invoices…"
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
                    <th>Invoice / customer</th>
                    <th>Amount</th>
                    <th>Due date</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((i) => (
                    <tr key={i.id}>
                      <td>
                        <strong>{i.customer}</strong>
                        <small>INV-{i.id.slice(0, 8).toUpperCase()}</small>
                      </td>
                      <td className="bb-number">{money(i.amount)}</td>
                      <td>{dateLabel(i.due)}</td>
                      <td>
                        <Status
                          tone={
                            i.status === "paid"
                              ? "success"
                              : !i.confirmed
                                ? "neutral"
                                : i.due < today()
                                  ? "danger"
                                  : "warning"
                          }
                        >
                          {i.status === "paid"
                            ? "Paid"
                            : !i.confirmed
                              ? "Unconfirmed"
                              : i.due < today()
                                ? "Overdue"
                                : "Unpaid"}
                        </Status>
                      </td>
                      <td>
                        <Button variant="ghost" onClick={() => setSelected(i)}>
                          View
                        </Button>
                        {i.status !== "paid" && (
                          <Button variant="ghost" onClick={() => setPayment(i)}>
                            Mark paid
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon="invoice"
              title={
                data.invoices.length
                  ? "No invoices in this view."
                  : "A simpler way to stay on top of payments."
              }
              description={
                data.invoices.length
                  ? "Try another filter or customer name."
                  : "Create an invoice, review the email draft, and keep the payment status up to date."
              }
              action={
                !data.invoices.length && (
                  <Button icon="plus" onClick={() => setCreate(true)}>
                    Create your first invoice
                  </Button>
                )
              }
            />
          )}
          <div className="bb-table-note">
            <span>{rows.length} invoices</span>
            <span>Payments are recorded manually. No money is moved here.</span>
          </div>
        </section>
      ) : (
        <section className="bb-panel">
          <div className="bb-panel-heading">
            <div>
              <h2>Your review queue</h2>
              <p>
                Every message waits for your approval. Paid invoices won’t
                receive new reminders.
              </p>
            </div>
          </div>
          {data.drafts.length ? (
            <div className="bb-draft-list">
              {data.drafts.map((d) => (
                <article className="bb-draft" key={d.id}>
                  <div className="bb-draft-heading">
                    <div>
                      <Icon name="mail" size={20} />
                      <span>
                        <h3>{d.subject}</h3>
                        <small>
                          {d.recipient
                            ? `To: ${d.recipient}`
                            : d.conversation_id
                              ? "Original customer conversation"
                              : "No email address added"}
                        </small>
                      </span>
                    </div>
                    <Status
                      tone={
                        d.status === "sent"
                          ? "success"
                          : d.status === "awaiting_approval"
                            ? "warning"
                            : d.status === "delivery_unknown"
                              ? "danger"
                              : "neutral"
                      }
                    >
                      {d.status.replaceAll("_", " ")}
                    </Status>
                  </div>
                  <label className="bb-field">
                    Message
                    <textarea
                      aria-label={"Message for " + d.subject}
                      value={draftEdits[d.id] ?? d.content}
                      disabled={d.status !== "awaiting_approval"}
                      onChange={(e) =>
                        setDraftEdits((current) => ({
                          ...current,
                          [d.id]: e.target.value,
                        }))
                      }
                    />
                  </label>
                  <div className="bb-draft-actions">
                    {d.status === "awaiting_approval" && (
                      <Button
                        busy={busy}
                        onClick={() =>
                          action(
                            () =>
                              request(`/operations/drafts/${d.id}/approve`, {
                                content: draftEdits[d.id] ?? d.content,
                              }),
                            d.conversation_id
                              ? "Message delivered to the original channel."
                              : "Reviewed email draft saved. Download it or send it through connected Gmail.",
                          )
                        }
                      >
                        {d.conversation_id
                          ? "Approve & send reply"
                          : "Save reviewed email draft"}
                      </Button>
                    )}
                    {!d.conversation_id && d.status !== "cancelled" && (
                      <Button
                        variant="secondary"
                        icon="download"
                        disabled={busy}
                        onClick={() => download(d)}
                      >
                        Download email draft
                      </Button>
                    )}
                    {!d.conversation_id &&
                      d.status === "email_ready" &&
                      gmail && (
                        <Button
                          busy={busy}
                          icon="send"
                          onClick={() =>
                            action(
                              () =>
                                request(
                                  `/operations/email/drafts/${d.id}/send`,
                                  {},
                                ),
                              "Email sent through Gmail.",
                            )
                          }
                        >
                          Send approved email with Gmail
                        </Button>
                      )}
                  </div>
                  {d.status === "delivery_unknown" && (
                    <p className="bb-form-help">
                      Delivery could not be confirmed. Check the original
                      channel before sending another message.
                    </p>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="mail"
              title="Your review queue is clear."
              description="Invoice emails and overdue reminders will appear here for you to approve."
            />
          )}
        </section>
      )}
      {create && (
        <Modal
          title="Create an invoice"
          description="Add the payment details. We’ll prepare the email for your review."
          onClose={() => setCreate(false)}
        >
          <form className="bb-form" onSubmit={createInvoice}>
            <InlineError>{error}</InlineError>
            <div className="bb-form-grid">
              <label>
                Customer
                <input name="customer" required maxLength={255} />
              </label>
              <label>
                Email (optional)
                <input name="email" type="email" maxLength={255} />
              </label>
              <label>
                Amount (NGN)
                <input
                  name="amount"
                  required
                  type="number"
                  min=".01"
                  step=".01"
                  max="1000000000"
                />
              </label>
              <label>
                Due date
                <input name="due" type="date" required defaultValue={today()} />
              </label>
            </div>
            <label>
              Reminder channel
              <select
                aria-label="Reminder channel"
                name="conversation_id"
                defaultValue=""
              >
                <option value="">Email draft only</option>
                {inbox.conversations
                  .filter((c) =>
                    ["website", "telegram", "email"].includes(c.channel),
                  )
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.customer_name || "Customer"} · {c.channel}
                    </option>
                  ))}
              </select>
            </label>
            <label className="bb-checkbox">
              <input type="checkbox" name="confirmed" />I verified the customer,
              amount and due date. This invoice is ready for reminders.
            </label>
            <div className="bb-form-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setCreate(false)}
              >
                Cancel
              </Button>
              <Button busy={busy}>Create invoice</Button>
            </div>
          </form>
        </Modal>
      )}
      {selected && (
        <Modal
          title="Invoice details"
          description={"INV-" + selected.id.slice(0, 8).toUpperCase()}
          onClose={() => setSelected(null)}
        >
          <dl className="bb-details">
            {[
              ["Customer", selected.customer],
              ["Email", selected.email || "Not added"],
              ["Amount", money(selected.amount)],
              ["Due date", dateLabel(selected.due)],
              [
                "Status",
                selected.status === "paid"
                  ? "Paid"
                  : selected.confirmed
                    ? "Confirmed, unpaid"
                    : "Awaiting confirmation",
              ],
            ].map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <InlineError>{error}</InlineError>
          {selected.status !== "paid" && (
            <div className="bb-form-actions">
              {!selected.confirmed && (
                <Button
                  variant="secondary"
                  busy={busy}
                  onClick={() =>
                    action(async () => {
                      const next = await request(
                        `/operations/invoices/${selected.id}/confirm`,
                        {},
                      );
                      setSelected(next);
                    }, "Invoice confirmed. Overdue reminders can now be prepared.")
                  }
                >
                  Confirm invoice
                </Button>
              )}
              <Button
                onClick={() => {
                  setSelected(null);
                  setPayment(selected);
                }}
              >
                Record payment
              </Button>
            </div>
          )}
        </Modal>
      )}
      {payment && (
        <Modal
          title="Record this payment?"
          description="You’re recording money already received outside BizBuddy. No payment will be charged."
          onClose={() => setPayment(null)}
        >
          <div className="bb-payment-summary">
            <span>{payment.customer}</span>
            <strong>{money(payment.amount)}</strong>
            <small>INV-{payment.id.slice(0, 8).toUpperCase()}</small>
          </div>
          <p className="bb-form-help">
            This marks the invoice paid and cancels pending reminders.
          </p>
          <div className="bb-form-actions">
            <Button variant="secondary" onClick={() => setPayment(null)}>
              Cancel
            </Button>
            <Button
              busy={busy}
              onClick={() =>
                action(async () => {
                  await request(`/operations/invoices/${payment.id}/paid`, {});
                  setPayment(null);
                }, "Payment recorded. Pending reminders were cancelled.")
              }
            >
              Record payment
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

export function CustomersPage() {
  const { data, inbox, busy, error, action, onNavigate } = useBusiness();
  const [query, setQuery] = useState(""),
    [selected, setSelected] = useState([]),
    [merge, setMerge] = useState(false),
    [customer, setCustomer] = useState(null);
  const groups = new Map();
  for (const c of data.customers) {
    const key = String(c.group_id);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }
  const rows = [...groups.values()].filter((group) =>
    group.some((c) =>
      [c.name, c.email, c.phone, c.external_id].some((v) =>
        String(v).toLowerCase().includes(query.toLowerCase()),
      ),
    ),
  );
  return (
    <>
      <PageHeader
        title="Customers"
        description="One place for the people behind your conversations."
      >
        {selected.length > 1 && (
          <Button icon="link" onClick={() => setMerge(true)}>
            Link {selected.length} customer records
          </Button>
        )}
      </PageHeader>
      <section className="bb-panel">
        <div className="bb-table-toolbar">
          <span className="bb-count-label">
            {groups.size} {groups.size === 1 ? "customer" : "customers"}
          </span>
          <div className="bb-search-field">
            <Icon name="search" size={18} />
            <input
              aria-label="Search customers"
              placeholder="Search name, email or phone…"
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
                  <th>
                    <span className="bb-sr-only">Select customer</span>
                  </th>
                  <th>Customer</th>
                  <th>Contact</th>
                  <th>Channels</th>
                  <th>Conversations</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((group) => {
                  const c = group[0];
                  const ids = group.map((c) => c.id);
                  const count = inbox.conversations.filter((v) =>
                    ids.includes(v.customer_id),
                  ).length;
                  return (
                    <tr key={c.id}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={
                            "Select " + (c.name || "customer " + c.id)
                          }
                          checked={ids.every((id) => selected.includes(id))}
                          onChange={(e) =>
                            setSelected((current) =>
                              e.target.checked
                                ? [...new Set([...current, ...ids])]
                                : current.filter((id) => !ids.includes(id)),
                            )
                          }
                        />
                      </td>
                      <td>
                        <div className="bb-person">
                          <span className="bb-avatar bb-avatar-soft">
                            {initials(c.name)}
                          </span>
                          <span>
                            <strong>{c.name || "Customer"}</strong>
                            <small>
                              {group.length > 1
                                ? `${group.length} linked records`
                                : "Single channel record"}
                            </small>
                          </span>
                        </div>
                      </td>
                      <td>
                        <strong>
                          {group.find((c) => c.email)?.email ||
                            "No email added"}
                        </strong>
                        <small>
                          {group.find((c) => c.phone)?.phone || c.external_id}
                        </small>
                      </td>
                      <td>
                        <div className="bb-channel-stack">
                          {[...new Set(group.map((c) => c.channel))].map(
                            (channel) => (
                              <Channel key={channel} name={channel} />
                            ),
                          )}
                        </div>
                      </td>
                      <td>{count}</td>
                      <td>
                        <Button
                          variant="ghost"
                          onClick={() => setCustomer(group)}
                        >
                          View profile
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon="users"
            title={
              data.customers.length
                ? "No customers found."
                : "Your customer relationships start here."
            }
            description={
              data.customers.length
                ? "Try another name, phone number or email address."
                : "Customers are added when a conversation comes in. Connect a channel to welcome your first one."
            }
            action={
              !data.customers.length && (
                <Button onClick={() => onNavigate("connections")}>
                  Connect your first channel
                </Button>
              )
            }
          />
        )}
        <div className="bb-panel-footer">
          <span>
            Select records to link the same person across channels. Only link
            identities you’ve verified.
          </span>
        </div>
      </section>
      {merge && (
        <Modal
          title="Link these customer records?"
          description="Confirm these identities belong to the same person. Their conversation history will be shown together."
          onClose={() => setMerge(false)}
        >
          <InlineError>{error}</InlineError>
          <div className="bb-link-preview">
            {data.customers
              .filter((c) => selected.includes(c.id))
              .map((c) => (
                <div key={c.id}>
                  <strong>{c.name || "Customer"}</strong>
                  <Channel name={c.channel} />
                </div>
              ))}
          </div>
          <div className="bb-form-actions">
            <Button variant="secondary" onClick={() => setMerge(false)}>
              Cancel
            </Button>
            <Button
              busy={busy}
              onClick={() =>
                action(async () => {
                  await request("/operations/customers/link", {
                    customer_ids: selected,
                  });
                  setMerge(false);
                  setSelected([]);
                }, "Customer records linked. You can now see their history together.")
              }
            >
              Confirm & link records
            </Button>
          </div>
        </Modal>
      )}
      {customer && (
        <Modal
          title={customer[0].name || "Customer profile"}
          description="Verified channel identities in your business workspace."
          onClose={() => setCustomer(null)}
        >
          {customer.map((c) => (
            <section className="bb-customer-identity" key={c.id}>
              <Channel name={c.channel} />
              <dl className="bb-details">
                <div>
                  <dt>Name</dt>
                  <dd>{c.name || "Not provided"}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>{c.email || "Not provided"}</dd>
                </div>
                <div>
                  <dt>Phone / channel ID</dt>
                  <dd>{c.phone || c.external_id}</dd>
                </div>
              </dl>
            </section>
          ))}
          <Button variant="secondary" onClick={() => onNavigate("inbox")}>
            Open unified inbox <Icon name="arrow" size={17} />
          </Button>
        </Modal>
      )}
    </>
  );
}
