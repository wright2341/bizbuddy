import { useEffect, useRef, useState } from "react";
import DemoWorkspace from "../demo/DemoWorkspace";
import { useViewportHeight } from "../components/useViewportHeight";
import { useBusiness } from "../businessContext";
import { request } from "../operationsApi";
import {
  Button,
  Channel,
  EmptyState,
  Icon,
  InlineError,
  PageHeader,
  Status,
} from "../components/ui";
import { initials, money, timeLabel } from "../components/format";

function OrderRequestForm({ orderRequest }) {
  const { data, busy, action } = useBusiness();
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const product = data.products.find((item) => item.id === productId);
  const captured = orderRequest.captured_products || [];
  const original = captured.find((item) => item.id === productId);
  const reviewRequired =
    product && (!original || original.version !== product.version);
  return (
    <>
      <div className="bb-request-original">
        <strong>Original request details</strong>
        {captured.length ? (
          captured.map((item) => (
            <p key={item.id}>
              {item.name} · {money(item.price)} per unit
              {item.description ? ` · ${item.description}` : ""}
            </p>
          ))
        ) : (
          <p>
            No original catalogue match was captured. Review the customer's
            request and agree the item and price before confirming.
          </p>
        )}
      </div>
      <form
        className="bb-request-form"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          action(async () => {
            const result = await request(
              `/operations/order-requests/${orderRequest.id}/confirm`,
              {
                product_id: productId,
                quantity: Number(quantity),
                expected_version: product?.version || "",
                reviewed_changes: form.get("reviewed_changes") === "on",
              },
            );
            if (result.notification_failed)
              throw new Error(
                "Order saved and stock updated, but the customer notification failed. Reply manually; do not confirm again.",
              );
          }, "Order confirmed, stock updated and customer notified.");
        }}
      >
        <label className="bb-field">
          Confirm product
          <select
            aria-label="Confirm product"
            required
            name="product_id"
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
          >
            <option value="" disabled>
              Select a product
            </option>
            {data.products.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {money(item.price)} · {item.stock} in stock
              </option>
            ))}
          </select>
        </label>
        <label className="bb-field">
          Quantity
          <input
            name="quantity"
            type="number"
            min="1"
            max="1000000"
            required
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
        </label>
        {reviewRequired && (
          <div className="bb-request-review" key={product.version}>
            <p>
              <strong>
                {original
                  ? "Catalogue changed since this request."
                  : "Review this product selection."}
              </strong>{" "}
              {original
                ? "The current item or price differs from the saved request details."
                : "This product was not matched to the original customer request."}
            </p>
            <label>
              <input type="checkbox" name="reviewed_changes" required />
              <span>
                I have reviewed the current item and price with the customer.
              </span>
            </label>
          </div>
        )}
        {product && (
          <p className="bb-request-total" aria-live="polite">
            Confirmation total:{" "}
            <strong>{money(product.price * (Number(quantity) || 0))}</strong>
          </p>
        )}
        <Button busy={busy}>Confirm order &amp; adjust stock</Button>
      </form>
    </>
  );
}

function ConversationThread({ conversation, thread, requests }) {
  const { busy, error, action } = useBusiness();
  const [reply, setReply] = useState("");
  const end = useRef(null);
  const [following, setFollowing] = useState(true);
  useEffect(() => {
    const list = end.current?.parentElement;
    if (list && following) list.scrollTop = list.scrollHeight;
  }, [thread.length, following]);
  async function send(event) {
    event.preventDefault();
    if (!reply.trim() || busy) return;
    await action(async () => {
      await request(`/chatbot/conversations/${conversation.id}/reply`, {
        content: reply,
      });
      setReply("");
    }, "Your reply was sent.");
  }
  return (
    <>
      <div className="bb-thread-heading">
        <div className="bb-person">
          <span className="bb-avatar">
            {initials(conversation.customer_name)}
          </span>
          <span>
            <strong>{conversation.customer_name || "Customer"}</strong>
            <Channel name={conversation.channel} />
          </span>
        </div>
        <div>
          <Status
            tone={
              conversation.status === "human_attention"
                ? "warning"
                : conversation.status === "closed"
                  ? "neutral"
                  : "success"
            }
          >
            {conversation.status === "human_attention"
              ? "Needs review"
              : conversation.status === "closed"
                ? "Resolved"
                : "Open"}
          </Status>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() =>
              action(
                () =>
                  request(
                    `/chatbot/conversations/${conversation.id}/status`,
                    {
                      status:
                        conversation.status === "closed" ? "open" : "closed",
                    },
                    "PATCH",
                  ),
                conversation.status === "closed"
                  ? "Conversation reopened."
                  : "Conversation marked resolved.",
              )
            }
          >
            {conversation.status === "closed" ? "Reopen" : "Mark resolved"}
          </Button>
        </div>
      </div>
      <div
        className="bb-thread-messages"
        tabIndex={0}
        role="log"
        aria-label="Customer conversation"
        aria-live="polite"
        aria-relevant="additions"
        onScroll={(e) =>
          setFollowing(
            e.currentTarget.scrollHeight -
              e.currentTarget.scrollTop -
              e.currentTarget.clientHeight <
              70,
          )
        }
      >
        {thread.map((m) => (
          <article className={`bb-bubble bb-bubble-${m.sender}`} key={m.id}>
            <small>
              {m.sender === "customer"
                ? conversation.customer_name || "Customer"
                : m.sender === "owner"
                  ? "You"
                  : "Business assistant"}{" "}
              <span>
                {timeLabel(m.created_at)}
                {m.delivery_status === "draft" ? " · Draft" : ""}
                {m.delivery_status === "failed" ? " · Delivery failed" : ""}
              </span>
            </small>
            <p>{m.content}</p>
          </article>
        ))}
        <div ref={end} />
      </div>
      {!following && (
        <button className="bb-new-messages" onClick={() => setFollowing(true)}>
          Jump to latest reply <Icon name="chevron" size={15} />
        </button>
      )}
      {requests.length > 0 && (
        <div className="bb-order-request-list">
          {requests.map((o) => (
            <section className="bb-request-panel" key={o.id}>
              <div>
                <Icon name="box" size={20} />
                <span>
                  <h3>Order request awaiting confirmation</h3>
                  <p>{o.request}</p>
                </span>
              </div>
              <OrderRequestForm orderRequest={o} />
              <small>
                Check the item and quantity before confirming. Delivery is
                arranged separately.
              </small>
            </section>
          ))}
        </div>
      )}
      <form className="bb-composer" onSubmit={send}>
        <InlineError>{error}</InlineError>
        <label htmlFor="owner-reply">Reply as the owner</label>
        <textarea
          id="owner-reply"
          required
          maxLength={2000}
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Write a thoughtful reply…"
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.form.requestSubmit();
            }
          }}
        />
        <div>
          <span>Your reply goes to the original channel.</span>
          <Button busy={busy} disabled={!reply.trim()} icon="send">
            Send reply
          </Button>
        </div>
      </form>
    </>
  );
}

export default function InboxPage() {
  const { data, inbox, onNavigate } = useBusiness();
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("All conversations"),
    [channel, setChannel] = useState("all"),
    [selected, setSelected] = useState(""),
    [mobileThread, setMobileThread] = useState(false);
  const [mode, setMode] = useState("live");
  const viewportHeight = useViewportHeight();
  const conversations = inbox.conversations.filter(
    (c) =>
      (filter !== "Needs review" || c.status === "human_attention") &&
      (channel === "all" || c.channel === channel) &&
      [c.customer_name, ...c.messages.map((m) => m.content)].some((v) =>
        String(v).toLowerCase().includes(query.toLowerCase()),
      ),
  );
  const conversation =
    conversations.find((c) => c.id === selected) || conversations[0];
  const group = data.customers.find(
    (c) => c.id === conversation?.customer_id,
  )?.group_id;
  const linked =
    group === undefined
      ? []
      : data.customers.filter((c) => c.group_id === group).map((c) => c.id);
  const thread = conversation
    ? inbox.conversations
        .filter(
          (c) => c.id === conversation.id || linked.includes(c.customer_id),
        )
        .flatMap((c) => c.messages.map((m) => ({ ...m, channel: c.channel })))
        .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id)
    : [];
  if (mode === "demo")
    return (
      <DemoWorkspace
        embedded
        onExit={() => setMode("live")}
        onNavigate={onNavigate}
      />
    );
  return (
    <>
      <PageHeader
        title="Unified inbox"
        description="Every conversation in one place. A human touch whenever it matters."
      >
        <Button
          variant="secondary"
          icon="sparkle"
          onClick={() => setMode("demo")}
        >
          Try example conversations
        </Button>
        <Status
          tone={inbox.enabled && inbox.auto_responses ? "success" : "neutral"}
        >
          {inbox.enabled && inbox.auto_responses
            ? "Assistant active"
            : "Automatic replies paused"}
        </Status>
      </PageHeader>
      {!inbox.conversations.length ? (
        <section className="bb-panel">
          <EmptyState
            icon="message"
            title="Your first conversation starts here."
            description="Connect website chat or a messaging channel. Customer questions and order requests will land in this inbox."
            action={
              <Button icon="sparkle" onClick={() => onNavigate("setup")}>
                Set up &amp; test your assistant
              </Button>
            }
          />
        </section>
      ) : (
        <section
          style={{ "--bb-chat-vh": `${viewportHeight}px` }}
          className={`bb-inbox bb-panel ${mobileThread ? "show-thread" : ""}`}
        >
          <aside className="bb-inbox-list">
            <div className="bb-inbox-controls">
              <div className="bb-search-field">
                <Icon name="search" size={17} />
                <input
                  aria-label="Search conversations"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search conversations…"
                />
              </div>
              <div className="bb-tabs">
                {["All conversations", "Needs review"].map((tab) => (
                  <button
                    className={filter === tab ? "is-active" : ""}
                    aria-pressed={filter === tab}
                    key={tab}
                    onClick={() => setFilter(tab)}
                  >
                    {tab === "All conversations" ? "All" : tab}
                    {tab === "Needs review" && (
                      <span> {inbox.needs_attention_count}</span>
                    )}
                  </button>
                ))}
              </div>
              <select
                aria-label="Filter conversations by channel"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
              >
                <option value="all">All channels</option>
                {[...new Set(inbox.conversations.map((c) => c.channel))].map(
                  (c) => (
                    <option value={c} key={c}>
                      {c === "website" ? "Website chat" : c}
                    </option>
                  ),
                )}
              </select>
            </div>
            <div className="bb-conversation-list">
              {conversations.map((c) => (
                <button
                  key={c.id}
                  className={`bb-conversation ${c.id === conversation?.id ? "is-selected" : ""}`}
                  onClick={() => {
                    setSelected(c.id);
                    setMobileThread(true);
                  }}
                >
                  <span className="bb-avatar bb-avatar-soft">
                    {initials(c.customer_name)}
                  </span>
                  <span className="bb-conversation-preview">
                    <span>
                      <strong>{c.customer_name || "Customer"}</strong>
                      <small>{timeLabel(c.updated_at)}</small>
                    </span>
                    <p>{c.messages.at(-1)?.content}</p>
                    <span>
                      <Channel name={c.channel} />
                      {c.status === "human_attention" && (
                        <i
                          className="bb-attention-dot"
                          aria-label="Needs review"
                        />
                      )}
                    </span>
                  </span>
                </button>
              ))}
              {!conversations.length && (
                <EmptyState
                  icon="search"
                  title="No conversations found."
                  description="Try a different search or filter."
                />
              )}
            </div>
            <footer>{conversations.length} conversations</footer>
          </aside>
          <article className="bb-inbox-thread">
            {conversation ? (
              <>
                <button
                  className="bb-thread-back"
                  onClick={() => setMobileThread(false)}
                >
                  <Icon name="back" size={17} />
                  Back to conversations
                </button>
                <ConversationThread
                  key={conversation.id}
                  conversation={conversation}
                  thread={thread}
                  requests={inbox.order_requests.filter(
                    (o) => o.conversation_id === conversation.id,
                  )}
                />
              </>
            ) : (
              <EmptyState
                icon="message"
                title="Choose a conversation."
                description="Customer questions, owner replies and requests stay together here."
              />
            )}
          </article>
        </section>
      )}
    </>
  );
}
