"""Persistent back-office operations, registered against the existing auth layer."""
import asyncio
import json
from datetime import date, datetime, timedelta
from collections import Counter
from uuid import uuid4
from typing import Literal

from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import Integer, String, Text, ForeignKey, select, update
from sqlalchemy.orm import Mapped, Session, mapped_column


class ProductInput(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    price: int = Field(ge=0, le=100000000000)  # minor currency units
    stock: int = Field(ge=0, le=10000000)
    threshold: int = Field(default=5, ge=0, le=10000000)
    description: str = Field(default='', max_length=2000)


class InvoiceInput(BaseModel):
    customer: str = Field(min_length=1, max_length=255)
    email: str = Field(default='', max_length=255)
    conversation_id: str = Field(default='', max_length=64)
    amount: int = Field(gt=0, le=100000000000)
    due: date
    confirmed: bool = False


class NotificationInput(BaseModel):
    channel: Literal['dashboard', 'telegram', 'email'] = 'dashboard'
    recipient: str = Field(default='', max_length=255)
    hour_utc: int = Field(default=18, ge=0, le=23)


class OrderConfirmation(BaseModel):
    product_id: str = Field(min_length=1, max_length=32)
    quantity: int = Field(gt=0, le=1000000)


class DraftApproval(BaseModel):
    content: str = Field(min_length=1, max_length=4000)


class TestMessage(BaseModel):
    customer: str = Field(min_length=1, max_length=255)
    content: str = Field(min_length=1, max_length=2000)


class LinkCustomers(BaseModel):
    customer_ids: list[int] = Field(min_length=2, max_length=20)


def install_routes(app, core):
    Base, User = core['Base'], core['User']

    def session():
        return Session(core['engine'])
    auth = core['get_current_user']
    Chatbot, Channel = core['Chatbot'], core['ChatbotChannel']
    Conversation, Message, Customer = core['ChatbotConversation'], core['ChatbotMessage'], core['ChatbotCustomer']
    RequestOrder = core['ChatbotOrderRequest']

    class Product(Base):
        __tablename__ = 'inventory'
        id: Mapped[str] = mapped_column(String(32), primary_key=True, default=lambda: uuid4().hex)
        owner_id: Mapped[int] = mapped_column(ForeignKey('users.id'), index=True)
        name: Mapped[str] = mapped_column(String(255))
        price: Mapped[int] = mapped_column(Integer)
        stock: Mapped[int] = mapped_column(Integer)
        threshold: Mapped[int] = mapped_column(Integer, default=5)
        description: Mapped[str] = mapped_column(Text, default='')

    class Invoice(Base):
        __tablename__ = 'invoices'
        id: Mapped[str] = mapped_column(String(32), primary_key=True, default=lambda: uuid4().hex)
        owner_id: Mapped[int] = mapped_column(ForeignKey('users.id'), index=True)
        customer: Mapped[str] = mapped_column(String(255))
        email: Mapped[str] = mapped_column(String(255), default='')
        conversation_id: Mapped[str] = mapped_column(String(64), default='')
        amount: Mapped[int] = mapped_column(Integer)
        due: Mapped[str] = mapped_column(String(10))
        status: Mapped[str] = mapped_column(String(20), default='unpaid')
        confirmed: Mapped[int] = mapped_column(Integer, default=0)
        reminder_day: Mapped[str] = mapped_column(String(10), default='')
        created: Mapped[str] = mapped_column(String(32), default=lambda: datetime.utcnow().isoformat())

    class Draft(Base):
        __tablename__ = 'outbox_drafts'
        id: Mapped[str] = mapped_column(String(32), primary_key=True, default=lambda: uuid4().hex)
        owner_id: Mapped[int] = mapped_column(ForeignKey('users.id'), index=True)
        invoice_id: Mapped[str] = mapped_column(String(32), default='')
        conversation_id: Mapped[str] = mapped_column(String(64), default='')
        recipient: Mapped[str] = mapped_column(String(255), default='')
        subject: Mapped[str] = mapped_column(String(255), default='')
        content: Mapped[str] = mapped_column(Text)
        status: Mapped[str] = mapped_column(String(24), default='awaiting_approval')
        created: Mapped[str] = mapped_column(String(32), default=lambda: datetime.utcnow().isoformat())

    class CustomerLink(Base):
        __tablename__ = 'customer_links'
        customer_id: Mapped[int] = mapped_column(Integer, primary_key=True)
        owner_id: Mapped[int] = mapped_column(ForeignKey('users.id'), index=True)
        group_id: Mapped[str] = mapped_column(String(32))

    core['CustomerLink'] = CustomerLink

    class Summary(Base):
        __tablename__ = 'daily_summaries'
        id: Mapped[str] = mapped_column(String(64), primary_key=True)
        owner_id: Mapped[int] = mapped_column(ForeignKey('users.id'), index=True)
        day: Mapped[str] = mapped_column(String(10))
        content: Mapped[str] = mapped_column(Text)

    class NotificationSettings(Base):
        __tablename__ = 'notification_settings'
        owner_id: Mapped[int] = mapped_column(ForeignKey('users.id'), primary_key=True)
        channel: Mapped[str] = mapped_column(String(16), default='dashboard')
        recipient: Mapped[str] = mapped_column(String(255), default='')
        hour_utc: Mapped[int] = mapped_column(Integer, default=18)
        sent_day: Mapped[str] = mapped_column(String(10), default='')
        last_status: Mapped[str] = mapped_column(String(32), default='not_sent')

    def payload(row):
        return {c.name: getattr(row, c.name) for c in row.__table__.columns if c.name != 'owner_id'}

    def owned(db, model, key, owner):
        row = db.get(model, key)
        if not row or row.owner_id != owner:
            raise HTTPException(404, 'Record not found.')
        return row

    def sync_products(db, owner):
        bot = db.scalar(select(Chatbot).where(Chatbot.owner_id == owner))
        if bot:
            rows = db.scalars(select(Product).where(Product.owner_id == owner)).all()
            bot.products = json.dumps([{'name': p.name, 'price': f'NGN {p.price / 100:,.2f}', 'availability': f'{p.stock} in stock' if p.stock else 'Out of stock', 'description': p.description} for p in rows])

    import threading
    from functools import wraps
    automation_lock = threading.RLock()

    def serialized(fn):
        @wraps(fn)
        def wrapped(*args, **kwargs):
            with automation_lock:
                return fn(*args, **kwargs)
        return wrapped

    @serialized
    def run_automation(db, owner):
        today = date.today().isoformat()
        invoices = db.scalars(select(Invoice).where(Invoice.owner_id == owner, Invoice.status == 'unpaid', Invoice.confirmed == 1, Invoice.due < today)).all()
        created = 0
        for invoice in invoices:
            # One draft per invoice per day, including unapproved drafts.
            if invoice.reminder_day == today:
                continue
            pending = db.scalar(select(Draft).where(Draft.invoice_id == invoice.id, Draft.status.in_(['awaiting_approval', 'sending'])))
            if pending:
                continue
            db.add(Draft(owner_id=owner, invoice_id=invoice.id, conversation_id=invoice.conversation_id, recipient=invoice.email, subject=f'Payment reminder — invoice {invoice.id[:8]}', content=f'Hello {invoice.customer}, a friendly reminder that invoice {invoice.id[:8]} for NGN {invoice.amount / 100:,.2f} was due on {invoice.due}. Please let us know if you have already paid or need help. Thank you.'))
            invoice.reminder_day = today
            created += 1
        today_orders = db.scalars(select(RequestOrder).where(RequestOrder.owner_id == owner, RequestOrder.created_at >= datetime.combine(date.today(), datetime.min.time()))).all()
        channels = Counter()
        for order in today_orders:
            conv = db.get(Conversation, order.conversation_id)
            if conv:
                channels[conv.channel] += 1
        stock = db.scalars(select(Product).where(Product.owner_id == owner, Product.stock <= Product.threshold)).all()
        attention = len(db.scalars(select(Conversation).where(Conversation.owner_id == owner, Conversation.status == 'human_attention')).all())
        all_unpaid = db.scalars(select(Invoice).where(Invoice.owner_id == owner, Invoice.status == 'unpaid')).all()
        content = {'date': today, 'order_requests': len(today_orders), 'by_channel': dict(channels), 'unpaid_total': sum(i.amount for i in all_unpaid), 'overdue_total': sum(i.amount for i in all_unpaid if i.due < today), 'overdue_count': sum(i.due < today for i in all_unpaid), 'low_stock': [{'name': p.name, 'stock': p.stock} for p in stock], 'needs_attention': attention}
        key = f'{owner}:{today}'
        summary = db.get(Summary, key)
        if summary:
            summary.content = json.dumps(content)
        else:
            db.add(Summary(id=key, owner_id=owner, day=today, content=json.dumps(content)))
        db.commit()
        return {'drafts_created': created, 'summary': content}

    @app.get('/api/operations')
    def overview(user=Depends(auth)):
        with session() as db:
            result = run_automation(db, user.id)
            result.update({
                'products': [payload(p) for p in db.scalars(select(Product).where(Product.owner_id == user.id)).all()],
                'invoices': [payload(p) for p in db.scalars(select(Invoice).where(Invoice.owner_id == user.id).order_by(Invoice.created.desc())).all()],
                'drafts': [payload(p) for p in db.scalars(select(Draft).where(Draft.owner_id == user.id).order_by(Draft.created.desc())).all()],
                'summaries': [json.loads(p.content) for p in db.scalars(select(Summary).where(Summary.owner_id == user.id).order_by(Summary.day.desc()).limit(14)).all()],
                'customers': [{**payload(p), 'group_id': (db.get(CustomerLink, p.id).group_id if db.get(CustomerLink, p.id) else p.id)} for p in db.scalars(select(Customer).where(Customer.owner_id == user.id)).all()],
                'notifications': payload(db.get(NotificationSettings, user.id)) if db.get(NotificationSettings, user.id) else {'channel':'dashboard','recipient':'','hour_utc':18,'last_status':'not_sent','sent_day':''},
                'reply_engine': 'grounded knowledge' if not core['os'].getenv('OPENAI_API_KEY') else 'OpenAI',
            })
            return result

    @app.post('/api/operations/products', status_code=201)
    def create_product(data: ProductInput, user=Depends(auth)):
        with session() as db:
            row = Product(owner_id=user.id, **data.model_dump())
            db.add(row)
            db.flush()
            sync_products(db, user.id)
            db.commit()
            return payload(row)

    @app.put('/api/operations/products/{key}')
    def edit_product(key: str, data: ProductInput, user=Depends(auth)):
        with session() as db:
            row = owned(db, Product, key, user.id)
            for field, value in data.model_dump().items():
                setattr(row, field, value)
            db.flush()
            sync_products(db, user.id)
            db.commit()
            return payload(row)

    @app.post('/api/operations/invoices', status_code=201)
    def create_invoice(data: InvoiceInput, user=Depends(auth)):
        if '\n' in data.email or '\r' in data.email:
            raise HTTPException(422, 'Invalid email.')
        if data.email:
            from email_validator import validate_email, EmailNotValidError
            try:
                validate_email(data.email, check_deliverability=False)
            except EmailNotValidError:
                raise HTTPException(422, 'Enter a valid email address.')
        with session() as db:
            if data.conversation_id:
                owned(db, Conversation, data.conversation_id, user.id)
            row = Invoice(owner_id=user.id, **{**data.model_dump(), 'due': data.due.isoformat()})
            db.add(row)
            db.flush()
            db.add(Draft(owner_id=user.id, invoice_id=row.id, recipient=data.email, subject=f'Invoice {row.id[:8]}', content=f'Hello {data.customer},\n\nInvoice {row.id[:8]}: NGN {data.amount / 100:,.2f}\nDue: {data.due}\n\nPlease contact us for payment details. Thank you.'))
            db.commit()
            return payload(row)

    @app.post('/api/operations/invoices/{key}/paid')
    def mark_paid(key: str, user=Depends(auth)):
        with session() as db:
            row = owned(db, Invoice, key, user.id)
            row.status = 'paid'
            for draft in db.scalars(select(Draft).where(Draft.invoice_id == key, Draft.status == 'awaiting_approval')).all():
                draft.status = 'cancelled'
            db.commit()
            return payload(row)

    @app.post('/api/operations/invoices/{key}/confirm')
    def confirm_invoice(key: str, user=Depends(auth)):
        with session() as db:
            row = owned(db, Invoice, key, user.id)
            row.confirmed = 1
            db.commit()
            return payload(row)

    @app.post('/api/operations/automation')
    def automation(user=Depends(auth)):
        with session() as db:
            return run_automation(db, user.id)

    @app.get('/api/operations/drafts/{key}/email')
    def download_email(key: str, user=Depends(auth)):
        from email.message import EmailMessage
        from starlette.responses import Response
        with session() as db:
            draft = owned(db, Draft, key, user.id)
            message = EmailMessage()
            message['To'] = draft.recipient
            message['Subject'] = draft.subject
            message['X-Unsent'] = '1'
            message.set_content(draft.content)
            return Response(message.as_bytes(), media_type='message/rfc822', headers={'Content-Disposition': f'attachment; filename="bizbuddy-{key[:8]}.eml"'})

    @app.post('/api/operations/drafts/{key}/approve')
    async def approve_draft(key: str, data: DraftApproval, user=Depends(auth)):
        with session() as db:
            draft = owned(db, Draft, key, user.id)
            if draft.status != 'awaiting_approval':
                raise HTTPException(409, 'This draft has already been handled.')
            invoice = owned(db, Invoice, draft.invoice_id, user.id) if draft.invoice_id else None
            if invoice and (invoice.status == 'paid' or not invoice.confirmed):
                raise HTTPException(409, 'Confirm the unpaid invoice before approving its message.')
            # Website messages are stored in the original conversation. Email remains a draft.
            if not draft.conversation_id:
                draft.content = data.content
                draft.status = 'email_ready'
                db.commit()
                return {'status': 'email_draft', 'detail': 'Download this email draft and send it from your email app.'}
            conv = owned(db, Conversation, draft.conversation_id, user.id)
            if conv.channel not in ('website', 'telegram', 'email'):
                raise HTTPException(409, 'Proactive sending is disabled for this channel. Use an approved provider template or email draft.')
            channel = db.scalar(select(Channel).where(Channel.owner_id == user.id, Channel.channel == conv.channel, Channel.status == 'connected'))
            if not channel:
                raise HTTPException(409, 'The original channel is disconnected.')
            # Claim before network I/O; an uncertain send is never retried automatically.
            draft.status = 'sending'
            draft.content = data.content
            db.commit()
            if conv.channel in ('telegram', 'email'):
                try:
                    await core['send_platform_message'](channel, conv.external_id, data.content)
                except Exception:
                    draft.status = 'delivery_unknown'
                    db.commit()
                    raise HTTPException(502, 'Delivery could not be confirmed. Check the channel before creating another reminder.')
            db.add(Message(conversation_id=conv.id, sender='owner', content=data.content, delivery_status='sent'))
            pending = db.scalar(select(RequestOrder.id).where(RequestOrder.conversation_id == conv.id, RequestOrder.status == 'needs_owner_confirmation'))
            conv.status = 'human_attention' if pending else 'open'
            conv.updated_at = datetime.utcnow()
            draft.status = 'sent'
            db.commit()
            return payload(draft)

    @app.post('/api/operations/customers/link')
    def link_customers(data: LinkCustomers, user=Depends(auth)):
        with session() as db:
            if len(set(data.customer_ids)) < 2:
                raise HTTPException(422, 'Select at least two different customer records.')
            customers = [owned(db, Customer, key, user.id) for key in set(data.customer_ids)]
            group = uuid4().hex
            old_groups = {link.group_id for p in customers if (link := db.get(CustomerLink, p.id))}
            for link in db.scalars(select(CustomerLink).where(CustomerLink.owner_id == user.id, CustomerLink.group_id.in_(old_groups))).all():
                link.group_id = group
            for p in customers:
                link = db.get(CustomerLink, p.id)
                if not link:
                    db.add(CustomerLink(customer_id=p.id, owner_id=user.id, group_id=group))
                else:
                    link.group_id = group
            db.commit()
            return {'group_id': group}

    @app.post('/api/operations/order-requests/{key}/confirm')
    async def confirm_order(key: str, data: OrderConfirmation, user=Depends(auth)):
        with session() as db:
            order_request = owned(db, RequestOrder, key, user.id)
            product = owned(db, Product, data.product_id, user.id)
            conversation = owned(db, Conversation, order_request.conversation_id, user.id)
            claimed = db.execute(update(RequestOrder).where(RequestOrder.id == key, RequestOrder.status == 'needs_owner_confirmation').values(status='confirmed'))
            if claimed.rowcount != 1:
                raise HTTPException(409, 'This request has already been confirmed.')
            adjusted = db.execute(update(Product).where(Product.id == product.id, Product.stock >= data.quantity).values(stock=Product.stock - data.quantity))
            if adjusted.rowcount != 1:
                raise HTTPException(409, 'Insufficient stock. Update the quantity or inventory first.')
            order = core['Order'](id=uuid4().hex, owner_id=user.id, name=conversation.customer_name or 'Customer', channel=conversation.channel, vip='', cuts=product.name, material=product.description, yards=str(data.quantity), amount=f'NGN {product.price * data.quantity / 100:,.2f}', status='Confirmed', status_class='confirmed', time=datetime.utcnow().isoformat())
            db.add(order)
            db.flush()
            sync_products(db, user.id)
            content = f'Your order is confirmed: {data.quantity} × {product.name}, total NGN {product.price * data.quantity / 100:,.2f}. The owner will arrange delivery with you.'
            conversation_id, order_id = conversation.id, order.id
            db.commit()
        notification_failed = False
        try:
            await core['reply_to_conversation'](conversation_id, core['ChatbotManualReply'](content=content), user)
        except HTTPException:
            notification_failed = True
        return {'order_id': order_id, 'notification_failed': notification_failed}

    @app.post('/api/operations/website/setup')
    def setup_website(user=Depends(auth)):
        with session() as db:
            bot = core['chatbot_for_owner'](db, user)
            bot.website_domain = core['os'].getenv('PUBLIC_API_URL', 'http://localhost:5173').rstrip('/')
            bot.enabled = True
            channel = db.scalar(select(Channel).where(Channel.owner_id == user.id, Channel.channel == 'website'))
            if not channel:
                db.add(Channel(owner_id=user.id, channel='website', account_id=bot.public_id, status='connected'))
            else:
                channel.status = 'connected'
            sync_products(db, user.id)
            db.commit()
            return core['chatbot_payload'](bot)

    @app.post('/api/operations/website/message')
    async def website_test(data: TestMessage, user=Depends(auth)):
        # Owner's test uses exactly the real channel pipeline and durable inbox.
        return await core['process_customer_message'](user.id, 'website', 'test-' + core['hashlib'].sha256(data.customer.strip().lower().encode()).hexdigest()[:24], f'My name is {data.customer}. {data.content}')

    from email_channel import install_email
    sync_email = install_email(app, core, Draft, Invoice, session)

    @app.put('/api/operations/notifications')
    def save_notifications(data: NotificationInput, user=Depends(auth)):
        if data.channel == 'email':
            from email_validator import validate_email, EmailNotValidError
            try:
                validate_email(data.recipient, check_deliverability=False)
            except EmailNotValidError:
                raise HTTPException(422, 'Enter the owner email address.')
        if data.channel == 'telegram' and not core['re'].fullmatch(r'-?\d{1,20}', data.recipient):
            raise HTTPException(422, 'Enter your numeric Telegram chat ID from Client Profiles.')
        with session() as db:
            if data.channel != 'dashboard' and not db.scalar(select(Channel).where(Channel.owner_id == user.id, Channel.channel == data.channel, Channel.status == 'connected')):
                raise HTTPException(409, 'Connect this channel before scheduling summaries.')
            settings = db.get(NotificationSettings, user.id)
            if not settings:
                settings = NotificationSettings(owner_id=user.id)
                db.add(settings)
            settings.channel, settings.recipient, settings.hour_utc = data.channel, data.recipient, data.hour_utc
            db.commit()
            return payload(settings)

    async def deliver_summary(owner):
        with session() as db:
            settings = db.get(NotificationSettings, owner)
            today = date.today().isoformat()
            if not settings or settings.channel == 'dashboard' or settings.sent_day == today or datetime.utcnow().hour < settings.hour_utc:
                return
            channel = db.scalar(select(Channel).where(Channel.owner_id == owner, Channel.channel == settings.channel, Channel.status == 'connected'))
            if not channel:
                return
            summary = run_automation(db, owner)['summary']
            channels = ', '.join(f'{name}: {count}' for name, count in summary['by_channel'].items()) or 'none'
            stock = ', '.join(f"{p['name']} ({p['stock']})" for p in summary['low_stock']) or 'none'
            content = f"BizBuddy daily summary — {today}\nOrder requests: {summary['order_requests']} ({channels})\nOutstanding: NGN {summary['unpaid_total']/100:,.2f}\nOverdue: NGN {summary['overdue_total']/100:,.2f}\nNeeds attention: {summary['needs_attention']}\nLow stock: {stock}"
            # Claim before delivery so a timeout/restart cannot trigger a duplicate.
            settings.sent_day, settings.last_status = today, 'sending'
            db.commit()
            try:
                if settings.channel == 'telegram':
                    await core['send_platform_message'](channel, settings.recipient, content)
                else:
                    from email_channel import send_mail
                    credentials = core['decrypt_channel_credentials'](channel)
                    await asyncio.to_thread(send_mail, credentials, settings.recipient, f'BizBuddy daily summary — {today}', content)
                settings.last_status = 'sent'
            except Exception:
                settings.last_status = 'delivery_unknown'
                core['logger'].warning('Owner summary delivery uncertain for workspace %s', owner)
            db.commit()

    core['_deliver_daily_summary'] = deliver_summary

    async def scheduler():
        while True:
            await asyncio.sleep(60)
            try:
                with session() as db:
                    owners = db.scalars(select(User.id)).all()
                    for owner in owners:
                        run_automation(db, owner)
                for owner in owners:
                    try:
                        await sync_email(owner)
                    except Exception:
                        core['logger'].warning('Scheduled email sync failed for workspace %s', owner)
                    await deliver_summary(owner)
            except Exception:
                core['logger'].exception('Back-office scheduler failed')

    # Integrate into the original lifespan without a second server or cron dependency.
    original = app.router.lifespan_context
    from contextlib import asynccontextmanager

    @asynccontextmanager
    async def lifespan(application):
        async with original(application):
            task = asyncio.create_task(scheduler())
            yield
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
    app.router.lifespan_context = lifespan
