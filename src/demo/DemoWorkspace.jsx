import { useEffect, useRef, useState } from "react";
import {
  Brand,
  Button,
  Channel,
  EmptyState,
  Icon,
  Modal,
  PageHeader,
  Status,
} from "../components/ui";
import { money } from "../components/format";
import { useViewportHeight } from "../components/useViewportHeight";
import {
  startingConversations,
  startingInvoices,
  startingPayments,
} from "./upstreamExamples";
import { createDemoAnswer } from "./demoLogic";
import "./DemoWorkspace.css";

const storageKey = "bizbuddy-messaging-demo-v1";
function freshDemo() {
  return {
    conversations: structuredClone(startingConversations),
    invoices: structuredClone(startingInvoices),
    requests: [
      {
        id: "sample-adaeze-order",
        customer: "Adaeze Okafor",
        conversationId: "adaeze",
        product: "Blue ankara",
        quantity: 6,
        unitPrice: 800000,
        status: "needs_confirmation",
      },
    ],
    stock: 30,
  };
}
function initialDemo() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey) || "null");
    if (
      saved &&
      Array.isArray(saved.conversations) &&
      saved.conversations.length === 4 &&
      saved.conversations.every(
        (c) => Array.isArray(c.messages) && typeof c.id === "string",
      ) &&
      Array.isArray(saved.invoices) &&
      Array.isArray(saved.requests) &&
      Number.isFinite(saved.stock)
    )
      return saved;
  } catch {
    /* Start fresh when a stored example is invalid. */
  }
  return freshDemo();
}
const samplePrompts = [
  ["Ask the price", "How much is blue ankara fabric?"],
  ["Place an order", "Can I order 6 yards of blue ankara?"],
  ["Delivery details", "Do you deliver to Ikeja?"],
];

export default function DemoWorkspace({
  embedded = false,
  onNavigate,
  onExit,
}) {
  const [demo, setDemo] = useState(initialDemo),
    [tab, setTab] = useState("Messages"),
    [selected, setSelected] = useState("adaeze"),
    [text, setText] = useState(""),
    [actor, setActor] = useState("customer"),
    [typing, setTyping] = useState(""),
    [query, setQuery] = useState(""),
    [mobileThread, setMobileThread] = useState(true),
    [notice, setNotice] = useState(""),
    [invoiceForm, setInvoiceForm] = useState(false),
    [reminder, setReminder] = useState(null),
    [reviewOrder, setReviewOrder] = useState(null),
    [newMessages, setNewMessages] = useState(false),
    [assistantActive, setAssistantActive] = useState(true);
  const height = useViewportHeight();
  const timer = useRef(null),
    list = useRef(null),
    shouldFollow = useRef(true),
    options = useRef(null);
  const selectedConversation =
    demo.conversations.find((c) => c.id === selected) || demo.conversations[0];
  const requests = demo.requests.filter(
    (o) => o.status === "needs_confirmation",
  );
  const currentRequest = requests.find((o) => o.conversationId === selected);
  const paid = demo.invoices
      .filter((i) => i.status === "Paid")
      .reduce((sum, i) => sum + i.amount, 0),
    outstanding = demo.invoices
      .filter((i) => i.status !== "Paid")
      .reduce((sum, i) => sum + i.amount, 0);
  const visibleConversations = demo.conversations.filter((c) =>
    [c.name, c.preview, c.channel].some((v) =>
      v.toLowerCase().includes(query.toLowerCase()),
    ),
  );
  useEffect(() => {
    try {
      const bounded = {
        ...demo,
        conversations: demo.conversations.map((c) => ({
          ...c,
          messages: c.messages.slice(-50),
        })),
        invoices: demo.invoices.slice(0, 30),
        requests: demo.requests.slice(-30),
      };
      sessionStorage.setItem(storageKey, JSON.stringify(bounded));
    } catch {
      /* A demo still works when browser storage is unavailable. */
    }
  }, [demo]);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(timeout);
  }, [notice]);
  useEffect(() => {
    const panel = list.current;
    if (panel && shouldFollow.current) {
      panel.scrollTop = panel.scrollHeight;
    }
  }, [
    selected,
    selectedConversation.messages.length,
    typing,
    tab,
    mobileThread,
  ]);
  function updateConversation(state, id, fn) {
    return {
      ...state,
      conversations: state.conversations.map((c) => (c.id === id ? fn(c) : c)),
    };
  }
  function reset() {
    clearTimeout(timer.current);
    setDemo(freshDemo());
    setSelected("adaeze");
    setText("");
    setTyping("");
    setActor("customer");
    setAssistantActive(true);
    setTab("Messages");
    setNotice("Example workspace reset. Real records were not changed.");
    shouldFollow.current = true;
  }
  function choose(id) {
    setSelected(id);
    setMobileThread(true);
    setText("");
    setNewMessages(false);
    shouldFollow.current = true;
  }
  function appendMessage(id, sender, content) {
    setDemo((state) =>
      updateConversation(state, id, (c) => ({
        ...c,
        preview: content,
        time: "Just now",
        messages: [
          ...c.messages,
          { id: crypto.randomUUID(), sender, text: content, time: "Just now" },
        ],
      })),
    );
  }
  function sendMessage(content = text, role = actor) {
    if (!content.trim() || typing) return;
    const id = selected;
    shouldFollow.current = true;
    setNewMessages(false);
    appendMessage(id, role, content.trim());
    setText("");
    if (role === "owner") {
      setDemo((state) =>
        updateConversation(state, id, (c) => ({ ...c, status: "Open" })),
      );
      setNotice("Demo owner reply added. No customer was contacted.");
      return;
    }
    if (!assistantActive) {
      setDemo((state) =>
        updateConversation(state, id, (c) => ({ ...c, status: "Needs reply" })),
      );
      setNotice(
        "Demo assistant paused. Use the conversation menu to resume it or write an owner reply.",
      );
      return;
    }
    const answer = createDemoAnswer(content);
    setTyping(id);
    timer.current = setTimeout(() => {
      setDemo((state) => {
        let next = updateConversation(state, id, (c) => ({
          ...c,
          preview: answer.text,
          time: "Just now",
          status: answer.needsOwner ? "Needs reply" : "Open",
          messages: [
            ...c.messages,
            {
              id: crypto.randomUUID(),
              sender: "assistant",
              text: answer.text,
              time: "Just now",
            },
          ],
        }));
        if (answer.order) {
          const name =
            state.conversations.find((c) => c.id === id)?.name || "Customer";
          next = {
            ...next,
            requests: [
              ...next.requests.filter(
                (o) =>
                  !(
                    o.conversationId === id && o.status === "needs_confirmation"
                  ),
              ),
              {
                id: crypto.randomUUID(),
                customer: name,
                conversationId: id,
                ...answer.order,
                status: "needs_confirmation",
              },
            ],
          };
        }
        return next;
      });
      setTyping("");
      if (!shouldFollow.current) setNewMessages(true);
    }, 550);
  }
  function confirmOrder() {
    if (!reviewOrder) return;
    if (reviewOrder.quantity > demo.stock) {
      setNotice(
        "The example stock is too low for this quantity. Try a smaller order request.",
      );
      return;
    }
    setDemo((state) => ({
      ...state,
      stock: state.stock - reviewOrder.quantity,
      requests: state.requests.map((o) =>
        o.id === reviewOrder.id ? { ...o, status: "confirmed" } : o,
      ),
    }));
    setDemo((state) =>
      updateConversation(state, reviewOrder.conversationId, (c) => ({
        ...c,
        status: "Open",
      })),
    );
    appendMessage(
      reviewOrder.conversationId,
      "owner",
      `Your example order is confirmed: ${reviewOrder.quantity} yards of ${reviewOrder.product}, total ${money(reviewOrder.quantity * reviewOrder.unitPrice)}. We’ll agree delivery details separately.`,
    );
    setReviewOrder(null);
    setNotice("Example order confirmed and sample stock updated.");
  }
  function prepareReminder(invoice) {
    setReminder({
      invoice,
      content: `Hello ${invoice.customer}, a friendly reminder about invoice ${invoice.id} for ${money(invoice.amount * 100)}. Please let us know if you have already paid or need help. Thank you.`,
    });
  }
  function sendReminder(event) {
    event.preventDefault();
    const content = new FormData(event.currentTarget).get("content");
    const customer = demo.conversations.find(
      (c) => c.name === reminder.invoice.customer,
    );
    if (customer) {
      appendMessage(customer.id, "owner", content);
      choose(customer.id);
    }
    setDemo((state) => ({
      ...state,
      invoices: state.invoices.map((i) =>
        i.id === reminder.invoice.id ? { ...i, reminded: true } : i,
      ),
    }));
    setReminder(null);
    setTab("Messages");
    setNotice(
      "Demo reminder added to the sample conversation. Nothing was sent externally.",
    );
  }
  const content = (
    <div
      className={`bb-demo ${embedded ? "bb-demo-embedded" : ""}`}
      style={{ "--bb-chat-vh": `${height}px` }}
    >
      <div className="bb-demo-banner">
        <span>
          <Icon name="shield" size={16} />
          <strong>Demo workspace</strong>
          <span>Nothing is sent. All records are examples.</span>
        </span>
        {embedded ? (
          <Button
            variant="ghost"
            onClick={onExit || (() => onNavigate?.("inbox"))}
          >
            Your real inbox <Icon name="arrow" size={15} />
          </Button>
        ) : (
          <button onClick={reset}>Reset demo</button>
        )}
      </div>
      <div className="bb-demo-heading">
        <PageHeader
          title="One inbox. Your whole business."
          description="Explore the original BizBuddy conversations. Try a customer question and see what happens next."
        >
          <Button variant="secondary" icon="refresh" onClick={reset}>
            Reset example
          </Button>
        </PageHeader>
      </div>
      <div className="bb-stats bb-demo-stats">
        {[
          ["Sample conversations", demo.conversations.length, "message"],
          [
            "Demo assistant replies",
            demo.conversations.reduce(
              (sum, c) =>
                sum + c.messages.filter((m) => m.sender === "assistant").length,
              0,
            ),
            "sparkle",
          ],
          ["Sample outstanding", money(outstanding * 100), "invoice"],
          ["Requests to confirm", requests.length, "box"],
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
        className="bb-page-tabs bb-demo-tabs"
        role="tablist"
        aria-label="Demo workspace sections"
      >
        {["Messages", "Invoices", "Daily summary"].map((label) => (
          <button
            role="tab"
            key={label}
            aria-selected={tab === label}
            onClick={() => setTab(label)}
          >
            <Icon
              name={
                label === "Messages"
                  ? "message"
                  : label === "Invoices"
                    ? "invoice"
                    : "calendar"
              }
              size={17}
            />
            {label}
          </button>
        ))}
      </div>
      {tab === "Messages" ? (
        <section
          className={`bb-panel bb-inbox bb-demo-inbox ${mobileThread ? "show-thread" : ""}`}
        >
          <aside className="bb-inbox-list">
            <div className="bb-inbox-controls">
              <div>
                <h2>Example conversations</h2>
                <span>4 customers, one simple inbox.</span>
              </div>
              <div className="bb-search-field">
                <Icon name="search" size={17} />
                <input
                  aria-label="Search demo conversations"
                  placeholder="Search examples…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="bb-conversation-list">
              {visibleConversations.map((c) => (
                <button
                  className={`bb-conversation ${selected === c.id ? "is-selected" : ""}`}
                  key={c.id}
                  onClick={() => choose(c.id)}
                >
                  <span className="bb-avatar bb-avatar-soft">{c.initials}</span>
                  <span className="bb-conversation-preview">
                    <span>
                      <strong>{c.name}</strong>
                      <small>{c.time}</small>
                    </span>
                    <p>{c.preview}</p>
                    <span>
                      <Channel name={c.channel} />
                      {c.status === "Needs reply" && (
                        <i
                          className="bb-attention-dot"
                          aria-label="Needs owner review"
                        />
                      )}
                    </span>
                  </span>
                </button>
              ))}
              {!visibleConversations.length && (
                <EmptyState
                  icon="search"
                  title="No matching example."
                  description="Try Adaeze, Chidi, Amara or Tolu."
                />
              )}
            </div>
            <footer>
              <Icon name="shield" size={13} /> Simulated channels. No accounts
              connected.
            </footer>
          </aside>
          <article className="bb-inbox-thread bb-demo-thread">
            <header className="bb-demo-thread-heading">
              <button
                className="bb-demo-back"
                aria-label="Back to example conversations"
                onClick={() => setMobileThread(false)}
              >
                <Icon name="back" size={21} />
              </button>
              <span className="bb-avatar">{selectedConversation.initials}</span>
              <div>
                <h2>{selectedConversation.name}</h2>
                <Channel name={selectedConversation.channel} />
                <small>Sample conversation</small>
              </div>
              <details className="bb-demo-options" ref={options}>
                <summary aria-label="Conversation options">
                  <Icon name="menu" size={20} />
                </summary>
                <div>
                  {[
                    ["customer", "Try a customer message"],
                    ["owner", "Write an owner reply"],
                  ].map(([role, label]) => (
                    <button
                      key={role}
                      onClick={() => {
                        setActor(role);
                        options.current.open = false;
                      }}
                    >
                      <Icon
                        name={role === "customer" ? "users" : "edit"}
                        size={16}
                      />
                      {label}
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      setActor("owner");
                      setText(
                        "Absolutely! Please confirm the items and quantities you would like included.",
                      );
                      options.current.open = false;
                    }}
                  >
                    <Icon name="sparkle" size={16} />
                    Draft a demo owner reply
                  </button>
                  <button
                    onClick={() => {
                      if (typing) {
                        clearTimeout(timer.current);
                        setTyping("");
                      }
                      setAssistantActive((current) => !current);
                      options.current.open = false;
                      setNotice(
                        assistantActive
                          ? "Demo assistant paused. You can reply as the owner."
                          : "Demo assistant resumed.",
                      );
                    }}
                  >
                    <Icon name="sparkle" size={16} />
                    {assistantActive
                      ? "Pause demo assistant"
                      : "Resume demo assistant"}
                  </button>
                  <button
                    onClick={() => {
                      sendMessage(
                        "Could you also send me an invoice for this order?",
                        "customer",
                      );
                      options.current.open = false;
                    }}
                  >
                    <Icon name="plus" size={16} />
                    Simulate incoming message
                  </button>
                  <button
                    onClick={() => {
                      reset();
                      options.current.open = false;
                    }}
                  >
                    <Icon name="refresh" size={16} />
                    Reset example
                  </button>
                </div>
              </details>
            </header>
            <div
              className="bb-thread-messages bb-demo-messages"
              ref={list}
              role="log"
              aria-label="Sample customer and assistant messages"
              aria-live="polite"
              aria-relevant="additions"
              onScroll={(event) => {
                const el = event.currentTarget;
                shouldFollow.current =
                  el.scrollHeight - el.scrollTop - el.clientHeight < 70;
                if (shouldFollow.current) setNewMessages(false);
              }}
            >
              <div className="bb-demo-date">Example conversation</div>
              {selectedConversation.messages.map((m) => (
                <article
                  key={m.id}
                  className={`bb-bubble bb-demo-bubble ${m.sender === "customer" ? "" : "bb-bubble-assistant"}`}
                >
                  <small>
                    <strong>
                      {m.sender === "customer"
                        ? selectedConversation.name.split(" ")[0]
                        : m.sender === "owner"
                          ? "You · Demo"
                          : "BizBuddy assistant · Demo"}
                    </strong>
                    <span>{m.time}</span>
                  </small>
                  <p>{m.text}</p>
                </article>
              ))}
              {typing === selected && (
                <div className="bb-demo-typing" role="status">
                  <span>
                    <i />
                    <i />
                    <i />
                  </span>
                  Drafting a simulated reply…
                </div>
              )}
              {currentRequest && (
                <button
                  className="bb-demo-handoff"
                  onClick={() => setReviewOrder(currentRequest)}
                >
                  <Icon name="shield" size={22} />
                  <span>
                    <strong>Needs owner confirmation</strong>
                    <small>
                      {currentRequest.quantity} yards ·{" "}
                      {money(
                        currentRequest.quantity * currentRequest.unitPrice,
                      )}{" "}
                      · Review example order
                    </small>
                  </span>
                  <Icon name="arrow" size={16} />
                </button>
              )}
            </div>
            {newMessages && (
              <button
                className="bb-new-messages"
                onClick={() => {
                  list.current.scrollTop = list.current.scrollHeight;
                  shouldFollow.current = true;
                  setNewMessages(false);
                }}
              >
                New reply <Icon name="chevron" size={15} />
              </button>
            )}
            <div
              className="bb-demo-prompts"
              aria-label="Suggested customer messages"
            >
              {samplePrompts.map(([label, prompt]) => (
                <button
                  key={label}
                  disabled={Boolean(typing)}
                  onClick={() => sendMessage(prompt, "customer")}
                >
                  {label}
                </button>
              ))}
            </div>
            <form
              className="bb-demo-composer"
              onSubmit={(event) => {
                event.preventDefault();
                sendMessage();
              }}
            >
              <label className="bb-sr-only" htmlFor="demo-message">
                {actor === "customer"
                  ? "Try a customer message"
                  : "Write a demo owner reply"}
              </label>
              {actor === "owner" && (
                <div className="bb-demo-actor">
                  Replying as the owner{" "}
                  <button type="button" onClick={() => setActor("customer")}>
                    Switch to customer
                  </button>
                </div>
              )}
              <div>
                <textarea
                  id="demo-message"
                  rows={1}
                  required
                  maxLength={1000}
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  placeholder={
                    actor === "customer"
                      ? "Try a customer message…"
                      : "Write a demo owner reply…"
                  }
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      !event.shiftKey &&
                      !event.nativeEvent.isComposing
                    ) {
                      event.preventDefault();
                      event.currentTarget.form.requestSubmit();
                    }
                  }}
                />
                <Button
                  aria-label="Send demo message"
                  icon="send"
                  busy={Boolean(typing)}
                  disabled={!text.trim()}
                />
              </div>
              <p>Simulated replies. No customer is contacted.</p>
            </form>
          </article>
        </section>
      ) : tab === "Invoices" ? (
        <div className="bb-demo-commerce">
          <section className="bb-panel">
            <div className="bb-panel-heading">
              <div>
                <h2>Example invoices</h2>
                <p>
                  Create a sample invoice, prepare a reminder, or mark an
                  example paid.
                </p>
              </div>
              <Button icon="plus" onClick={() => setInvoiceForm(true)}>
                Create demo invoice
              </Button>
            </div>
            <div className="bb-table-scroll">
              <table className="bb-table">
                <thead>
                  <tr>
                    <th>Invoice / customer</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {demo.invoices.map((i) => (
                    <tr key={i.id}>
                      <td>
                        <strong>{i.customer}</strong>
                        <small>
                          {i.id} · {i.description}
                        </small>
                      </td>
                      <td className="bb-number">{money(i.amount * 100)}</td>
                      <td>
                        <Status
                          tone={
                            i.status === "Paid"
                              ? "success"
                              : i.status === "Overdue"
                                ? "danger"
                                : "warning"
                          }
                        >
                          {i.status}
                        </Status>
                        {i.reminded && <small>Demo reminder prepared</small>}
                      </td>
                      <td>
                        {i.status !== "Paid" ? (
                          <>
                            <Button
                              variant="ghost"
                              onClick={() => prepareReminder(i)}
                            >
                              Prepare reminder
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={() => {
                                setDemo((state) => ({
                                  ...state,
                                  invoices: state.invoices.map((row) =>
                                    row.id === i.id
                                      ? { ...row, status: "Paid" }
                                      : row,
                                  ),
                                }));
                                setNotice(
                                  "Example invoice marked paid. No payment was processed.",
                                );
                              }}
                            >
                              Mark example paid
                            </Button>
                          </>
                        ) : (
                          <span className="bb-form-help">
                            Example payment recorded
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="bb-panel">
            <div className="bb-panel-heading">
              <div>
                <h2>Example payment activity</h2>
                <p>Original sample records, not a live payment feed.</p>
              </div>
            </div>
            <div className="bb-demo-payments">
              {startingPayments.map((p) => (
                <div key={p.id}>
                  <span className="bb-channel-symbol">
                    <Icon name="circleCheck" size={19} />
                  </span>
                  <span>
                    <strong>{p.customer}</strong>
                    <small>{p.method} · Sample transaction</small>
                  </span>
                  <strong>{money(p.amount * 100)}</strong>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : (
        <section className="bb-panel bb-demo-summary">
          <div className="bb-panel-heading">
            <div>
              <h2>Your example daily summary</h2>
              <p>
                A preview of the daily briefing described in the project plan.
              </p>
            </div>
            <Status tone="info">Sample day</Status>
          </div>
          <div className="bb-demo-summary-content">
            <p>Hello Ada, here’s your business at a glance.</p>
            <ul>
              <li>
                <strong>
                  {demo.requests.filter((o) => o.status === "confirmed").length}{" "}
                  confirmed example orders
                </strong>
                <span>{requests.length} order requests still need review.</span>
              </li>
              <li>
                <strong>{money(outstanding * 100)} outstanding</strong>
                <span>
                  {demo.invoices.filter((i) => i.status !== "Paid").length}{" "}
                  sample invoices to follow up.
                </span>
              </li>
              <li>
                <strong>{money(paid * 100)} in paid example invoices</strong>
                <span>
                  Statuses change as you try the demo. No real payments are
                  processed.
                </span>
              </li>
              <li>
                <strong>Blue ankara: {demo.stock} sample yards</strong>
                <span>
                  Confirming a sample order adjusts this example stock.
                </span>
              </li>
            </ul>
            <div className="bb-note">
              <Icon name="shield" size={19} />
              <span>
                In your real workspace, daily summaries use your own saved
                records and delivery preferences.
              </span>
            </div>
          </div>
        </section>
      )}
      {notice && (
        <div className="bb-toast" role="status">
          <Icon name="circleCheck" size={20} />
          <span>{notice}</span>
          <button
            aria-label="Dismiss demo notification"
            onClick={() => setNotice("")}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      )}
      {reviewOrder && (
        <Modal
          title="Review the example order"
          description="This updates demonstration data only. Real orders require your verification."
          onClose={() => setReviewOrder(null)}
        >
          <dl className="bb-details">
            <div>
              <dt>Customer</dt>
              <dd>{reviewOrder.customer}</dd>
            </div>
            <div>
              <dt>Product</dt>
              <dd>{reviewOrder.product}</dd>
            </div>
            <div>
              <dt>Quantity</dt>
              <dd>{reviewOrder.quantity} yards</dd>
            </div>
            <div>
              <dt>Example total</dt>
              <dd>{money(reviewOrder.quantity * reviewOrder.unitPrice)}</dd>
            </div>
            <div>
              <dt>Sample stock available</dt>
              <dd>{demo.stock} yards</dd>
            </div>
          </dl>
          <div className="bb-form-actions">
            <Button variant="secondary" onClick={() => setReviewOrder(null)}>
              Cancel
            </Button>
            <Button onClick={confirmOrder}>Confirm example order</Button>
          </div>
        </Modal>
      )}
      {invoiceForm && (
        <Modal
          title="Create a demo invoice"
          description="A sample invoice stays in this demonstration workspace."
          onClose={() => setInvoiceForm(false)}
        >
          <form
            className="bb-form"
            onSubmit={(event) => {
              event.preventDefault();
              const f = Object.fromEntries(new FormData(event.currentTarget));
              const n = 2050 + demo.invoices.length;
              setDemo((state) => ({
                ...state,
                invoices: [
                  {
                    id: `INV-${n}`,
                    customer: f.customer,
                    description: f.description,
                    amount: Number(f.amount),
                    status: "Awaiting payment",
                    date: "Example day",
                  },
                  ...state.invoices,
                ],
              }));
              setInvoiceForm(false);
              setNotice("Demo invoice created. Nothing was sent.");
            }}
          >
            <label>
              Customer
              <select
                aria-label="Demo invoice customer"
                name="customer"
                defaultValue={selectedConversation.name}
              >
                {demo.conversations.map((c) => (
                  <option key={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <label>
              Item or service
              <input
                name="description"
                required
                maxLength={120}
                placeholder="e.g. Blue ankara · 6 yards"
              />
            </label>
            <label>
              Amount (NGN)
              <input
                name="amount"
                required
                type="number"
                min=".01"
                max="10000000"
                step=".01"
              />
            </label>
            <div className="bb-form-actions">
              <Button
                variant="secondary"
                type="button"
                onClick={() => setInvoiceForm(false)}
              >
                Cancel
              </Button>
              <Button>Create example invoice</Button>
            </div>
          </form>
        </Modal>
      )}
      {reminder && (
        <Modal
          title="Review the example reminder"
          description="Your approval comes first. This only adds a message to the sample conversation."
          onClose={() => setReminder(null)}
        >
          <form className="bb-form" onSubmit={sendReminder}>
            <label>
              Reminder message
              <textarea
                name="content"
                required
                maxLength={2000}
                defaultValue={reminder.content}
              />
            </label>
            <div className="bb-form-actions">
              <Button
                variant="secondary"
                type="button"
                onClick={() => setReminder(null)}
              >
                Cancel
              </Button>
              <Button>Approve demo reminder</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
  return embedded ? (
    content
  ) : (
    <div
      className="bb bb-demo-public"
      style={{ "--bb-chat-vh": `${height}px` }}
    >
      <header className="bb-demo-site-header">
        <a
          href="/"
          onClick={(event) => {
            event.preventDefault();
            onNavigate?.("/");
          }}
        >
          <Brand />
        </a>
        <div>
          <Button variant="secondary" onClick={() => onNavigate?.("/signin")}>
            Sign in
          </Button>
          <Button onClick={() => onNavigate?.("/register")}>
            Create your workspace
          </Button>
        </div>
      </header>
      <main>{content}</main>
    </div>
  );
}
