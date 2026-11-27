import { useState } from "react";
import { useBusiness } from "../businessContext";
import { request } from "../operationsApi";
import {
  Button,
  Icon,
  InlineError,
  Modal,
  PageHeader,
  Status,
} from "../components/ui";

export default function AssistantPage() {
  const { bot, data, inbox, engine, busy, error, action, onNavigate } =
    useBusiness();
  const [tab, setTab] = useState("Business knowledge"),
    [faq, setFaq] = useState(false),
    [test, setTest] = useState(""),
    [result, setResult] = useState(null);
  const active = bot.enabled && bot.auto_responses;
  async function save(event) {
    event.preventDefault();
    const f = Object.fromEntries(new FormData(event.currentTarget));
    await action(
      () => request("/chatbot", { ...bot, ...f }, "PUT"),
      "Business knowledge saved. Your assistant has the latest information.",
    );
  }
  return (
    <>
      <PageHeader
        title="Your business assistant"
        description="Helpful with the routine. Thoughtful about when to hand over."
      />
      <section className="bb-engine-status" aria-label="Reply engine">
        <span className="bb-engine-symbol">
          <Icon name="sparkle" size={23} />
        </span>
        <div>
          <h2>
            {engine?.provider === "opencode"
              ? "OpenCode AI"
              : engine?.provider === "openai"
                ? "AI replies"
                : "Fact-based replies"}
          </h2>
          <p>
            {engine?.provider === "opencode"
              ? engine.state === "ready"
                ? "Free AI replies are available. Responses use your saved business knowledge."
                : engine.state === "limited"
                  ? "OpenCode’s free usage limit has been reached. Your saved facts keep chat working; AI access is checked again automatically."
                  : "The embedded AI engine is configured. Saved facts keep chat working while AI access is checked."
              : "Your assistant answers from saved products, policies and FAQs."}
          </p>
        </div>
        <Status
          tone={
            engine?.provider === "opencode" && engine.state !== "ready"
              ? "warning"
              : "success"
          }
        >
          {engine?.provider === "opencode" && engine.state !== "ready"
            ? "Fact-based fallback"
            : "Available"}
        </Status>
      </section>
      <section className="bb-panel bb-assistant-status">
        <span className="bb-connection-icon">
          <Icon name="sparkle" size={24} />
        </span>
        <div>
          <h2>Automatic replies</h2>
          <p>
            {active
              ? "Your assistant is answering supported questions on connected channels."
              : "New customer messages will wait for your review until you activate replies."}
          </p>
        </div>
        <Status tone={active ? "success" : "neutral"}>
          {active ? "Active" : "Paused"}
        </Status>
        <button
          className={`bb-switch ${active ? "is-on" : ""}`}
          role="switch"
          aria-checked={active}
          aria-label="Automatic replies"
          disabled={busy}
          onClick={() =>
            action(
              async () => {
                if (!bot.enabled) await request("/chatbot/activate", {});
                await request(
                  "/chatbot/automation",
                  { auto_responses: !active },
                  "PATCH",
                );
              },
              active
                ? "Automatic replies paused. You can still reply from the inbox."
                : "Automatic replies activated.",
            )
          }
        >
          <span />
        </button>
      </section>
      <div
        className="bb-page-tabs"
        role="tablist"
        aria-label="Assistant settings"
      >
        {["Business knowledge", "Policies & FAQs", "Test assistant"].map(
          (label) => (
            <button
              role="tab"
              aria-selected={tab === label}
              onClick={() => setTab(label)}
              key={label}
            >
              {label}
            </button>
          ),
        )}
      </div>
      {tab === "Business knowledge" ? (
        <div className="bb-assistant-layout">
          <section className="bb-panel">
            <div className="bb-panel-heading">
              <div>
                <h2>A little about your business</h2>
                <p>Give your assistant the facts your customers ask for.</p>
              </div>
            </div>
            <form
              className="bb-form bb-panel-body"
              key={bot.updated_at + "knowledge"}
              onSubmit={save}
            >
              <InlineError>{error}</InlineError>
              <div className="bb-form-grid">
                <label>
                  Assistant name
                  <input
                    name="name"
                    required
                    maxLength={255}
                    defaultValue={bot.name}
                  />
                </label>
                <label>
                  Business name
                  <input
                    name="business_name"
                    required
                    maxLength={255}
                    defaultValue={bot.business_name}
                  />
                </label>
              </div>
              <label>
                Welcome message
                <textarea
                  name="welcome_message"
                  maxLength={2000}
                  defaultValue={bot.welcome_message}
                  placeholder="A friendly hello for your customers."
                />
              </label>
              <label>
                About your business
                <textarea
                  name="business_description"
                  maxLength={5000}
                  defaultValue={bot.business_description}
                />
              </label>
              <label>
                Reply tone
                <select
                  aria-label="Reply tone"
                  name="response_tone"
                  defaultValue={bot.response_tone || "Professional"}
                >
                  {[
                    ...new Set(
                      [
                        bot.response_tone,
                        "Professional",
                        "Friendly",
                        "Warm and concise",
                      ].filter(Boolean),
                    ),
                  ].map((tone) => (
                    <option key={tone}>{tone}</option>
                  ))}
                </select>
                <span className="bb-form-help">
                  The free grounded engine quotes saved facts directly. Tone is
                  also supplied to the optional AI provider when configured.
                </span>
              </label>
              <div className="bb-form-actions">
                <Button busy={busy}>Save business knowledge</Button>
              </div>
            </form>
          </section>
          <div>
            <section className="bb-panel bb-assistant-rules">
              <h3>What your assistant will do</h3>
              <ul>
                {[
                  "Quote only saved prices and availability.",
                  "Use the policies you’ve provided.",
                  "Record order requests for your confirmation.",
                  "Flag unfamiliar questions for you.",
                  "Keep email replies as drafts until approved.",
                ].map((text) => (
                  <li key={text}>
                    <Icon name="circleCheck" size={17} />
                    {text}
                  </li>
                ))}
              </ul>
            </section>
            <section className="bb-panel bb-assistant-rules">
              <h3>Product knowledge</h3>
              <p>
                {data.products.length} products from your inventory. Update
                stock and pricing there to keep replies accurate.
              </p>
              <Button
                variant="secondary"
                onClick={() => onNavigate("inventory")}
              >
                Manage inventory <Icon name="arrow" size={16} />
              </Button>
            </section>
          </div>
        </div>
      ) : tab === "Policies & FAQs" ? (
        <div className="bb-assistant-layout">
          <section className="bb-panel">
            <div className="bb-panel-heading">
              <div>
                <h2>Your business policies</h2>
                <p>
                  Be specific. Missing details will be passed to you for
                  confirmation.
                </p>
              </div>
            </div>
            <form
              className="bb-form bb-panel-body"
              key={bot.updated_at + "policies"}
              onSubmit={save}
            >
              <InlineError>{error}</InlineError>
              {[
                [
                  "operating_hours",
                  "Opening hours",
                  "e.g. Monday to Friday, 9am–5pm.",
                ],
                [
                  "delivery_policy",
                  "Delivery policy",
                  "Where you deliver, dispatch times and how fees are confirmed.",
                ],
                [
                  "payment_policy",
                  "Payment policy",
                  "How and when your business accepts payment.",
                ],
              ].map(([name, label, placeholder]) => (
                <label key={name}>
                  {label}
                  <textarea
                    name={name}
                    maxLength={2000}
                    defaultValue={bot[name]}
                    placeholder={placeholder}
                  />
                </label>
              ))}
              <div className="bb-form-actions">
                <Button busy={busy}>Save policies</Button>
              </div>
            </form>
          </section>
          <section className="bb-panel">
            <div className="bb-panel-heading">
              <div>
                <h2>Frequently asked questions</h2>
                <p>Verified answers to familiar questions.</p>
              </div>
              <Button
                variant="secondary"
                icon="plus"
                onClick={() => setFaq(true)}
                disabled={bot.faqs.length >= 100}
              >
                Add
              </Button>
            </div>
            <div className="bb-panel-body">
              {bot.faqs.length ? (
                bot.faqs.map((item, index) => (
                  <div className="bb-faq" key={index}>
                    <h3>{item.question}</h3>
                    <p>{item.answer}</p>
                    <Button
                      variant="ghost"
                      busy={busy}
                      onClick={() =>
                        action(
                          () =>
                            request(
                              "/chatbot",
                              {
                                ...bot,
                                faqs: bot.faqs.filter((_, i) => i !== index),
                              },
                              "PUT",
                            ),
                          "FAQ removed.",
                        )
                      }
                    >
                      Remove
                    </Button>
                  </div>
                ))
              ) : (
                <p className="bb-form-help">
                  No FAQs yet. Add the questions your customers ask most often.
                </p>
              )}
            </div>
          </section>
        </div>
      ) : (
        <section className="bb-panel bb-test-panel">
          <div className="bb-panel-heading">
            <div>
              <h2>Try a customer question</h2>
              <p>
                This test uses your saved business knowledge and does not
                contact anyone.
              </p>
            </div>
          </div>
          <form
            className="bb-form bb-panel-body"
            onSubmit={(e) => {
              e.preventDefault();
              action(async () => {
                const response = await request("/chatbot/test", {
                  message: test,
                });
                setResult(response);
              });
            }}
          >
            <InlineError>{error}</InlineError>
            <label>
              Customer message
              <textarea
                required
                maxLength={2000}
                value={test}
                onChange={(e) => setTest(e.target.value)}
                placeholder="What is the price of your blue ankara?"
              />
            </label>
            <div className="bb-form-actions">
              <span className="bb-form-help">
                {inbox.channels.length} channels in your workspace.
              </span>
              <Button icon="sparkle" busy={busy}>
                Test reply
              </Button>
            </div>
            {result && (
              <div className="bb-test-result">
                <Status tone={result.needs_human ? "warning" : "success"}>
                  {result.needs_human
                    ? "Owner review needed"
                    : "Answered from business knowledge"}
                </Status>
                <p>{result.reply}</p>
                {result.order_request && (
                  <small>
                    This is an order request. A real customer message would be
                    captured for owner confirmation.
                  </small>
                )}
              </div>
            )}
          </form>
        </section>
      )}
      {faq && (
        <Modal
          title="Add a verified answer"
          description="The grounded assistant uses an exact question match for FAQs."
          onClose={() => setFaq(false)}
        >
          <form
            className="bb-form"
            onSubmit={(e) => {
              e.preventDefault();
              const f = Object.fromEntries(new FormData(e.currentTarget));
              action(async () => {
                await request(
                  "/chatbot",
                  { ...bot, faqs: [...bot.faqs, f] },
                  "PUT",
                );
                setFaq(false);
              }, "FAQ saved.");
            }}
          >
            <InlineError>{error}</InlineError>
            <label>
              Customer question
              <input name="question" required maxLength={1000} />
            </label>
            <label>
              Verified answer
              <textarea name="answer" required maxLength={2000} />
            </label>
            <div className="bb-form-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setFaq(false)}
              >
                Cancel
              </Button>
              <Button busy={busy}>Save FAQ</Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
