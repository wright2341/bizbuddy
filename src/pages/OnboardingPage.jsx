import { useEffect, useState } from "react";
import { request } from "../operationsApi";
import {
  Button,
  Icon,
  InlineError,
  LoadingPage,
  PageHeader,
  Status,
} from "../components/ui";
import AIConnectionPanel from "../components/AIConnectionPanel";

const steps = ["Choose AI", "Add knowledge", "Test a reply", "Go live"];
export default function OnboardingPage({ onNavigate }) {
  const [data, setData] = useState(null),
    [step, setStep] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState(null),
    [live, setLive] = useState(null);
  useEffect(() => {
    let active = true;
    request("/onboarding")
      .then((d) => {
        if (active) {
          setData(d);
          setStep(d.step);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  async function run(fn) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function move(next) {
    await run(async () => {
      await request("/onboarding/progress", { step: next }, "PUT");
      setStep(next);
    });
  }
  async function saveKnowledge(e) {
    e.preventDefault();
    const fields = Object.fromEntries(new FormData(e.currentTarget));
    await run(async () => {
      await request("/onboarding/knowledge", fields, "PUT");
      const next = await request("/onboarding");
      setData(next);
      setResult(null);
      setStep(2);
    });
  }
  async function testReply(e) {
    e.preventDefault();
    const message = new FormData(e.currentTarget).get("message");
    await run(async () => {
      const reply = await request("/onboarding/test", { message });
      setResult({ ...reply, question: message });
      setData(await request("/onboarding"));
    });
  }
  if (!data)
    return error ? <InlineError>{error}</InlineError> : <LoadingPage />;
  const chatLink = live
    ? `${window.location.origin}/chat/${live.public_id}`
    : "";
  return (
    <>
      <PageHeader
        title="Put your AI assistant to work."
        description="Give it your business facts, test a real answer, then open your customer chat."
      >
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() =>
            run(async () => {
              await request(
                "/onboarding/progress",
                { step, skipped: true },
                "PUT",
              );
              onNavigate("");
            })
          }
        >
          Explore workspace first
        </Button>
      </PageHeader>
      <InlineError>{error}</InlineError>
      <div className="bb-onboarding-layout">
        <aside className="bb-onboarding-guide">
          <nav aria-label="Assistant setup steps">
            {steps.map((label, i) => (
              <button
                key={label}
                disabled={busy}
                aria-current={i === step ? "step" : undefined}
                onClick={() => move(i)}
              >
                <span>{i + 1}</span>
                <strong>{label}</strong>
              </button>
            ))}
          </nav>
          <div>
            <Icon name="shield" size={22} />
            <h2>Your business stays in control.</h2>
            <p>
              Your assistant uses confirmed facts. Unknown questions, orders and
              payments go to you.
            </p>
          </div>
        </aside>
        <section className="bb-onboarding-main" aria-label={steps[step]}>
          {step === 0 && (
            <>
              <AIConnectionPanel
                initialEngine={data.engine}
                onBusyChange={setBusy}
                onConnected={(engine) => {
                  setData((current) => ({
                    ...current,
                    engine,
                    test_passed: false,
                  }));
                }}
              />
              <div className="bb-setup-actions">
                <p>
                  {data.engine.source === "grounded"
                    ? "You can start with saved-fact replies and connect AI later."
                    : "Next, give your model the facts customers need."}
                </p>
                <Button disabled={busy} onClick={() => move(1)}>
                  Continue to business knowledge <Icon name="arrow" size={16} />
                </Button>
              </div>
            </>
          )}
          {step === 1 && (
            <section className="bb-panel bb-setup-form">
              <h2>
                Teach it about {data.bot.business_name || "your business"}.
              </h2>
              <p>
                A few confirmed details are enough to test your first answer.
                Add products and more FAQs later.
              </p>
              <form onSubmit={saveKnowledge}>
                <label>
                  What does your business do?
                  <textarea
                    aria-label="What does your business do?"
                    name="business_description"
                    required
                    minLength={10}
                    maxLength={4000}
                    rows={3}
                    defaultValue={data.bot.business_description}
                    placeholder="What you sell, who you help, and what customers should know."
                  />
                </label>
                <label>
                  Opening hours
                  <input
                    name="operating_hours"
                    required
                    maxLength={1000}
                    defaultValue={data.bot.operating_hours}
                    placeholder="Monday–Saturday, 9 AM–6 PM"
                  />
                </label>
                <label>
                  Delivery or service policy
                  <textarea
                    aria-label="Delivery or service policy"
                    name="delivery_policy"
                    rows={2}
                    maxLength={2000}
                    defaultValue={data.bot.delivery_policy}
                    placeholder="Where you deliver or how customers receive your service."
                  />
                </label>
                <label>
                  Payment policy
                  <input
                    name="payment_policy"
                    maxLength={2000}
                    defaultValue={data.bot.payment_policy}
                    placeholder="Your confirmed payment terms"
                  />
                </label>
                <details>
                  <summary>Add a common question</summary>
                  <label>
                    Customer question
                    <input
                      name="question"
                      maxLength={500}
                      placeholder="Do you offer custom orders?"
                    />
                  </label>
                  <label>
                    Your confirmed answer
                    <textarea name="answer" maxLength={2000} rows={2} />
                  </label>
                </details>
                <Button busy={busy}>
                  Save &amp; test an answer <Icon name="arrow" size={16} />
                </Button>
              </form>
            </section>
          )}
          {step === 2 && (
            <section className="bb-panel bb-setup-form">
              <h2>See your assistant answer.</h2>
              <p>
                This uses your actual reply engine and saved knowledge. No
                customer is contacted.
              </p>
              <form onSubmit={testReply}>
                <label>
                  Ask a customer question
                  <input
                    name="message"
                    required
                    maxLength={2000}
                    defaultValue="What are your opening hours?"
                  />
                </label>
                <Button busy={busy} icon="sparkle">
                  Test my assistant
                </Button>
              </form>
              {result && (
                <div className="bb-setup-preview" aria-live="polite">
                  <p className="bb-setup-question">{result.question}</p>
                  <div>
                    <Status
                      tone={
                        result.reply_source === "saved_facts"
                          ? "neutral"
                          : "success"
                      }
                    >
                      {result.reply_source === "saved_facts"
                        ? "Saved-fact reply"
                        : "AI-generated reply"}
                    </Status>
                    <p>{result.reply}</p>
                  </div>
                  {result.needs_human && (
                    <p className="bb-ai-notice">
                      This needs an owner’s answer. Add the missing knowledge,
                      then test again.
                    </p>
                  )}
                </div>
              )}
              <div className="bb-setup-actions">
                <Button variant="secondary" onClick={() => move(1)}>
                  Edit business knowledge
                </Button>
                <Button
                  disabled={busy || !data.test_passed}
                  onClick={() => move(3)}
                >
                  Continue to go live <Icon name="arrow" size={16} />
                </Button>
              </div>
            </section>
          )}
          {step === 3 && (
            <section className="bb-panel bb-setup-form">
              <span className="bb-setup-success-icon">
                <Icon name="circleCheck" size={36} />
              </span>
              <h2>
                {live
                  ? "Your customer chat is live."
                  : "Ready for your first customer."}
              </h2>
              <p>
                {live
                  ? "Share your link or add the widget to your website. Conversations and owner handoffs appear in your unified inbox."
                  : "Publish a website chat with the knowledge and reply engine you’ve tested. Connect Telegram, email or WhatsApp whenever you’re ready."}
              </p>
              <ul className="bb-setup-checklist">
                <li>
                  <Icon name="check" size={18} />
                  {data.bot.business_description
                    ? "Business knowledge saved"
                    : "Add business knowledge before activation"}
                </li>
                <li>
                  <Icon name="check" size={18} />
                  {data.test_passed
                    ? `Test completed · ${data.test_source === "saved_facts" ? "saved-fact replies" : "model-generated replies"}`
                    : "Test a supported answer before activation"}
                </li>
                <li>
                  <Icon name="check" size={18} />
                  Human handoffs and owner order approval
                </li>
              </ul>
              {live ? (
                <>
                  <label>
                    Customer chat link
                    <input
                      readOnly
                      value={chatLink}
                      onFocus={(e) => e.target.select()}
                    />
                  </label>
                  <div className="bb-setup-actions">
                    <a
                      className="bb-btn bb-btn-primary"
                      href={chatLink}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open customer chat <Icon name="external" size={16} />
                    </a>
                    <Button
                      variant="secondary"
                      onClick={() => onNavigate("connections")}
                    >
                      Install widget &amp; connect channels
                    </Button>
                    <Button variant="ghost" onClick={() => onNavigate("inbox")}>
                      Open unified inbox
                    </Button>
                  </div>
                </>
              ) : (
                <Button
                  busy={busy}
                  disabled={!data.test_passed}
                  onClick={() =>
                    run(async () => {
                      const active = await request("/onboarding/activate", {});
                      setLive(active);
                      setData(await request("/onboarding"));
                    })
                  }
                >
                  Activate customer replies <Icon name="arrow" size={16} />
                </Button>
              )}
            </section>
          )}
        </section>
      </div>
    </>
  );
}
