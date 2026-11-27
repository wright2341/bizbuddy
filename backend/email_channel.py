"""Optional Gmail IMAP + SMTP connector using Python's standard library.

Incoming messages use the common inbox pipeline; generated replies remain drafts.
No mail leaves the server until the owner explicitly approves it.
"""
import asyncio
import email
import imaplib
import smtplib
import ssl
from email.message import EmailMessage
from email.header import decode_header, make_header
from email.utils import parseaddr
from uuid import uuid4

from fastapi import Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import String, Text, select
from sqlalchemy.orm import Mapped, mapped_column


class EmailSetup(BaseModel):
    address: EmailStr
    app_password: str = Field(min_length=8, max_length=128)


def fetch_mail(credentials):
    rows = []
    with imaplib.IMAP4_SSL('imap.gmail.com', timeout=20) as client:
        client.login(credentials['address'], credentials['app_password'])
        client.select('INBOX', readonly=True)
        status, ids = client.uid('search', None, 'UNSEEN')
        if status != 'OK':
            return rows
        for uid in ids[0].split()[-20:]:
            # Check size before downloading; attachments are outside MVP scope.
            status, info = client.uid('fetch', uid, '(RFC822.SIZE)')
            import re
            size = re.search(rb'RFC822.SIZE (\d+)', b' '.join(i for i in info if isinstance(i, bytes)))
            if status != 'OK' or not size or int(size.group(1)) > 131072:
                continue
            status, data = client.uid('fetch', uid, '(BODY.PEEK[])')
            raw = next((item[1] for item in data if isinstance(item, tuple)), None)
            if status != 'OK' or not raw:
                continue
            message = email.message_from_bytes(raw)
            if message.get('Auto-Submitted', 'no').lower() != 'no' or message.get('Precedence', '').lower() in ('bulk', 'junk', 'list'):
                continue
            name, sender = parseaddr(message.get('From', ''))
            if not sender or sender.lower() == credentials['address'].lower():
                continue
            text = ''
            for part in message.walk():
                if part.get_content_type() == 'text/plain' and part.get_content_disposition() != 'attachment':
                    text = (part.get_payload(decode=True) or b'').decode(part.get_content_charset() or 'utf-8', errors='replace')[:2000]
                    break
            if not text.strip():
                continue
            message_id = str(message.get('Message-ID', ''))[:500]
            root = str(message.get('References', '')).split()[:1] or [message_id or uid.decode()]
            rows.append({'uid': uid.decode(), 'sender': sender, 'name': str(make_header(decode_header(name)))[:255], 'subject': str(make_header(decode_header(message.get('Subject', 'Customer enquiry'))))[:200], 'message_id': message_id, 'root': root[0], 'text': text})
    return rows


def send_mail(credentials, recipient, subject, content, message_id=''):
    msg = EmailMessage()
    msg['From'] = credentials['address']
    msg['To'] = recipient
    msg['Subject'] = subject.replace('\r', '').replace('\n', '')
    msg['Auto-Submitted'] = 'auto-replied'
    if message_id and '\r' not in message_id and '\n' not in message_id:
        msg['In-Reply-To'] = message_id
        msg['References'] = message_id
    msg.set_content(content)
    with smtplib.SMTP_SSL('smtp.gmail.com', 465, timeout=20, context=ssl.create_default_context()) as client:
        client.login(credentials['address'], credentials['app_password'])
        client.send_message(msg)


def install_email(app, core, Draft, Invoice, session):
    Base, Channel = core['Base'], core['ChatbotChannel']
    Conversation, Message = core['ChatbotConversation'], core['ChatbotMessage']

    class EmailThread(Base):
        __tablename__ = 'email_threads'
        conversation_id: Mapped[str] = mapped_column(String(32), primary_key=True)
        recipient: Mapped[str] = mapped_column(String(255))
        subject: Mapped[str] = mapped_column(Text)
        message_id: Mapped[str] = mapped_column(String(500))

    original_send = core['send_platform_message']

    async def send_platform(channel, recipient, content):
        if channel.channel != 'email':
            return await original_send(channel, recipient, content)
        with session() as db:
            conversation = db.scalar(select(Conversation).where(Conversation.owner_id == channel.owner_id, Conversation.channel == 'email', Conversation.external_id == recipient))
            thread = db.get(EmailThread, conversation.id) if conversation else None
            if not thread:
                raise HTTPException(409, 'Email thread not found.')
            credentials = core['decrypt_channel_credentials'](channel)
            try:
                await asyncio.to_thread(send_mail, credentials, thread.recipient, 'Re: ' + thread.subject.removeprefix('Re: '), content, thread.message_id)
            except Exception as error:
                raise HTTPException(502, 'Email delivery could not be confirmed. Check Sent mail before retrying.') from error
    core['send_platform_message'] = send_platform

    @app.post('/api/operations/email/connect')
    async def connect_email(data: EmailSetup, user=Depends(core['get_current_user'])):
        credentials = {'address': str(data.address).lower(), 'app_password': data.app_password.replace(' ', '')}
        def verify():
            with imaplib.IMAP4_SSL('imap.gmail.com', timeout=20) as client:
                client.login(credentials['address'], credentials['app_password'])
        try:
            await asyncio.to_thread(verify)
        except Exception as error:
            raise HTTPException(422, 'Gmail login failed. Enable IMAP and use a Google app password, not your normal password.') from error
        encrypted = core['encrypt_channel_credentials'](credentials)
        with session() as db:
            core['ensure_channel_account_available'](user.id, 'email', credentials['address'])
            core['chatbot_for_owner'](db, user).enabled = True
            channel = db.scalar(select(Channel).where(Channel.owner_id == user.id, Channel.channel == 'email'))
            if not channel:
                channel = Channel(owner_id=user.id, channel='email')
                db.add(channel)
            channel.account_id = credentials['address']
            channel.encrypted_credentials = encrypted
            channel.status = 'connected'
            db.commit()
        return {'status': 'connected'}

    @app.post('/api/operations/email/drafts/{key}/send')
    async def send_draft(key: str, user=Depends(core['get_current_user'])):
        with session() as db:
            draft = db.get(Draft, key)
            if not draft or draft.owner_id != user.id:
                raise HTTPException(404, 'Draft not found.')
            if draft.status != 'email_ready' or not draft.recipient:
                raise HTTPException(409, 'Review and save this email draft first, with a recipient email address.')
            if draft.invoice_id:
                invoice = db.get(Invoice, draft.invoice_id)
                if not invoice or invoice.owner_id != user.id or invoice.status == 'paid' or not invoice.confirmed:
                    raise HTTPException(409, 'Only confirmed unpaid invoices can be emailed.')
            channel = db.scalar(select(Channel).where(Channel.owner_id == user.id, Channel.channel == 'email', Channel.status == 'connected'))
            if not channel:
                raise HTTPException(409, 'Connect Gmail before sending email.')
            credentials = core['decrypt_channel_credentials'](channel)
            draft.status = 'sending'
            db.commit()
            try:
                await asyncio.to_thread(send_mail, credentials, draft.recipient, draft.subject, draft.content)
            except Exception as error:
                draft.status = 'delivery_unknown'
                db.commit()
                raise HTTPException(502, 'Delivery could not be confirmed. Check Gmail Sent mail before trying another message.') from error
            draft.status = 'sent'
            db.commit()
            return {'status': 'sent'}

    sync_locks = {}

    async def sync(owner):
        lock = sync_locks.setdefault(owner, asyncio.Lock())
        if lock.locked():
            return {'imported': 0, 'detail': 'Sync already running.'}
        async with lock:
            with session() as db:
                channel = db.scalar(select(Channel).where(Channel.owner_id == owner, Channel.channel == 'email', Channel.status == 'connected'))
                if not channel:
                    return {'imported': 0}
                credentials = core['decrypt_channel_credentials'](channel)
            try:
                rows = await asyncio.to_thread(fetch_mail, credentials)
            except Exception as error:
                raise HTTPException(502, 'Could not sync Gmail. Check your app password and IMAP access.') from error
            count = 0
            for row in rows:
                platform_id = 'email:' + str(owner) + ':' + core['hashlib'].sha256((row['message_id'] or row['uid']).encode()).hexdigest()
                external = core['hashlib'].sha256((row['sender'].lower() + row['root']).encode()).hexdigest()
                with session() as db:
                    if db.scalar(select(Message).where(Message.platform_message_id == platform_id)):
                        continue
                result = await core['process_customer_message'](owner, 'email', external, row['text'], platform_message_id=platform_id)
                if result.get('duplicate'):
                    continue
                with session() as db:
                    conv = db.get(Conversation, result['conversation_id'])
                    conv.customer_name = row['name'] or row['sender']
                    conv.status = 'human_attention'
                    customer = db.get(core['ChatbotCustomer'], conv.customer_id)
                    customer.name, customer.email = conv.customer_name, row['sender']
                    thread = db.get(EmailThread, conv.id)
                    if not thread:
                        thread = EmailThread(conversation_id=conv.id)
                        db.add(thread)
                    thread.recipient, thread.subject, thread.message_id = row['sender'], row['subject'], row['message_id']
                    if result.get('reply'):
                        db.add(Draft(owner_id=owner, conversation_id=conv.id, recipient=row['sender'], subject='Re: ' + row['subject'].removeprefix('Re: '), content=result['reply']))
                    db.commit()
                count += 1
            return {'imported': count}

    @app.post('/api/operations/email/sync')
    async def sync_email(user=Depends(core['get_current_user'])):
        return await sync(user.id)

    return sync
