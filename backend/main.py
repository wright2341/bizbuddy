import hashlib
import hmac
import os
import secrets
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from typing import Literal, Optional
from uuid import uuid4

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from openai import APIConnectionError, APIStatusError, AsyncOpenAI, RateLimitError
from pydantic import BaseModel, EmailStr, Field, model_validator
from sqlalchemy import DateTime, ForeignKey, Integer, String, create_engine, inspect, select, text
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column
from google import genai
from google.genai import types

load_dotenv()

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "mysql+pymysql://root:@127.0.0.1:3306/bizbuddy",
)
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
)
bearer_scheme = HTTPBearer(auto_error=False)
SESSION_TTL = timedelta(days=30)
PASSWORD_ITERATIONS = 310_000


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    phone: Mapped[str] = mapped_column(String(64), default="")
    business: Mapped[str] = mapped_column(String(255), default="")
    role: Mapped[str] = mapped_column(String(128), default="")
    location: Mapped[str] = mapped_column(String(255), default="")
    category: Mapped[str] = mapped_column(String(128), default="")


class AuthSession(Base):
    __tablename__ = "auth_sessions"

    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime)


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    owner_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    channel: Mapped[str] = mapped_column(String(64))
    vip: Mapped[str] = mapped_column(String(128))
    cuts: Mapped[str] = mapped_column(String(255))
    material: Mapped[str] = mapped_column(String(255))
    yards: Mapped[str] = mapped_column(String(64))
    amount: Mapped[str] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(64))
    status_class: Mapped[str] = mapped_column(String(64))
    time: Mapped[str] = mapped_column(String(255))


class RegisterRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    business: str = Field(min_length=1, max_length=255)
    category: str = Field(default="", max_length=128)


class SignInRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class ProfileUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    email: EmailStr
    phone: str = Field(max_length=64)
    business: str = Field(min_length=1, max_length=255)
    role: str = Field(max_length=128)
    location: str = Field(max_length=255)


class OrderCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    channel: str = Field(min_length=1, max_length=64)
    cuts: str = Field(min_length=1, max_length=255)
    material: str = Field(min_length=1, max_length=255)
    yards: str = Field(min_length=1, max_length=64)
    amount: str = Field(min_length=1, max_length=64)
    vip: str = Field(default="Customer", max_length=128)


class OrderUpdate(BaseModel):
    status: str = Field(min_length=1, max_length=64)


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=2000)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=20)

    @model_validator(mode="after")
    def last_message_must_be_from_user(self):
        if self.messages[-1].role != "user":
            raise ValueError("The last chat message must be from the user")
        return self


def hash_password(password: str, salt: Optional[bytes] = None) -> str:
    actual_salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), actual_salt, PASSWORD_ITERATIONS
    )
    return f"{actual_salt.hex()}${digest.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    salt_hex, digest_hex = stored_hash.split("$", 1)
    return hmac.compare_digest(hash_password(password, bytes.fromhex(salt_hex)), f"{salt_hex}${digest_hex}")


def token_digest(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def user_payload(user: User) -> dict:
    return {
        "name": user.name,
        "email": user.email,
        "phone": user.phone,
        "business": user.business,
        "role": user.role,
        "location": user.location,
        "category": user.category,
    }


def create_session(db: Session, user: User) -> str:
    token = secrets.token_urlsafe(32)
    db.add(AuthSession(
        token_hash=token_digest(token),
        user_id=user.id,
        expires_at=datetime.utcnow() + SESSION_TTL,
    ))
    return token


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> User:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Sign in to continue")
    with Session(engine) as db:
        session_record = db.get(AuthSession, token_digest(credentials.credentials))
        if session_record is None or session_record.expires_at < datetime.utcnow():
            raise HTTPException(status_code=401, detail="Your session has expired. Sign in again.")
        user = db.get(User, session_record.user_id)
        if user is None:
            raise HTTPException(status_code=401, detail="Account not found")
        return user


def order_payload(order: Order) -> dict:
    return {
        "id": order.id,
        "name": order.name,
        "channel": order.channel,
        "vip": order.vip,
        "cuts": order.cuts,
        "material": order.material,
        "yards": order.yards,
        "amount": order.amount,
        "status": order.status,
        "statusClass": order.status_class,
        "time": order.time,
    }


def seed_database():
    Base.metadata.create_all(engine)
    columns = {column["name"] for column in inspect(engine).get_columns("orders")}
    if "owner_id" not in columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE orders ADD COLUMN owner_id INTEGER NULL"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    seed_database()
    yield


app = FastAPI(title="BizBuddy API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {"message": "Welcome to BizBuddy API", "status": "running"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}


@app.get("/api/health")
def api_health():
    return {"status": "ok", "service": "bizzybuddy"}


@app.post("/api/auth/register", status_code=201)
def register(request: RegisterRequest):
    with Session(engine) as db:
        email = str(request.email).lower()
        if db.scalar(select(User).where(User.email == email)) is not None:
            raise HTTPException(status_code=409, detail="An account with this email already exists")
        user = User(
            name=request.name.strip(),
            email=email,
            password_hash=hash_password(request.password),
            business=request.business.strip(),
            category=request.category.strip(),
        )
        db.add(user)
        db.flush()
        token = create_session(db, user)
        db.commit()
        db.refresh(user)
        return {"token": token, "user": user_payload(user)}


@app.post("/api/auth/signin")
def sign_in(request: SignInRequest):
    with Session(engine) as db:
        user = db.scalar(select(User).where(User.email == str(request.email).lower()))
        if user is None or not verify_password(request.password, user.password_hash):
            raise HTTPException(status_code=401, detail="Email or password is incorrect")
        token = create_session(db, user)
        db.commit()
        return {"token": token, "user": user_payload(user)}


@app.post("/api/auth/signout")
def sign_out(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
):
    if credentials is not None:
        with Session(engine) as db:
            session_record = db.get(AuthSession, token_digest(credentials.credentials))
            if session_record is not None:
                db.delete(session_record)
                db.commit()
    return {"signedOut": True}


@app.get("/api/profile")
def get_profile(user: User = Depends(get_current_user)):
    return user_payload(user)


@app.put("/api/profile")
def update_profile(
    update: ProfileUpdate,
    user: User = Depends(get_current_user),
):
    with Session(engine) as db:
        current_user = db.get(User, user.id)
        email = str(update.email).lower()
        existing = db.scalar(select(User).where(User.email == email, User.id != user.id))
        if existing is not None:
            raise HTTPException(status_code=409, detail="That email is already in use")
        current_user.name = update.name.strip()
        current_user.email = email
        current_user.phone = update.phone.strip()
        current_user.business = update.business.strip()
        current_user.role = update.role.strip()
        current_user.location = update.location.strip()
        db.commit()
        db.refresh(current_user)
        return user_payload(current_user)


@app.get("/api/orders")
def list_orders(user: User = Depends(get_current_user)):
    with Session(engine) as db:
        orders = db.scalars(
            select(Order).where(Order.owner_id == user.id).order_by(Order.time.desc())
        ).all()
        return [order_payload(order) for order in orders]


@app.post("/api/orders", status_code=201)
def create_order(
    request: OrderCreate,
    user: User = Depends(get_current_user),
):
    order = Order(
        id=f"#ORD-{uuid4().hex[:8].upper()}",
        owner_id=user.id,
        name=request.name.strip(),
        channel=request.channel,
        vip=request.vip.strip(),
        cuts=request.cuts.strip(),
        material=request.material.strip(),
        yards=request.yards.strip(),
        amount=request.amount.strip(),
        status="Pending",
        status_class="pending",
        time=datetime.utcnow().isoformat(timespec="minutes") + " UTC",
    )
    with Session(engine) as db:
        db.add(order)
        db.commit()
        db.refresh(order)
        return order_payload(order)


@app.patch("/api/orders/{order_id}")
def update_order(
    order_id: str,
    update: OrderUpdate,
    user: User = Depends(get_current_user),
):
    with Session(engine) as db:
        order = db.scalar(
            select(Order).where(Order.id == order_id, Order.owner_id == user.id)
        )
        if order is None:
            raise HTTPException(status_code=404, detail="Order not found")
        order.status = update.status.strip()
        order.status_class = (
            "settled" if order.status.lower() in ("settled", "delivered")
            else "confirmed" if order.status.lower() in ("confirmed", "ready for dispatch", "in transit")
            else "pending"
        )
        db.commit()
        db.refresh(order)
        return order_payload(order)


@app.get("/api/dashboard")
def dashboard(user: User = Depends(get_current_user)):
    with Session(engine) as db:
        orders = db.scalars(select(Order).where(Order.owner_id == user.id)).all()
    return {
        "ordersCount": len(orders),
        "pendingCount": sum(order.status_class == "pending" for order in orders),
        "readyCount": sum(order.status_class == "confirmed" for order in orders),
        "settledCount": sum(order.status_class == "settled" for order in orders),
    }


@app.post("/api/ai/chat")
async def ai_chat(
    request: ChatRequest,
    user: User = Depends(get_current_user),
):
    gemini_key = os.getenv("GEMINI_API_KEY")
    openai_key = os.getenv("OPENAI_API_KEY")
    if not gemini_key and not openai_key:
        raise HTTPException(
            status_code=503,
            detail="AI is not configured. Add GEMINI_API_KEY or OPENAI_API_KEY to the backend .env file.",
        )

    with Session(engine) as db:
        orders = db.scalars(
            select(Order)
            .where(Order.owner_id == user.id)
            .order_by(Order.time.desc())
            .limit(10)
        ).all()

    workspace_context = {
        "business": user.business,
        "category": user.category,
        "recent_orders": [
            {
                "fabric": order.cuts,
                "material": order.material,
                "quantity": order.yards,
                "status": order.status,
            }
            for order in orders
        ],
    }
    system_prompt = (
        "You are BizBuddy's helpful atelier concierge. Answer clearly and warmly. "
        "Use the workspace context when relevant. Do not invent inventory, prices, "
        "payments, policies, or order details. Ask a concise follow-up question "
        "when information is missing. Workspace context: "
        f"{workspace_context}"
    )

    if gemini_key:
        try:
            gclient = genai.Client(api_key=gemini_key)
            contents = [
                types.Content(
                    role="user" if m.role == "user" else "model",
                    parts=[types.Part(text=m.content)],
                )
                for m in request.messages
            ]
            response = await gclient.aio.models.generate_content(
                model=os.getenv("GEMINI_MODEL", "gemini-3.5-flash"),
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    max_output_tokens=1000,
                ),
            )
            reply = response.text
        except Exception as error:
            print("Gemini error:", error)
            raise HTTPException(
                status_code=502,
                detail="The AI provider could not complete the request.",
            ) from error
    else:
        messages = [
            {"role": "system", "content": system_prompt},
            *[message.model_dump() for message in request.messages],
        ]
        try:
            async with AsyncOpenAI(api_key=openai_key) as client:
                completion = await client.chat.completions.create(
                    model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
                    messages=messages,
                    max_completion_tokens=450,
                )
        except RateLimitError as error:
            raise HTTPException(status_code=429, detail="AI usage limit reached. Try again shortly.") from error
        except APIConnectionError as error:
            raise HTTPException(status_code=502, detail="Could not connect to the AI provider.") from error
        except APIStatusError as error:
            raise HTTPException(status_code=502, detail="The AI provider could not complete the request.") from error
        reply = completion.choices[0].message.content if completion.choices else None

    if not reply:
        raise HTTPException(status_code=502, detail="The AI provider returned an empty reply.")
    return {"reply": reply}