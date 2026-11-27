import { useEffect, useState } from "react";
import { request } from "../operationsApi";
import {
  Brand,
  Button,
  Icon,
  InlineError,
  LoadingPage,
  PageHeader,
  Status,
} from "../components/ui";
import AIConnectionPanel from "../components/AIConnectionPanel";

const money = (amount) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(amount);

export function PlanOptions({ onStart }) {
  const [plans, setPlans] = useState(null);
  const [error, setError] = useState("");
  const [annual, setAnnual] = useState(false);
  useEffect(() => {
    let active = true;
    request("/plans")
      .then((p) => { if (active) setPlans(p); })
      .catch((e) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, []);
  if (!plans) return error ? <InlineError>{error}</InlineError> : <LoadingPage />;
  return (
    <>
      <div className="bb-pricing-controls">
        <div className="bb-billing-toggle" role="group" aria-label="Billing period">
          <button type="button" aria-pressed={!annual} onClick={() => setAnnual(false)}>Monthly</button>
          <button type="button" aria-pressed={annual} onClick={() => setAnnual(true)}>Annual <span>2 months free</span></button>
        </div>
        <p>All prices in NGN. Annual plans save you two months.</p>
      </div>
      <p className="bb-pricing-launch" role="note">
        {plans.prototype_mode ? "Free includes 100 managed AI replies per account each month. No API key needed." : "Free is available now."} Paid tiers are launch pricing; checkout is not open yet.
        Planned managed AI allowances activate only when paid subscriptions launch.
      </p>
      <div className="bb-pricing-grid" aria-live="polite" aria-atomic="true">
        {plans.tiers.map((plan) => {
          const free = plan.id === "free";
          return (
            <section key={plan.id} className={`bb-panel bb-price-option${plan.id === "growth" ? " bb-price-managed" : ""}`} aria-label={`${plan.name} plan`}>
              <div className="bb-price-heading">
                <h2>{plan.name}</h2>
                <Status tone={free ? "success" : "neutral"}>{free ? "Available now" : "At launch"}</Status>
              </div>
              <p className="bb-price-audience">{plan.audience}</p>
              <p>{plan.description}</p>
              <p className="bb-price-amount">
                {money(annual ? plan.annual_price : plan.monthly_price)}
                <span>{free ? "Free forever · no card needed" : annual ? "per year · billed annually" : "per month · billed monthly"}</span>
              </p>
              <p className="bb-price-saving">{free ? plans.prototype_mode ? "100 managed AI replies each month." : "Start with your own model or saved facts." : annual ? `Save ${money(plan.monthly_price * 12 - plan.annual_price)} each year.` : `${money(plan.annual_price)} per year with annual billing.`}</p>
              <ul>{plan.features.map((item) => <li key={item}><Icon name="check" size={18} />{item}</li>)}</ul>
              <Button variant={plan.id === "growth" || free ? "primary" : "secondary"} onClick={onStart}>
                {free ? "Start with Free" : "Start free before launch"}<Icon name="arrow" size={16} />
              </Button>
              <small>{free ? "No subscription required. AI provider charges may apply." : "No charge today. Starting free does not activate a paid subscription."}</small>
            </section>
          );
        })}
      </div>
    </>
  );
}

export default function PricingPage({ onNavigate, publicPage = false }) {
  const content = (
    <>
      <PageHeader
        title="A plan for every stage of your business."
        description="Start free. Choose monthly or annual billing when you’re ready to grow."
      />
      <PlanOptions
        onStart={() =>
          onNavigate(
            publicPage
              ? sessionStorage.getItem("bizbuddyToken")
                ? "/dashboard/setup"
                : "/register"
              : "setup",
          )
        }
      />
      <section className="bb-pricing-facts">
        <h2>What should you expect to pay?</h2>
        <dl>
          <div>
            <dt>BizBuddy workspace</dt>
            <dd>Free costs ₦0. Starter, Growth and Business offer monthly or annual launch pricing. Paid checkout is not yet available.</dd>
          </div>
          <div>
            <dt>AI access and allowances</dt>
            <dd>
              The prototype Free plan includes 100 managed AI requests per account each calendar month, including assistant tests. Failed requests do not consume the allowance. Paid-tier allowances are planned for launch. With your own API key, usage is billed separately by your provider; a request cap is not a currency spending limit.
            </dd>
          </div>
          <div>
            <dt>Customer channels</dt>
            <dd>
              Website chat is included. Telegram uses its free Bot API. Gmail
              account limits and Twilio’s WhatsApp/SMS pricing apply.
            </dd>
          </div>
        </dl>
      </section>
      {!publicPage && <AIConnectionPanel />}
    </>
  );
  return publicPage ? (
    <div className="bb bb-public-pricing">
      <header>
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            onNavigate("/");
          }}
        >
          <Brand />
        </a>
        <Button variant="secondary" onClick={() => onNavigate("/signin")}>
          Sign in
        </Button>
      </header>
      <main>{content}</main>
      <footer>
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            onNavigate("/");
          }}
        >
          Back to BizBuddy
        </a>
      </footer>
    </div>
  ) : (
    content
  );
}
