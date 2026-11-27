import { Brand, Icon } from "./components/ui";

export default function LandingPage({ navigateAuth }) {
  return (
    <div className="landing-site">
      <section className="landing-hero">
        <header className="public-header">
          <a
            className="public-brand"
            href="/"
            onClick={(event) => {
              event.preventDefault();
              navigateAuth("landing");
            }}
          >
            <Brand light />
          </a>
          <nav aria-label="Main navigation">
            <a href="#features">Platform</a>
            <a href="#how-it-works">How it works</a>
            <a
              href="/pricing"
              onClick={(e) => {
                e.preventDefault();
                navigateAuth("pricing");
              }}
            >
              Pricing
            </a>
          </nav>
          <div className="public-header-actions">
            <button
              className="public-signin"
              onClick={() => navigateAuth("signin")}
            >
              Sign in
            </button>
            <button
              className="public-start"
              onClick={() => navigateAuth("register")}
            >
              Get started <Icon name="arrow" size={15} />
            </button>
          </div>
        </header>

        <main className="landing-hero-main">
          <div className="landing-copy">
            <h1>
              Make room for
              <br />
              <em>better business.</em>
            </h1>
            <p className="landing-description">
              Automate customer replies with an AI assistant that knows your
              business. Bring conversations, orders and follow-ups into one
              workspace.
            </p>
            <div className="landing-hero-actions">
              <button
                className="hero-primary"
                onClick={() => navigateAuth("register")}
              >
                Set up your AI assistant <Icon name="arrow" size={16} />
              </button>
              <a
                className="hero-secondary"
                href="/demo"
                onClick={(e) => {
                  e.preventDefault();
                  navigateAuth("demo");
                }}
              >
                Explore Messages <Icon name="arrow" size={16} />
              </a>
            </div>
            <p className="landing-cost-note">
              Free during early access.{" "}
              <a
                href="/pricing"
                onClick={(e) => {
                  e.preventDefault();
                  navigateAuth("pricing");
                }}
              >
                View pricing &amp; AI options
              </a>
            </p>
          </div>

          <div
            className="hero-showcase"
            aria-label="BizBuddy platform features"
          >
            <article className="showcase-card showcase-orders">
              <div className="showcase-card-heading">
                <span className="showcase-icon">
                  <Icon name="box" size={17} />
                </span>
                <span>Order Flow</span>
              </div>
              <ol
                className="landing-order-timeline"
                aria-label="Order progress"
              >
                {[
                  ["invoice", "New"],
                  ["box", "Confirmed"],
                  ["check", "Complete"],
                ].map(([icon, label]) => (
                  <li key={label}>
                    <span className="landing-order-node">
                      <Icon name={icon} size={18} />
                    </span>
                    <span className="landing-order-label">{label}</span>
                  </li>
                ))}
              </ol>
              <small>Keep every order moving forward.</small>
            </article>
            <article className="showcase-card showcase-concierge">
              <div className="showcase-card-heading">
                <span className="showcase-icon sparkle">
                  <Icon name="sparkle" size={17} />
                </span>
                <span>AI Assistant</span>
              </div>
              <p>Thoughtful customer replies, right when you need them.</p>
              <span className="showcase-link">
                A little more time for you{" "}
                <b>
                  <Icon name="arrow" size={14} />
                </b>
              </span>
            </article>
            <article className="showcase-card showcase-workspace">
              <span className="workspace-label">Your Workspace</span>
              <strong>
                Everything in
                <br />
                its right place.
              </strong>
              <div className="workspace-pills">
                <span>Orders</span>
                <span>Profiles</span>
                <span>AI</span>
              </div>
            </article>
          </div>
          <div className="landing-hero-footer">
            <span>Thoughtful tools for the way you work.</span>
            <a href="#features">Explore the platform</a>
          </div>
        </main>
      </section>

      <div className="landing-trust-strip" aria-label="BizBuddy tools">
        <span>One workspace for</span>
        <b>Orders</b>
        <i />
        <b>Customers</b>
        <i />
        <b>AI assistant</b>
        <i />
        <b>Your business</b>
      </div>

      <section className="landing-features" id="features">
        <div className="landing-section-heading" id="about">
          <h2>
            Less juggling.
            <br />
            <span>More of what matters.</span>
          </h2>
          <p>
            BizBuddy brings the everyday work of your business into one clear,
            connected workspace.
          </p>
        </div>
        <div className="landing-feature-cards" id="how-it-works">
          <article className="landing-feature-card feature-orders">
            <div className="feature-visual order-visual">
              <div className="landing-order-receipt">
                <Icon name="circleCheck" size={30} />
                <div>
                  <strong>Order received</strong>
                  <small>Ready for your confirmation</small>
                </div>
              </div>
            </div>
            <h3>Stay on top of every order.</h3>
            <p>
              Create orders, update their status, and see what needs your
              attention.
            </p>
          </article>
          <article className="landing-feature-card feature-profiles">
            <div className="feature-visual profile-visual">
              <span className="profile-dot">
                <Icon name="message" size={28} />
              </span>
              <span>
                Your details, your business,
                <br />
                all in one place.
              </span>
            </div>
            <h3>Your business, your way.</h3>
            <p>
              Keep your account and business details connected to your
              workspace.
            </p>
          </article>
          <article className="landing-feature-card feature-ai">
            <div className="feature-visual ai-visual">
              <span>
                <Icon name="sparkle" size={23} />
              </span>
              <b>A helpful hand, on demand.</b>
            </div>
            <h3>Meet your AI assistant.</h3>
            <p>
              Get help drafting customer replies and handling everyday
              questions.
            </p>
          </article>
        </div>
      </section>

      <section className="landing-ai-entry">
        <h2>Your first automated reply starts here.</h2>
        <p>
          Add your business knowledge, connect a model, and test an answer
          before you go live.
        </p>
        <div>
          <button
            className="hero-primary"
            onClick={() => navigateAuth("register")}
          >
            Set up my assistant <Icon name="arrow" size={16} />
          </button>
          <a
            href="/pricing"
            onClick={(e) => {
              e.preventDefault();
              navigateAuth("pricing");
            }}
          >
            See pricing &amp; AI options
          </a>
        </div>
      </section>

      <footer className="landing-footer">
        <a
          className="public-brand"
          href="/"
          onClick={(event) => {
            event.preventDefault();
            navigateAuth("landing");
          }}
        >
          <Brand />
        </a>
        <button onClick={() => navigateAuth("signin")}>
          Sign in <Icon name="arrow" size={15} />
        </button>
      </footer>
    </div>
  );
}
