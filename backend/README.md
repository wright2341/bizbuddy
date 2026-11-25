# BizBuddy Backend

FastAPI backend for the BizBuddy atelier dashboard.

## Connect to XAMPP MySQL

Start MySQL in the XAMPP Control Panel and make sure the `bizbuddy` database exists.
The backend defaults to the standard local XAMPP connection (`root`, no password,
port `3306`). If your MySQL credentials or port differ, create a `.env` file in
this folder and set:

```env
DATABASE_URL=mysql+pymysql://root:YOUR_PASSWORD@127.0.0.1:3306/bizbuddy
```

URL-encode special characters in the password. On startup, the backend creates
the account, session, and order tables if they do not exist. Accounts and orders
are kept separate by user; no demo orders are seeded.

## Enable the AI concierge

Copy `.env.example` to `.env` in this folder and replace the placeholder with
your OpenAI API key. Keep the key in the backend only; never put it in React or
commit `.env`. The concierge sends the conversation, business name/category,
and up to 10 recent orders' fabric, quantity, and status to OpenAI. It does not
send client names or payment amounts.

## Run

```powershell
cd my-app/backend
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

API documentation is available at `http://127.0.0.1:8000/docs`.

Run the React app in a second terminal from `my-app` with `npm run dev`. Vite
proxies `/api` requests to the backend at `http://127.0.0.1:8000`.
