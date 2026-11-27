import { useCallback, useEffect, useRef, useState } from "react";
import { request } from "./operationsApi";
import { BusinessContext } from "./businessContext";
import { Button, EmptyState, InlineError, LoadingPage } from "./components/ui";
import OverviewPage from "./pages/OverviewPage";
import InboxPage from "./pages/InboxPage";
import {
  InventoryPage,
  InvoicesPage,
  CustomersPage,
} from "./pages/BusinessDataPages";
import ConnectionsPage from "./pages/ConnectionsPage";
import AssistantPage from "./pages/AssistantPage";

export default function OperationsWorkspace({
  page,
  profile,
  setNotice,
  onNavigate,
  onBotChange,
}) {
  const [data, setData] = useState(null),
    [inbox, setInbox] = useState(null),
    [bot, setBot] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [engine, setEngine] = useState(null);
  const mounted = useRef(true);
  const locked = useRef(false);
  const refresh = useCallback(async () => {
    const [next, conversations, settings, provider] = await Promise.all([
      request("/operations"),
      request("/chatbot/dashboard"),
      request("/chatbot"),
      request("/assistant/engine"),
    ]);
    if (mounted.current) {
      setEngine(provider);
      setData(next);
      setInbox(conversations);
      setBot(settings);
      onBotChange?.(settings);
    }
  }, [onBotChange]);
  useEffect(() => {
    mounted.current = true;
    const load = () =>
      refresh().catch((e) => {
        if (mounted.current) setError(e.message);
      });
    load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible" && !locked.current) load();
    }, 15000);
    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
  }, [refresh]);
  async function action(fn, message) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      await fn();
      await refresh();
      if (message) setNotice(message);
    } catch (e) {
      setError(e.message);
      await refresh().catch(() => {});
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  if (!data || !inbox || !bot)
    return error ? (
      <EmptyState
        icon="warning"
        title="We couldn’t load this page."
        description={error}
        action={
          <Button
            onClick={() => {
              setError("");
              refresh().catch((e) => setError(e.message));
            }}
          >
            Try again
          </Button>
        }
      />
    ) : (
      <LoadingPage />
    );
  const content =
    page === "Atelier Dashboard" ? (
      <OverviewPage />
    ) : page === "Unified Concierge" ? (
      <InboxPage />
    ) : page === "Fabrics & Stock" ? (
      <InventoryPage />
    ) : page === "Invoices & Reminders" ? (
      <InvoicesPage />
    ) : page === "Client Profiles" ? (
      <CustomersPage />
    ) : ["Channels & Sync", "AI Chatbot Connection"].includes(page) ? (
      <ConnectionsPage />
    ) : (
      <AssistantPage />
    );
  return (
    <BusinessContext.Provider
      value={{
        data,
        engine,
        inbox,
        bot,
        profile,
        error,
        busy,
        action,
        refresh,
        onNavigate,
        setNotice,
      }}
    >
      <InlineError>{error}</InlineError>
      {content}
    </BusinessContext.Provider>
  );
}
