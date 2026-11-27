import { useRef, useState } from "react";
import { Brand, Button, Icon, InlineError } from "../components/ui";

export default function AuthPage({ mode, onNavigate, onAuthenticate }) {
  const registering = mode === "register";
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [capsLock, setCapsLock] = useState(false);
  const errorRef = useRef(null);
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await onAuthenticate(values, registering);
    } catch (e) {
      setError(e.message);
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="bb bb-auth">
      <aside className="bb-auth-story">
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            onNavigate("/");
          }}
          aria-label="BizBuddy home"
        >
          <Brand light />
        </a>
        <div className="bb-auth-story-main">
          <h2>
            Good business
            <br />
            starts with a<br />
            clearer day.
          </h2>
          <p>
            Your conversations, orders and invoices.
            <br />
            Together in one calm workspace.
          </p>
          <div className="bb-auth-features">
            {[
              ["message", "Customer messages"],
              ["box", "Order requests"],
              ["invoice", "Invoices & reminders"],
            ].map(([icon, label]) => (
              <div key={icon}>
                <Icon name={icon} size={25} />
                <span>{label}</span>
                <Icon name="check" size={21} />
              </div>
            ))}
          </div>
        </div>
        <p className="bb-auth-tagline">Every chat. One inbox. Done for you.</p>
      </aside>
      <main className="bb-auth-main">
        <header>
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onNavigate("/");
            }}
            className="bb-auth-mobile-brand"
          >
            <Brand />
          </a>
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onNavigate("/");
            }}
          >
            Back to home <Icon name="external" size={15} />
          </a>
        </header>
        <section
          className={`bb-auth-form-wrap ${registering ? "is-register" : ""}`}
        >
          <h1>
            {registering ? "A clearer day starts here." : "Welcome back."}
          </h1>
          <p>
            {registering
              ? "Create a workspace for your business."
              : "Sign in to your business workspace."}
          </p>
          <form onSubmit={submit} className="bb-form">
            <div ref={errorRef} tabIndex={-1}>
              <InlineError>{error}</InlineError>
            </div>
            {registering && (
              <div className="bb-form-grid">
                <label>
                  Full name
                  <input
                    name="name"
                    required
                    maxLength={255}
                    autoComplete="name"
                    placeholder="Your full name"
                    disabled={busy}
                  />
                </label>
                <label>
                  Business name
                  <input
                    name="business"
                    required
                    maxLength={255}
                    autoComplete="organization"
                    placeholder="Your business name"
                    disabled={busy}
                  />
                </label>
              </div>
            )}
            <label>
              Email address
              <input
                name="email"
                type="email"
                required
                autoComplete="username"
                placeholder="you@yourbusiness.com"
                disabled={busy}
              />
            </label>
            {registering && (
              <label>
                Business category
                <select
                  aria-label="Business category"
                  name="category"
                  required
                  defaultValue=""
                  disabled={busy}
                >
                  <option value="" disabled>
                    Select your business category
                  </option>
                  <option>Fashion & textiles</option>
                  <option>Retail & boutique</option>
                  <option>Food & catering</option>
                  <option>Groceries & provisions</option>
                  <option>Beauty & personal care</option>
                  <option>Electronics & gadgets</option>
                  <option>Home & furniture</option>
                  <option>Health & wellness</option>
                  <option>Fitness & sports</option>
                  <option>Education & training</option>
                  <option>Professional services</option>
                  <option>Digital services & technology</option>
                  <option>Automotive & repairs</option>
                  <option>Logistics & delivery</option>
                  <option>Hospitality & travel</option>
                  <option>Events & entertainment</option>
                  <option>Agriculture & farming</option>
                  <option>Real estate & property</option>
                  <option>Arts & crafts</option>
                  <option>Other</option>
                </select>
              </label>
            )}
            <label htmlFor="auth-password">Password</label>
            <div className="bb-password">
              <input
                id="auth-password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={registering ? 8 : undefined}
                maxLength={128}
                autoComplete={registering ? "new-password" : "current-password"}
                aria-describedby="password-help"
                placeholder={
                  registering ? "Create a password" : "Enter your password"
                }
                onKeyUp={(e) => setCapsLock(e.getModifierState("CapsLock"))}
                onBlur={() => setCapsLock(false)}
                disabled={busy}
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword(!showPassword)}
              >
                <Icon name={showPassword ? "eyeOff" : "eye"} size={20} />
              </button>
            </div>
            <p id="password-help" className="bb-form-help">
              {capsLock
                ? "Caps Lock is on."
                : registering
                  ? "Use at least 8 characters. Password managers and paste are supported."
                  : "Use the email and password you signed up with."}
            </p>
            <Button type="submit" busy={busy} className="bb-auth-submit">
              {busy
                ? registering
                  ? "Creating your workspace…"
                  : "Signing in…"
                : registering
                  ? "Create account"
                  : "Sign in"}
            </Button>
          </form>
          <p className="bb-auth-switch">
            {registering ? "Already have an account?" : "New to BizBuddy?"}{" "}
            <a
              href={registering ? "/signin" : "/register"}
              onClick={(e) => {
                e.preventDefault();
                onNavigate(registering ? "/signin" : "/register");
              }}
            >
              {registering ? "Sign in" : "Create an account"}
            </a>
          </p>
          <p className="bb-auth-demo-link">
            Want to see it first?{" "}
            <a
              href="/demo"
              onClick={(e) => {
                e.preventDefault();
                onNavigate("/demo");
              }}
            >
              Explore Messages <Icon name="arrow" size={14} />
            </a>
          </p>
        </section>
        <footer>
          <Icon name="shield" size={19} />
          Your workspace is private to your account.
        </footer>
      </main>
    </div>
  );
}
