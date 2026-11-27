import { Component, useEffect, useId, useRef } from "react";

export function Icon({ name, size = 20, ...props }) {
  const paths = {
    home: (
      <>
        <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" />
      </>
    ),
    message: (
      <>
        <path d="M21 12a8 8 0 0 1-8 8H7l-5 3 2-7a8 8 0 1 1 17-4Z" />
        <path d="M8 11h8m-8 4h5" />
      </>
    ),
    box: (
      <>
        <path d="m12 3 9 5-9 5-9-5 9-5Zm-9 5v10l9 5 9-5V8M12 13v10M7.5 5.5l9 5" />
      </>
    ),
    users: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 21v-3a6 6 0 0 1 12 0v3m1-16a3 3 0 0 1 0 6m3 10v-3a5 5 0 0 0-3-4" />
      </>
    ),
    stock: (
      <>
        <path d="m12 3 10 5-10 5L2 8l10-5Zm-10 9 10 5 10-5M2 16l10 5 10-5" />
      </>
    ),
    invoice: (
      <>
        <path d="M6 3h9l4 4v14H5V3Zm8 0v5h5M8 12h8m-8 4h6" />
      </>
    ),
    link: (
      <>
        <path
          d="m10 13 4-4m-6 7-2 2a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m2 0 2-2a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0"
          transform="translate(1 0)"
        />
      </>
    ),
    sparkle: (
      <>
        <path d="m12 3 2.3 6.7L21 12l-6.7 2.3L12 21l-2.3-6.7L3 12l6.7-2.3L12 3Z" />
        <path d="m20 2 .5 1.5L22 4l-1.5.5L20 6l-.5-1.5L18 4l1.5-.5L20 2Z" />
      </>
    ),
    settings: (
      <>
        <path d="m9 3-1 3-3 1-2 4 2 2v4l4 3 3-1 3 1 4-3v-4l2-2-2-4-3-1-1-3H9Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    logout: (
      <>
        <path d="M9 3H4v18h5m5-14 5 5-5 5m-6-5h13" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 5 5" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    back: <path d="M20 12H4m6-6-6 6 6 6" />,
    chevron: <path d="m6 9 6 6 6-6" />,
    check: <path d="m5 12 4 4L19 6" />,
    circleCheck: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 3 3 6-6" />
      </>
    ),
    warning: (
      <>
        <path d="m12 3 10 18H2L12 3Z" />
        <path d="M12 9v5m0 3v1" />
      </>
    ),
    close: <path d="m6 6 12 12M6 18 18 6" />,
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    globe: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c6 6 6 12 0 18-6-6-6-12 0-18Z" />
      </>
    ),
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 6 9 7 9-7" />
      </>
    ),
    send: (
      <>
        <path d="m22 2-7 20-4-9-9-4 20-7Zm0 0L11 13" />
      </>
    ),
    shield: (
      <>
        <path d="m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6l9-4Z" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    eyeOff: (
      <>
        <path d="m3 3 18 18M10 5a12 12 0 0 1 12 7 17 17 0 0 1-4 5M6 6a17 17 0 0 0-4 6s4 7 10 7a12 12 0 0 0 5-1" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M7 2v6m10-6v6M3 11h18" />
      </>
    ),
    download: (
      <>
        <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />
      </>
    ),
    edit: (
      <>
        <path d="m14 4 6 6-10 10-7 1 1-7L14 4Zm0 0 2-2a2 2 0 0 1 3 0l3 3a2 2 0 0 1 0 3l-2 2" />
      </>
    ),
    refresh: (
      <>
        <path d="M20 7v5h-5M4 17v-5h5m11 0a8 8 0 0 0-14-6M4 12a8 8 0 0 0 14 6" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    card: (
      <>
        <rect x="2" y="4" width="20" height="16" rx="3" />
        <path d="M2 9h20M6 15h4" />
      </>
    ),
    copy: (
      <>
        <rect x="8" y="8" width="13" height="13" rx="2" />
        <path d="M16 8V3H3v13h5" />
      </>
    ),
    external: (
      <>
        <path d="M14 3h7v7m0-7L10 14m-1-9H3v16h16v-6" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name] || paths.box}
    </svg>
  );
}

export function Brand({ light = false, compact = false }) {
  return (
    <span className={`bb-brand ${light ? "is-light" : ""}`}>
      <svg viewBox="0 0 36 36" fill="none" aria-hidden="true">
        <path
          d="M28 4H12a8 8 0 0 0-8 8v13a5 5 0 0 0 4 5v5l8-5h12a7 7 0 0 0 7-7V11a7 7 0 0 0-7-7Z"
          stroke="currentColor"
          strokeWidth="2.2"
        />
        <path
          d="m12 17 5 5 9-10"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {!compact && <span>BizBuddy</span>}
    </span>
  );
}
export function Button({
  children,
  variant = "primary",
  icon,
  className = "",
  busy = false,
  disabled = false,
  ...props
}) {
  return (
    <button
      className={`bb-btn bb-btn-${variant} ${className}`}
      disabled={busy || disabled}
      aria-busy={busy || undefined}
      {...props}
    >
      {busy ? (
        <span className="bb-spinner" aria-hidden="true" />
      ) : icon ? (
        <Icon name={icon} size={17} />
      ) : null}
      {children}
    </button>
  );
}
export function PageHeader({ title, description, children }) {
  return (
    <header className="bb-page-header">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children && <div className="bb-page-actions">{children}</div>}
    </header>
  );
}
export function Status({ children, tone = "neutral" }) {
  return (
    <span className={`bb-status bb-status-${tone}`}>
      <i />
      {children}
    </span>
  );
}
export function EmptyState({ icon = "box", title, description, action }) {
  return (
    <div className="bb-empty">
      <span className="bb-empty-icon">
        <Icon name={icon} size={27} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function LoadingPage() {
  return (
    <div className="bb-loading" role="status" aria-label="Loading workspace">
      <div className="bb-skeleton heading" />
      <div className="bb-skeleton subtitle" />
      <div className="bb-skeleton-grid">
        {[1, 2, 3, 4].map((n) => (
          <div className="bb-skeleton stat" key={n} />
        ))}
      </div>
      <div className="bb-skeleton panel" />
      <span className="bb-sr-only">Loading your workspace…</span>
    </div>
  );
}
export function InlineError({ children }) {
  return children ? (
    <div className="bb-alert bb-alert-error" role="alert">
      <Icon name="warning" size={20} />
      <span>{children}</span>
    </div>
  ) : null;
}
export function Modal({ title, description, children, onClose, size = "" }) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement;
    const panel = ref.current;
    const focusable = () => [
      ...panel.querySelectorAll(
        'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]',
      ),
    ];
    const initial =
      panel.querySelector('input:not([type="checkbox"]),textarea,select') ||
      focusable()[0];
    initial?.focus();
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function keydown(event) {
      if (event.key === "Escape") closeRef.current();
      if (event.key === "Tab") {
        const list = focusable();
        const first = list[0],
          last = list.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      document.body.style.overflow = oldOverflow;
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="bb-modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={ref}
        className={`bb-modal ${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
      >
        <header>
          <div>
            <h2 id={titleId}>{title}</h2>
            {description && <p id={descriptionId}>{description}</p>}
          </div>
          <button
            className="bb-icon-button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </header>
        <div className="bb-modal-body">{children}</div>
      </section>
    </div>
  );
}
export function Channel({ name, withLabel = true }) {
  const channels = {
    website: ["globe", "Website chat"],
    telegram: ["send", "Telegram"],
    email: ["mail", "Gmail"],
    gmail: ["mail", "Gmail"],
    whatsapp: ["message", "WhatsApp"],
    twilio_whatsapp: ["message", "WhatsApp"],
    sms: ["message", "SMS"],
    instagram: ["message", "Instagram"],
    messenger: ["message", "Messenger"],
  };
  const [icon, label] = channels[name?.toLowerCase()] || [
    "message",
    name || "Website chat",
  ];
  return (
    <span className={`bb-channel bb-channel-${name}`}>
      <Icon name={icon} size={17} />
      {withLabel && label}
    </span>
  );
}
export class ErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error) {
    console.error("Workspace render failed:", error);
  }
  render() {
    return this.state.failed ? (
      <div className="bb">
        <EmptyState
          icon="warning"
          title="This page needs a fresh start."
          description="Your saved records are safe. Reload the page to try again."
          action={
            <Button onClick={() => window.location.reload()}>
              Reload page
            </Button>
          }
        />
      </div>
    ) : (
      this.props.children
    );
  }
}
