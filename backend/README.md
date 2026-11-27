# BizBuddy API

See the root README for the complete workflow, channel limitations and hosting.
The default database is `backend/bizbuddy.db`; tables are created automatically.
The free grounded reply engine runs without an API key. Existing MySQL and
OpenAI integrations remain optional.

## Configuration

`backend/.env` is loaded independently of the current working directory.

- `PUBLIC_API_URL`: public origin, currently `https://bizbuddy.naijatown.app`.
- `CHATBOT_ENCRYPTION_KEY`: stable Fernet key for encrypted provider credentials.
- `DATABASE_URL`: optional SQLite/MySQL override.
- `OPENAI_API_KEY` / `OPENAI_MODEL`: optional paid reply engine.
- `META_WEBHOOK_VERIFY_TOKEN`: required only for official Meta integrations.

Generate an encryption key once and save it privately in `.env`:

```sh
.venv/bin/python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
chmod 600 .env
```

The installed live service already has its own generated encryption key.
Production releases keep using the original `.env` and database; see the root
README and `ops/update.py` for automatic deployment and rollback.
Do not replace that key after connecting accounts.

```sh
.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
```

## Live integrations

Telegram validates the token and registers its HTTPS webhook. Gmail uses IMAP
and SMTP over TLS with a dedicated inbox and Google app password. Incoming email
passes through the same inbox/order pipeline, but generated replies remain
unsent drafts. Explicit approval is required before Gmail sends a reply. Invoice
emails can also be reviewed, then explicitly sent through connected Gmail, or
exported as `.eml` drafts without an email connection.

Web chat checks its configured origin and uses unpredictable conversation IDs.
External credentials are encrypted and are never returned by dashboard APIs.
Twilio and Meta validate webhook signatures. Public chat/auth endpoints have
per-IP request limits. Owner APIs require bearer authentication and scope all
records to the owner.

The scheduler runs inside the single API worker every minute. It prepares
reminders only for confirmed, unpaid, overdue invoices, avoids duplicate/pending
reminders, stores daily summaries and syncs connected Gmail inboxes. Owners can explicitly
opt in to one daily summary over connected Telegram/Gmail at a selected UTC hour;
dashboard-only delivery is the default. Automatic
proactive Meta messaging is disabled in the reminder workflow to avoid violating
provider template/reply-window rules. Gmail/Telegram delivery requires actual
account credentials; repository tests mock these external transports.

Use one API worker for this SQLite MVP. For multiple workers or higher volume,
move scheduling and delivery to a durable queue and use database-level delivery
claims. Delivery timeouts are marked uncertain, never retried automatically.
