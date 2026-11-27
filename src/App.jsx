import { useCallback, useEffect, useRef, useState } from "react";
import LandingPage from "./LandingPage";
import DemoWorkspace from "./demo/DemoWorkspace";
import AuthPage from "./pages/AuthPage";
import OperationsWorkspace from "./OperationsWorkspace";
import LiveTwilioWorkspace from "./LiveTwilioWorkspace";
import { OrdersPage, SettingsPage, PlanPage } from "./pages/AccountPages";
import {
  Brand,
  Button,
  EmptyState,
  ErrorBoundary,
  Icon,
  LoadingPage,
  Modal,
} from "./components/ui";
import { initials } from "./components/format";
import { request } from "./operationsApi";
import "./App.css";
import "./Workspace.css";
import "./Professional.css";
import "./Brand.css";

const pages = [
  {
    slug: "",
    label: "Overview",
    code: "Atelier Dashboard",
    icon: "home",
    group: "Workspace",
  },
  {
    slug: "inbox",
    label: "Unified inbox",
    code: "Unified Concierge",
    icon: "message",
    group: "Workspace",
  },
  {
    slug: "demo",
    label: "Messages demo",
    code: "Messages demo",
    icon: "sparkle",
    group: "Workspace",
  },
  {
    slug: "orders",
    label: "Orders",
    code: "Client Orders",
    icon: "box",
    group: "Workspace",
  },
  {
    slug: "customers",
    label: "Customers",
    code: "Client Profiles",
    icon: "users",
    group: "Workspace",
  },
  {
    slug: "inventory",
    label: "Inventory",
    code: "Fabrics & Stock",
    icon: "stock",
    group: "Workspace",
  },
  {
    slug: "invoices",
    label: "Invoices",
    code: "Invoices & Reminders",
    icon: "invoice",
    group: "Workspace",
  },
  {
    slug: "connections",
    label: "Connections",
    code: "Channels & Sync",
    icon: "link",
    group: "Management",
  },
  {
    slug: "assistant",
    label: "Assistant",
    code: "AI Atelier Tone",
    icon: "sparkle",
    group: "Management",
  },
  {
    slug: "twilio",
    label: "WhatsApp & SMS",
    code: "Twilio Messaging",
    icon: "message",
    group: "Management",
  },
  {
    slug: "settings",
    label: "Settings",
    code: "My Profile",
    icon: "settings",
    group: "Management",
  },
  {
    slug: "plan",
    label: "Workspace plan",
    code: "Pricing",
    icon: "card",
    group: "Management",
  },
];
const pathFor = (slug) => "/dashboard" + (slug ? "/" + slug : "");

export default function App() {
  const [route, setRoute] = useState(
    () => window.location.pathname + window.location.search,
  );
  const [token, setToken] = useState(() =>
    sessionStorage.getItem("bizbuddyToken"),
  );
  const [profile, setProfile] = useState(null);
  const [bot, setBot] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [drawer, setDrawer] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const sidebarRef = useRef(null);
  const navigate = useCallback((path) => {
    window.history.pushState({}, "", path);
    setRoute(path);
    setDrawer(false);
    setNotice("");
    window.scrollTo(0, 0);
  }, []);
  const navigatePage = useCallback(
    (value) => {
      const page = pages.find((p) => p.slug === value || p.code === value);
      navigate(pathFor(page?.slug ?? ""));
    },
    [navigate],
  );
  useEffect(() => {
    function pop() {
      setRoute(window.location.pathname + window.location.search);
      setDrawer(false);
    }
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  useEffect(() => {
    if (!token) return;
    let active = true;
    Promise.all([request("/profile"), request("/chatbot")])
      .then(([account, settings]) => {
        if (active) {
          setProfile(account);
          setBot(settings);
          setLoadError("");
        }
      })
      .catch((error) => {
        if (active) {
          if (error.status === 401) {
            sessionStorage.removeItem("bizbuddyToken");
            setToken(null);
            navigate("/signin");
          } else setLoadError(error.message);
        }
      });
    return () => {
      active = false;
    };
  }, [token, navigate]);
  useEffect(() => {
    function keyboard(event) {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "k" &&
        token
      ) {
        event.preventDefault();
        setSearchOpen((open) => !open);
      }
      if (event.key === "Escape") setDrawer(false);
    }
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  }, [token]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6500);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (!drawer) return;
    const previous = document.activeElement;
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const items = () => [
      ...sidebarRef.current.querySelectorAll("a[href],button:not([disabled])"),
    ];
    items()[0]?.focus();
    function trap(event) {
      if (event.key !== "Tab") return;
      const list = items();
      if (event.shiftKey && document.activeElement === list[0]) {
        event.preventDefault();
        list.at(-1)?.focus();
      } else if (!event.shiftKey && document.activeElement === list.at(-1)) {
        event.preventDefault();
        list[0]?.focus();
      }
    }
    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      document.body.style.overflow = before;
      previous?.focus();
    };
  }, [drawer]);
  useEffect(() => {
    function expired() {
      sessionStorage.removeItem("bizbuddyToken");
      setToken(null);
      setProfile(null);
      navigate("/signin");
    }
    window.addEventListener("bizbuddy-session-expired", expired);
    return () =>
      window.removeEventListener("bizbuddy-session-expired", expired);
  }, [navigate]);
  async function authenticate(values, registering) {
    const result = await request(
      registering ? "/auth/register" : "/auth/signin",
      values,
    );
    sessionStorage.setItem("bizbuddyToken", result.token);
    setProfile(result.user);
    setToken(result.token);
    navigate("/dashboard");
  }
  async function logout() {
    try {
      await request("/auth/signout", {});
    } finally {
      sessionStorage.removeItem("bizbuddyToken");
      setToken(null);
      setProfile(null);
      navigate("/signin");
    }
  }
  const pathname = route.split("?")[0];
  const slug = pathname.replace(/^\/dashboard\/?/, "").replace(/\/$/, "");
  const page =
    pages.find((p) => p.slug === slug) ||
    (["/", "/signin", "/register"].includes(pathname) ? pages[0] : null);
  useEffect(() => {
    document.title =
      pathname === "/demo"
        ? "Interactive messages demo · BizBuddy"
        : pathname === "/"
          ? "BizBuddy — Business, in better order"
          : `${!token ? (pathname === "/register" ? "Create account" : "Sign in") : page?.label || "Page not found"} · BizBuddy`;
  }, [pathname, token, page]);
  if (pathname === "/")
    return (
      <LandingPage
        navigateAuth={(value) =>
          navigate(
            {
              landing: "/",
              signin: "/signin",
              register: "/register",
              demo: "/demo",
            }[value],
          )
        }
      />
    );
  if (pathname === "/demo") return <DemoWorkspace onNavigate={navigate} />;
  if (!token)
    return (
      <AuthPage
        key={pathname}
        mode={pathname === "/register" ? "register" : "signin"}
        onNavigate={navigate}
        onAuthenticate={authenticate}
      />
    );
  if (!page)
    return (
      <div className="bb">
        <EmptyState
          icon="search"
          title="This page isn’t in your workspace."
          description="Head back to your overview to continue."
          action={
            <Button onClick={() => navigate("/dashboard")}>
              Back to overview
            </Button>
          }
        />
      </div>
    );
  return (
    <ErrorBoundary>
      <div className="bb bb-workspace">
        <a className="bb-skip" href="#workspace-content">
          Skip to main content
        </a>
        {drawer && (
          <button
            className="bb-drawer-scrim"
            aria-label="Close navigation"
            onClick={() => setDrawer(false)}
          />
        )}
        <aside
          ref={sidebarRef}
          role={drawer ? "dialog" : undefined}
          aria-modal={drawer ? true : undefined}
          aria-label={drawer ? "Workspace menu" : undefined}
          className={`bb-sidebar ${drawer ? "is-open" : ""}`}
        >
          <a
            className="bb-sidebar-brand"
            href="/dashboard"
            onClick={(e) => {
              e.preventDefault();
              navigate("/dashboard");
            }}
          >
            <Brand />
          </a>
          <button
            className="bb-icon-button bb-drawer-close"
            aria-label="Close workspace menu"
            onClick={() => setDrawer(false)}
          >
            <Icon name="close" size={18} />
          </button>
          <button
            className="bb-business-switch"
            onClick={() => navigatePage("settings")}
          >
            <span className="bb-business-avatar">
              {initials(profile?.business)}
            </span>
            <span>
              <strong>{profile?.business || "Your business"}</strong>
              <small>Your workspace</small>
            </span>
            <Icon name="chevron" size={16} />
          </button>
          <nav aria-label="Workspace navigation">
            {["Workspace", "Management"].map((group) => (
              <div className="bb-nav-group" key={group}>
                <p>{group}</p>
                {pages
                  .filter((p) => p.group === group)
                  .map((p) => (
                    <a
                      key={p.slug}
                      href={pathFor(p.slug)}
                      aria-current={page.slug === p.slug ? "page" : undefined}
                      className={page.slug === p.slug ? "is-active" : ""}
                      onClick={(e) => {
                        e.preventDefault();
                        navigate(pathFor(p.slug));
                      }}
                    >
                      <Icon name={p.icon} size={19} />
                      <span>{p.label}</span>
                      {page.slug === p.slug && (
                        <span className="bb-nav-indicator" />
                      )}
                    </a>
                  ))}
              </div>
            ))}
          </nav>
          <div className="bb-sidebar-footer">
            <button
              className="bb-sidebar-owner"
              onClick={() => navigatePage("settings")}
            >
              <span className="bb-avatar">{initials(profile?.name)}</span>
              <span>
                <strong>{profile?.name || "Your account"}</strong>
                <small>Account settings</small>
              </span>
              <Icon name="chevron" size={16} />
            </button>
            <button className="bb-signout" onClick={logout}>
              <Icon name="logout" size={18} />
              Sign out
            </button>
          </div>
        </aside>
        <div className="bb-main" inert={drawer ? true : undefined}>
          <header className="bb-topbar">
            <div className="bb-topbar-left">
              <button
                className="bb-icon-button bb-menu-toggle"
                aria-label={drawer ? "Close navigation" : "Open navigation"}
                aria-expanded={drawer}
                onClick={() => setDrawer(!drawer)}
              >
                <Icon name="menu" />
              </button>
              <span className="bb-breadcrumb">
                Workspace <span>/</span> <strong>{page.label}</strong>
              </span>
            </div>
            <div className="bb-topbar-actions">
              <button
                className="bb-search-trigger"
                aria-label="Search workspace"
                onClick={() => setSearchOpen(true)}
              >
                <Icon name="search" size={18} />
                <span>Find a page</span>
                <kbd>⌘ K</kbd>
              </button>
              <Button
                variant="secondary"
                icon="message"
                className="bb-chat-link"
                onClick={() => {
                  if (
                    bot?.enabled &&
                    bot.website_domain === window.location.origin
                  )
                    window.open(
                      "/chat/" + bot.public_id,
                      "_blank",
                      "noopener,noreferrer",
                    );
                  else navigatePage("connections");
                }}
              >
                {bot?.enabled ? "View customer chat" : "Set up chat"}
              </Button>
              <Button
                icon="plus"
                onClick={() => navigate("/dashboard/orders?new=1")}
              >
                New order
              </Button>
              <button
                className="bb-avatar bb-top-avatar"
                aria-label="Open account settings"
                onClick={() => navigatePage("settings")}
              >
                {initials(profile?.name)}
              </button>
            </div>
          </header>
          <main id="workspace-content" className="bb-content" tabIndex={-1}>
            <div key={page.slug} className="bb-page-enter">
              {loadError ? (
                <EmptyState
                  icon="warning"
                  title="We couldn’t load your workspace."
                  description={loadError}
                  action={
                    <Button onClick={() => window.location.reload()}>
                      Try again
                    </Button>
                  }
                />
              ) : !profile ? (
                <LoadingPage />
              ) : page.slug === "orders" ? (
                <OrdersPage
                  key={route}
                  openNew={new URLSearchParams(route.split("?")[1]).has("new")}
                  setNotice={setNotice}
                />
              ) : page.slug === "settings" ? (
                <SettingsPage
                  profile={profile}
                  setProfile={setProfile}
                  setNotice={setNotice}
                />
              ) : page.slug === "plan" ? (
                <PlanPage onNavigate={navigatePage} />
              ) : page.slug === "demo" ? (
                <DemoWorkspace
                  embedded
                  onNavigate={navigatePage}
                  onExit={() => navigatePage("inbox")}
                />
              ) : page.slug === "twilio" ? (
                <LiveTwilioWorkspace setNotice={setNotice} />
              ) : (
                <OperationsWorkspace
                  key={page.code}
                  page={page.code}
                  profile={profile}
                  setNotice={setNotice}
                  onNavigate={navigatePage}
                  onBotChange={setBot}
                />
              )}
            </div>
          </main>
          <footer className="bb-workspace-footer">
            <span>BizBuddy</span>
            <span>Every chat. One inbox. Done for you.</span>
          </footer>
        </div>
        <nav className="bb-mobile-nav" aria-label="Mobile workspace navigation">
          {pages
            .filter((p) => ["", "inbox", "orders", "invoices"].includes(p.slug))
            .map((p) => (
              <a
                href={pathFor(p.slug)}
                key={p.slug}
                aria-current={page.slug === p.slug ? "page" : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(pathFor(p.slug));
                }}
              >
                <Icon name={p.icon} size={20} />
                <span>{p.slug === "inbox" ? "Inbox" : p.label}</span>
              </a>
            ))}
          <button
            aria-label="More workspace pages"
            onClick={() => setDrawer(true)}
          >
            <Icon name="menu" size={20} />
            <span>More</span>
          </button>
        </nav>
        {notice && (
          <div className="bb-toast" role="status">
            <Icon name="circleCheck" size={20} />
            <span>{notice}</span>
            <button
              aria-label="Dismiss notification"
              onClick={() => setNotice("")}
            >
              <Icon name="close" size={17} />
            </button>
          </div>
        )}
        {searchOpen && (
          <Modal
            title="Find a page"
            onClose={() => {
              setSearchOpen(false);
              setQuery("");
            }}
          >
            <div className="bb-search-field">
              <Icon name="search" size={20} />
              <input
                aria-label="Search pages"
                placeholder="Search your workspace…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="bb-command-results">
              {pages
                .filter((p) =>
                  p.label.toLowerCase().includes(query.toLowerCase()),
                )
                .map((p) => (
                  <button
                    key={p.slug}
                    onClick={() => {
                      navigate(pathFor(p.slug));
                      setSearchOpen(false);
                      setQuery("");
                    }}
                  >
                    <Icon name={p.icon} />
                    {p.label}
                    <Icon name="arrow" size={17} />
                  </button>
                ))}
              {!pages.some((p) =>
                p.label.toLowerCase().includes(query.toLowerCase()),
              ) && <p>No pages match “{query}”.</p>}
            </div>
          </Modal>
        )}
      </div>
    </ErrorBoundary>
  );
}
