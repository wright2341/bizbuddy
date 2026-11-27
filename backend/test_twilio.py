import os
import unittest
from datetime import datetime, timedelta
from types import SimpleNamespace
from unittest.mock import patch

from cryptography.fernet import Fernet
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool
from twilio.request_validator import RequestValidator

import main


class FakeTwilioClient:
    def __init__(self, account_sid, auth_token, http_client=None):
        self.api = SimpleNamespace(
            accounts=lambda sid: SimpleNamespace(
                fetch=lambda: SimpleNamespace(friendly_name="BizBuddy Test Account")
            )
        )
        self.messages = SimpleNamespace(
            create=lambda **kwargs: SimpleNamespace(
                sid="SM" + "b" * 32,
                status="queued",
                request=kwargs,
            )
        )


class TwilioApiTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        self.engine_patch = patch.object(main, "engine", self.engine)
        self.engine_patch.start()
        self.environment_patch = patch.dict(
            os.environ,
            {"CHATBOT_ENCRYPTION_KEY": Fernet.generate_key().decode("ascii"), "PUBLIC_API_URL": "http://testserver"},
        )
        self.environment_patch.start()
        main.Base.metadata.create_all(self.engine)
        with Session(self.engine) as db:
            user = main.User(
                name="Twilio Test",
                email="twilio-test@example.com",
                password_hash="not-used",
            )
            db.add(user)
            db.flush()
            self.user_id = user.id
            db.add(main.AuthSession(
                token_hash=main.token_digest("test-session-token"),
                user_id=user.id,
                expires_at=datetime.utcnow() + timedelta(hours=1),
            ))
            db.commit()
        self.client_patch = patch.object(main, "Client", FakeTwilioClient)
        self.client_patch.start()
        self.client = TestClient(main.app)
        self.client.__enter__()
        self.headers = {"Authorization": "Bearer test-session-token"}

    def tearDown(self):
        self.client.__exit__(None, None, None)
        self.client_patch.stop()
        self.environment_patch.stop()
        self.engine_patch.stop()
        self.engine.dispose()

    def connect(self, **overrides):
        values = {
            "account_sid": "AC" + "a" * 32,
            "auth_token": "private-auth-token",
            "sms_sender": "+14155552671",
        }
        values.update(overrides)
        return self.client.post("/api/twilio/connect", json=values, headers=self.headers)

    def test_account_credentials_are_never_returned_and_send_is_saved(self):
        connected = self.connect()
        self.assertEqual(connected.status_code, 200, connected.text)
        self.assertEqual(connected.json()["account_name"], "BizBuddy Test Account")
        status = self.client.get("/api/twilio/status", headers=self.headers)
        self.assertNotIn("auth_token", status.json())
        with Session(self.engine) as db:
            account = db.scalar(select(main.TwilioAccount))
            self.assertNotIn("private-auth-token", account.encrypted_credentials)

        sent = self.client.post(
            "/api/twilio/send",
            json={"to": "+14155559876", "body": "Hello", "channel": "sms"},
            headers=self.headers,
        )
        self.assertEqual(sent.status_code, 201, sent.text)
        self.assertEqual(sent.json()["message_sid"], "SM" + "b" * 32)
        self.assertEqual(sent.json()["status"], "queued")
        with Session(self.engine) as db:
            stored = db.scalar(select(main.TwilioMessage))
            self.assertEqual(stored.owner_id, self.user_id)
            self.assertEqual(stored.recipient, "+14155559876")

    def test_signed_inbound_webhook_is_deduplicated(self):
        self.assertEqual(self.connect().status_code, 200)
        fields = {
            "AccountSid": "AC" + "a" * 32,
            "MessageSid": "SM" + "c" * 32,
            "From": "+14155550000",
            "To": "+14155552671",
            "Body": "Is this available?",
            "NumMedia": "0",
        }
        url = "http://testserver/api/webhooks/twilio"
        signature = RequestValidator("private-auth-token").compute_signature(url, fields)
        for _ in range(2):
            response = self.client.post(
                "/api/webhooks/twilio",
                data=fields,
                headers={"X-Twilio-Signature": signature},
            )
            self.assertEqual(response.status_code, 200, response.text)
        inbox = self.client.get('/api/chatbot/dashboard', headers=self.headers).json()
        self.assertEqual(len(inbox['conversations']), 1)
        self.assertEqual(inbox['conversations'][0]['channel'], 'sms')
        self.assertEqual(len(inbox['conversations'][0]['messages']), 1)
        with Session(self.engine) as db:
            count = db.scalar(select(func.count(main.TwilioMessage.id)))
            message = db.scalar(select(main.TwilioMessage))
            self.assertEqual(count, 1)
            self.assertEqual(message.direction, "inbound")
            self.assertEqual(message.sender, "+14155550000")
            self.assertEqual(message.body, "Is this available?")

    def test_bad_webhook_signature_is_rejected(self):
        self.assertEqual(self.connect().status_code, 200)
        response = self.client.post(
            "/api/webhooks/twilio",
            data={
                "AccountSid": "AC" + "a" * 32,
                "MessageSid": "SM" + "c" * 32,
                "From": "+14155550000",
                "To": "+14155552671",
                "Body": "Hello",
            },
            headers={"X-Twilio-Signature": "invalid"},
        )
        self.assertEqual(response.status_code, 401)

    def test_signed_status_callback_updates_delivery_and_filters(self):
        self.assertEqual(self.connect().status_code, 200)
        sent = self.client.post(
            "/api/twilio/send",
            json={"to": "+14155559876", "body": "Hello", "channel": "sms"},
            headers=self.headers,
        )
        self.assertEqual(sent.status_code, 201)
        fields = {
            "AccountSid": "AC" + "a" * 32,
            "MessageSid": "SM" + "b" * 32,
            "MessageStatus": "delivered",
            "ErrorCode": "",
        }
        url = "http://testserver/api/webhooks/twilio/status"
        signature = RequestValidator("private-auth-token").compute_signature(url, fields)
        callback = self.client.post(
            "/api/webhooks/twilio/status",
            data=fields,
            headers={"X-Twilio-Signature": signature},
        )
        self.assertEqual(callback.status_code, 200, callback.text)
        filtered = self.client.get(
            "/api/twilio/messages?direction=outbound&status=delivered&phone=%2B14155559876",
            headers=self.headers,
        )
        self.assertEqual(filtered.status_code, 200, filtered.text)
        self.assertEqual(len(filtered.json()), 1)
        self.assertEqual(filtered.json()[0]["status"], "delivered")


if __name__ == "__main__":
    unittest.main()
