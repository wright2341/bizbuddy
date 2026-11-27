# BizBuddy

A small-business back office built from `BizBuddy_Project_Explanation.pdf`.
React/Vite frontend, FastAPI backend, persistent SQLite database. No paid API key,
cloud database, XAMPP or automation subscription is required.

## Use the application

Live URL: https://bizbuddy.naijatown.app

1. Create an account. Each account has its own records.
2. **Fabrics & Stock**: enter products, NGN prices, quantities and low-stock thresholds.
3. **AI Chatbot Connection**: save opening hours/policies and verified FAQs, then
   enable website chat. Share the generated customer chat link.
4. **Unified Concierge**: review real conversations and handoffs, reply as owner,
   and confirm order requests by selecting a product and quantity. Confirmation
   creates an order and reduces stock atomically; repeated confirmation is rejected.
5. **Invoices & Reminders**: create and confirm invoices. Review the email draft.
   Overdue confirmed invoices produce reminder drafts, never unsolicited automatic
   sends. Choose the original web/Telegram/email conversation for reminders.
   Marking an invoice paid cancels pending drafts.
6. **Atelier Dashboard**: see today's requests by channel, outstanding invoices,
   handoffs and low stock. Summaries are saved by date and refreshed every minute.
   Optionally schedule one owner summary per day over connected Telegram or Gmail
   from AI Chatbot Connection; delivery defaults to dashboard only.
7. **Client Profiles**: explicitly link verified customer identities across channels.

The default assistant is a deterministic knowledge engine, **not a hosted LLM**.
It quotes saved facts and hands off unsupported/ambiguous questions. An existing
OpenAI integration remains optional; it is not required or configured by default.

## Channels and costs

| Channel | Setup | Delivery |
| --- | --- | --- |
| Website chat | Click Enable website chat | Live, no external account |
| Telegram | Paste a BotFather bot token | Official free Bot API; webhook registered automatically |
| Gmail | Dedicated inbox + Google app password | Unread plain-text sync every minute; replies require approval; threads preserved |
| Email without Gmail | No account connection | Download `.eml` drafts and send with your own email app |
| Twilio SMS / WhatsApp | Account SID, auth token and sender | Live unified-inbox connector; provider charges and sandbox opt-in apply |
| Instagram / Facebook / Meta WhatsApp | Meta account credentials and app approval | Existing official backend endpoints; not preconnected or simulated as live |

Google app passwords require two-step verification and may be unavailable for some
managed/protected accounts: https://support.google.com/accounts/answer/185833.
Telegram: https://core.telegram.org/bots/.
Gmail TLS settings: https://developers.google.com/workspace/gmail/imap/imap-smtp.

Email attachments, payment processing and automatic stock reordering are outside
this MVP. Gmail sync checks up to 20 recent unread, small plain-text messages per
run; use a dedicated project inbox. Do not represent mocked provider tests as
verified delivery from a real account.

## Local development

Requires Python 3.10+ and Node 22+.

```sh
python3 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements.txt
npm ci
```

For web chat locally, set `PUBLIC_API_URL=http://localhost:5173` in `backend/.env`.
No `.env` is needed for basic authentication, inventory or invoices. External
channel credentials require a stable Fernet encryption key (see backend README).

Run in separate terminals:

```sh
cd backend
.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
```

```sh
npm run dev
```

Vite proxies `/api` and `/chatbot-widget.js` to the loopback API. The database is
`backend/bizbuddy.db` unless `DATABASE_URL` overrides it. Credentials and database
files are excluded from git and denied by Vite's filesystem rules.

## Verification

```sh
npm run lint
npm run build
python3 ops/test_gateway.py
python3 ops/test_update.py
backend/.venv/bin/python -W ignore -m unittest discover -s backend -p 'test_*.py'
```

Tests use isolated databases and mocked provider transports. They cover twenty
customer questions, unsafe/unknown-answer handoff, stock updates, duplicate order
confirmation, owner isolation, reminder idempotency, paid-invoice cancellation,
Gmail draft approval/threading/deduplication, once-daily summary delivery,
customer linking, and Twilio webhook signatures/unified inbox capture.
Browser QA additionally exercised account creation → inventory → public chat →
owner reply → invoice → reminder → payment, on desktop and mobile.

## VPS hosting and automatic updates

Caddy's configuration and `/opt/naijatown` are unchanged. The production gateway
serves compiled assets at the existing `172.18.0.1:5173` upstream and proxies the
API to `127.0.0.1:8000`. Both services start automatically at boot.

**Push to GitHub `main` to update the website.** `bizbuddy-update.timer` checks
`origin/main` every minute (plus up to five seconds of jitter), then:

1. Exports the commit into an isolated release under `/var/lib/bizbuddy/releases`.
2. Installs dependencies only when the lockfile/requirements change; insufficient
   disk space or failed installs leave the current site running.
3. Runs lint, build, backend tests, gateway HTTP tests, rollback safety tests and an isolated API startup check.
4. Takes a private SQLite snapshot, switches the active release atomically and
   restarts only BizBuddy's API. The static frontend remains available.
5. Restores the previous code release if activation fails. Three recent releases
   and seven database snapshots are retained. Old hashed assets remain available
   for already-open browser tabs. Gateway code changes also restart its service.

Local edits and other Git branches are not deployed. The source checkout is not
reset or overwritten: deployments use Git archives. The live database and `.env`
remain in `/home/vangaard/bizbuddy/backend`; they are never fetched from GitHub.
The public `/__deployment` endpoint reports the active commit.

```sh
sudo systemctl status bizbuddy-web bizbuddy-api bizbuddy-update.timer
sudo journalctl -u bizbuddy-update -n 80 --no-pager
sudo systemctl start bizbuddy-update.service  # Check GitHub immediately
```

Initial VPS setup (already performed here):

```sh
bash ops/install-update.sh
```

The updater runs as `vangaard` using that account's configured GitHub credentials.
Its sudo rule permits only restarting the two named BizBuddy services. Root-owned
systemd/sudoers changes and changes to the updater itself require rerunning the
installer from a reviewed checkout; regular application changes deploy automatically.

Manual rollback to a retained, validated commit:

```sh
python3 ops/update.py --no-fetch --ref PREVIOUS_COMMIT_SHA
```

Stop the update timer first when keeping a rollback active; otherwise the next
check redeploys GitHub main. Database backups are **not** restored automatically,
so an incompatible future schema migration needs a deliberate recovery plan.
Never commit the database, `.env`, credentials or private snapshots.

### Professional workspace and presentation demo

The landing page retains its signature imagery and composition, with the shared
visual refinements described in DESIGN.md. Sign-in, registration, workspace
navigation, inventory, orders, customers, invoices, connections,
assistant settings and public customer chat use a responsive shared design system.
Direct links under `/dashboard/` support browser history and refresh.

Open `/demo` without an account to explore the original upstream example
conversations, simulated replies, order confirmation, invoice reminders and daily
summary. Demo actions stay in browser session storage: they send no messages and
change no real business records. The inbox also offers these examples explicitly.
Real messaging channels still require the provider credentials shown in Connections;
website chat and the default rules assistant work without a paid AI API.

Stack: React 19 (JavaScript/JSX), Vite 8, custom CSS, self-hosted DM Sans and Plus
Jakarta Sans; FastAPI, Uvicorn, SQLAlchemy and SQLite (optional MySQL), bearer
sessions and Fernet-protected credentials; Node HTTP gateway, Caddy, systemd and
GitHub polling deployments. Integrations support Telegram, Gmail, Twilio and Meta;
OpenAI is optional. No new paid service or account is needed for this redesign.

Research, pinned upstream provenance and design decisions are recorded in
[the research notes](design-system/bizbuddy/RESEARCH.md) and
[the design system](design-system/bizbuddy/MASTER.md). Design references are saved
alongside those documents. Actual screens preserve the references' typography,
nav geometry, navy/teal palette, card hierarchy and mobile conversation layout;
real data, explicit simulation labels and supported actions take precedence over
illustrative values and controls in the references.

Run `npm run test:e2e` for isolated browser regression tests. The configuration
starts a separate API/database and Vite server; it rejects non-local test targets.
Install Playwright Chromium first with `npx playwright install chromium --only-shell`.
Optional `BIZBUDDY_AXE_PATH=/absolute/path/to/axe.min.js` enables accessibility
checks in the business workflow suite. Browser tests cover authentication,
inventory, chat, order/stock updates, invoices, customer linking, settings,
keyboard navigation and mobile layouts; the demo suite verifies zero API writes.

The workspace also includes a setup checklist driven by actual catalogue,
policy and channel settings, plus recent customer conversations. The customer
chat offers suggested questions, a visible sending state, guarded message
scrolling and a mobile composer that follows the visual viewport.

### Embedded OpenCode AI

The optional server-side bridge uses the official `@opencode/sdk` **2.4.2**,
not the desktop application or CLI. Its dependencies are isolated under
`ai/opencode/` and installed at `/var/lib/bizbuddy/opencode-2.4.2` on this VPS.
Use `bash ops/install-opencode.sh` to install the pinned runtime on another setup
with sufficient free disk space; ordinary website updates reuse it.

Server-only `.env` settings:

```dotenv
BIZBUDDY_AI_PROVIDER=opencode
OPENCODE_RUNTIME_DIR=/var/lib/bizbuddy/opencode-2.4.2
OPENCODE_MODEL=deepseek-v4.1-flash-free
OPENCODE_STATE_DIR=/home/vangaard/bizbuddy/backend/.opencode-workspace
```

The API launches a private stdio worker; no new public port or Caddy route is
needed. Only SDK text generation is called, with tools denied, project
configuration disabled and customer sessions removed after each generation.
Credentials for other providers and the database are not passed to the worker.
The configured model must appear in the SDK catalogue with zero prices; there
is no automatic paid-model fallback. DeepSeek V4.1 Flash Free and Hy4 Flash Free
are the supported model IDs, based on OpenCode's documented retention policies.

Free models have provider quotas and can disappear. OpenCode now documents that
free-tier chat models require OpenCode, while other clients need paid access.
On this VPS the SDK probe returned **Free usage limit reached**; the broad error
does not establish a daily reset time and may reflect that client restriction.
BizBuddy automatically falls back to its existing
fact-based replies on quota limits, invalid output, missing runtime or timeouts,
with a five-minute cooldown. Order capture and sensitive payment checks remain
deterministic. Assistant settings show the current provider/fallback state.
The first request after a cooldown can take up to 25 seconds if the provider
stalls. Requests arriving while the worker is occupied use fact-based replies.

Sources: [OpenCode SDK](https://opencode.ai/docs/build/sdk/),
[model access, pricing and privacy](https://opencode.ai/docs/console/models/).

The landing page, sign-in and business workspace now share the violet, lavender
and lime visual identity defined in [DESIGN.md](DESIGN.md). The menu and business
flows retain their existing structure. Shared brand roles live in `src/Brand.css`;
active workspace styles reference those roles instead of separate navy/teal colors.
The landing retains its signature image and composition, with clearer typography,
consistent branding and a direct link to the messages demo.

### Sign in with ChatGPT (self-hosted installation)

BizBuddy can use an explicitly authorized ChatGPT Plus/Pro plan through the
[official open-source Sign in with ChatGPT flow](https://developers.openai.com/siwc/token-sharing-open-source).
It does not require an OpenAI API key and never switches to API billing if the
plan is unavailable. GPT-6-Luna must appear in the connected account's model
catalog; otherwise the application shows `model_unavailable` and uses saved facts.

The administrator must complete the browser sign-in once. The callback is
loopback-only, as required by the official flow. On your own computer, open an SSH
connection to this VPS with local forwarding (replace `YOUR_VPS_SSH_HOST` with the
same host/IP you normally use for SSH):

```sh
ssh -L 1455:127.0.0.1:1455 vangaard@YOUR_VPS_SSH_HOST
```

In that SSH terminal:

```sh
cd /home/vangaard/bizbuddy
bash ops/connect-chatgpt.sh
```

Open the printed authorization URL in your computer's browser, sign in, and
explicitly allow ChatGPT plan usage for **BizBuddy**. The callback goes through
the SSH tunnel. The helper validates PKCE/state and the signed ID token's issuer,
audience, expiration and nonce, verifies granted scopes, and lists account models.
The setup script then verifies a real GPT-6-Luna response, saves configuration and
restarts only the BizBuddy API. It prints neither credentials nor provider error bodies. Do not paste credentials
or callback URLs into chat. No Caddy route, public callback, or full OpenCode
application is needed.

Server configuration:

```dotenv
BIZBUDDY_AI_PROVIDER=chatgpt
CHATGPT_MODEL=gpt-6-luna
CHATGPT_CREDENTIALS_FILE=/home/vangaard/bizbuddy/backend/.chatgpt/credentials.json
```

Credentials are stored atomically with owner-only permissions, outside releases
and Git. This deployment runs one API worker, which owns serialized refreshes.
Inference uses the documented public Responses endpoint with the OAuth token,
`store:false`, `stream:true`, an account-listed model, a bounded deadline, and
strict reply validation. An interrupted or failed stream never counts as success.
Customer order confirmation and payment decisions remain controlled by the owner.
ChatGPT usage can be managed at https://chatgpt.com/settings/usage.

This configuration is for the owner's self-hosted open-source installation.
Offering ChatGPT plan usage as a remotely hosted service for other businesses
requires following OpenAI's separate partner onboarding; this is not implemented
by registering visitors under the administrator's ChatGPT identity. See the
[VM guide](https://developers.openai.com/siwc/token-sharing-open-source/self-hosted-vms).

### Product scope from the project PDF

`BizBuddy_Project_Explanation.pdf` defines an AI back-office for small businesses:
channel connectors normalize messages into one inbox, a shared assistant answers
from business data and hands off uncertain requests, orders are captured, overdue
invoices receive approved follow-ups, and a daily summary reports orders by
channel, outstanding money and low stock. Email replies begin as owner-reviewed
drafts. The MVP permits WhatsApp sandbox and Meta test/simulated channels and calls
for honest presentation of those limits. Its light-code option explicitly permits
FastAPI/Node and SQLite; Claude is its proposed model, replaced here by the owner's
requested ChatGPT plan connection. Accounts and the full dashboard extend the
PDF's original MVP scope.

### Merchant onboarding and AI connections

New registrations open `/dashboard/setup`: choose a reply engine, save business
knowledge, test a supported answer, and activate a real website chat. Owners can
skip, resume or revisit setup. Activation requires a passing answer against the
current knowledge; edits invalidate that test. A saved-fact reply is labeled as
such, rather than presented as model-generated text.

`/dashboard/assistant` and `/dashboard/plan` expose the per-business AI connection.
Owners can connect OpenAI, Groq or Gemini, load model IDs, verify a real synthetic
response, select a monthly request cap, and remove or switch the connection.
The key is encrypted using the existing `CHATBOT_ENCRYPTION_KEY`, never returned
by settings endpoints, and never accepted as a custom upstream URL. A failed
verification preserves the previous connection. Provider charges belong to the
merchant; the request cap is not a monetary spending limit.

The shared reply pipeline selects the merchant's configuration for website,
Telegram, approved email drafts and other connected channels. Successful model
requests and in-flight reservations are counted by owner/source/UTC month in
`merchant_ai_requests`; failures release reservations, and crashed reservations
expire after 60 seconds. The current VPS uses one API process; serialization is
in-process. A future multi-process deployment needs a database-level reservation
lock/counter before scaling workers. No customer prompt, response or API key is
stored in the usage ledger.

The current installation is a testing prototype: `BIZBUDDY_PROTOTYPE_MODE=true`
makes the configured managed model available to every account, with new settings
selecting managed AI by default. All accounts use the Free plan with a hard cap
of 100 successful/in-flight managed requests per UTC calendar month, independent
of other accounts. Assistant tests share that allowance; failures do not consume
it. Higher launch-tier allowances are not active.

After enabling the flag on an existing installation, run the deployed Python
interpreter with `ops/enable-prototype-ai.py` and the existing `DATABASE_URL` to
switch current accounts to managed AI. This explicit rollout preserves saved keys,
usage, business data and paused chat settings; rerunning it does not reset quotas.
Owners can still choose their own key or saved facts afterward. Outside prototype
mode, the existing owner allowlist/provisioned managed-access gates apply.

`/pricing` and the workspace plan share the `/api/plans` catalogue: Free, Starter
(NGN 5,000/month), Growth (NGN 15,000/month), and Business (NGN 35,000/month).
Annual pricing charges ten monthly payments upfront; the period switch shows
the full yearly charge and savings. Paid prices and larger managed-AI allowances
are launch previews. Checkout and subscription charges remain disabled; starting
free does not grant paid entitlements or change existing managed-AI request caps.
Provider costs are separate. Research and scope: `docs/product-gap-review.md`.

### Order and inventory consistency

Pending customer requests retain their original text and a snapshot of any
explicitly named catalogue items (name, description and unit price). New fields
are added without inventing details for older requests. A changed/replacement
item, or an older request without a snapshot, requires an explicit owner review
before confirmation. Confirmed and manually entered orders remain independent
copies of the details agreed at creation time.

Inventory responses include two opaque revisions. Order confirmation submits
`expected_version` from the current product plus `reviewed_changes` where the
original request differs; stale forms receive HTTP 409 without creating an order
or changing stock. Inventory updates submit `expected_edit_version` from
`edit_version`, which also covers stock and thresholds, so an old editor cannot
overwrite an intervening sale or restock. Reload/reopen the product after a 409.
