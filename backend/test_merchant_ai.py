import asyncio
from datetime import datetime, timezone
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import AsyncMock, patch

from cryptography.fernet import Fernet
from fastapi.testclient import TestClient
import httpx
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
import main
import merchant_ai

ANSWER = {'reply': 'Monday to Saturday, 9 AM to 6 PM.', 'needs_human': False, 'order_request': False}
SECRET = 'merchant-private-key-123456789'


class MerchantAITests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.old_engine = main.engine
        main.engine = create_engine('sqlite:///' + str(Path(cls.temp.name) / 'app.db'), connect_args={'check_same_thread': False})
        cls.env = patch.dict(os.environ, {'BIZBUDDY_AI_PROVIDER': 'grounded', 'OPENAI_API_KEY': '', 'CHATBOT_ENCRYPTION_KEY': Fernet.generate_key().decode(), 'BIZBUDDY_CHATGPT_PARTNER_APPROVED': 'false', 'BIZBUDDY_PROTOTYPE_MODE': 'false'})
        cls.env.start()
        cls.client = TestClient(main.app)
        cls.client.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls.client.__exit__(None, None, None)
        main.engine.dispose()
        main.engine = cls.old_engine
        cls.env.stop()
        cls.temp.cleanup()

    def setUp(self):
        main._rate_windows.clear()
        from uuid import uuid4
        self.email = 'merchant-' + uuid4().hex + '@example.com'
        self.headers, self.owner = self.register(self.email)
        self.other_headers, self.other = self.register('other-' + self.email)

    def tearDown(self):
        main._rate_windows.clear()

    def register(self, email):
        result = self.client.post('/api/auth/register', json={'name': 'Ada', 'email': email, 'password': 'private-test-password', 'business': 'Ada fabrics'})
        self.assertEqual(result.status_code, 201)
        with Session(main.engine) as db:
            owner = db.scalar(select(main.User).where(main.User.email == email)).id
        return {'Authorization': 'Bearer ' + result.json()['token']}, owner

    def connect(self, **overrides):
        data = {'provider': 'openai', 'api_key': SECRET, 'model': 'gpt-6-luna', 'consent': True, 'monthly_limit': 10, **overrides}
        with patch('merchant_ai.provider_reply', AsyncMock(return_value=ANSWER)):
            return self.client.post('/api/assistant/connection', headers=self.headers, json=data)

    def test_settings_are_authenticated_private_and_encrypted(self):
        self.assertEqual(self.client.get('/api/assistant/connection').status_code, 401)
        response = self.connect()
        self.assertEqual(response.status_code, 200, response.text)
        self.assertNotIn(SECRET, response.text)
        self.assertTrue(response.json()['key_connected'])
        other = self.client.get('/api/assistant/connection', headers=self.other_headers).json()
        self.assertFalse(other['key_connected'])
        self.assertEqual(other['source'], 'grounded')
        with Session(main.engine) as db:
            row = db.get(main.AISettings, self.owner)
            self.assertNotIn(SECRET, row.encrypted_credentials)
            self.assertEqual(main.decrypt_channel_credentials(row)['api_key'], SECRET)

    def test_verification_failure_preserves_previous_connection(self):
        self.connect()
        with patch('merchant_ai.provider_reply', AsyncMock(side_effect=httpx.ConnectError('no network'))):
            response = self.client.post('/api/assistant/connection', headers=self.headers, json={'provider': 'groq', 'api_key': SECRET+'-new', 'model': 'test-model', 'consent': True})
        self.assertEqual(response.status_code, 422)
        status = self.client.get('/api/assistant/connection', headers=self.headers).json()
        self.assertEqual(status['provider'], 'openai')
        self.assertEqual(status['model'], 'gpt-6-luna')
        self.assertNotIn(SECRET, response.text)

    def test_validation_does_not_echo_keys_or_accept_custom_upstreams(self):
        for provider in ['http://127.0.0.1:8000', 'unknown']:
            response = self.connect(provider=provider)
            self.assertEqual(response.status_code, 422)
            self.assertNotIn(SECRET, response.text)
        self.assertEqual(self.connect(consent=False).status_code, 422)

    def test_public_plan_catalogue_has_four_tiers_and_clear_annual_totals(self):
        response = self.client.get('/api/plans')
        self.assertEqual(response.status_code, 200)
        plans = response.json()
        self.assertFalse(plans['checkout_enabled'])
        self.assertEqual(plans['currency'], 'NGN')
        self.assertEqual([p['id'] for p in plans['tiers']], ['free', 'starter', 'growth', 'business'])
        self.assertEqual([p['monthly_price'] for p in plans['tiers']], [0, 5000, 15000, 35000])
        for tier in plans['tiers']:
            self.assertEqual(tier['annual_price'], tier['monthly_price'] * 10)

    def test_chatgpt_entitlement_is_not_granted_to_new_merchants(self):
        with patch.dict(os.environ, {'BIZBUDDY_AI_PROVIDER': 'chatgpt', 'BIZBUDDY_CHATGPT_OWNER_IDS': str(self.owner)}):
            self.assertTrue(main.merchant_ai_status(self.owner)['managed_available'])
            self.assertFalse(main.merchant_ai_status(self.other)['managed_available'])
            response = self.client.put('/api/assistant/source', headers=self.other_headers, json={'source': 'managed'})
            self.assertEqual(response.status_code, 409)
            self.assertFalse(self.client.get('/api/plans').json()['managed_available'])

    def test_prototype_defaults_cover_existing_and_new_accounts_without_resetting_usage(self):
        self.connect()
        self.client.put('/api/onboarding/progress', headers=self.other_headers, json={'step': 1})
        month = datetime.now(timezone.utc).strftime('%Y-%m')
        with Session(main.engine) as db:
            db.add(main.AIRequest(owner_id=self.owner, month=month, source='managed', state='success'))
            db.commit()
        with patch.dict(os.environ, {'BIZBUDDY_PROTOTYPE_MODE': 'true', 'BIZBUDDY_AI_PROVIDER': 'chatgpt', 'BIZBUDDY_CHATGPT_OWNER_IDS': '0', 'BIZBUDDY_MANAGED_AI_LIMIT': '999'}):
            main.enable_prototype_managed_ai()
            for owner in (self.owner, self.other):
                status = main.merchant_ai_status(owner)
                self.assertTrue(status['managed_available'])
                self.assertEqual(status['source'], 'managed')
                self.assertEqual(status['monthly_limit'], 100)
            self.assertEqual(main.merchant_ai_status(self.owner)['used'], 1)
            self.assertTrue(main.merchant_ai_status(self.owner)['key_connected'])
            self.assertEqual(main.enable_prototype_managed_ai()['updated_existing_settings'], 0)
            headers, owner = self.register('new-prototype-' + self.email)
            self.assertEqual(self.client.get('/api/onboarding', headers=headers).json()['engine']['source'], 'managed')
            self.assertEqual(main.merchant_ai_status(owner)['used'], 0)
            with patch('ai_provider.generate', AsyncMock(return_value=ANSWER)) as reply:
                result = asyncio.run(main.merchant_ai_generate(owner, 'Opening hours?'))
            self.assertEqual(result['_source'], 'managed')
            reply.assert_awaited_once()
            plans = self.client.get('/api/plans').json()
            self.assertTrue(plans['managed_available'])
            self.assertIn('100 managed AI replies / month', plans['tiers'][0]['features'])

    def test_prototype_managed_cap_is_per_account_and_resets_by_utc_month(self):
        with patch.dict(os.environ, {'BIZBUDDY_PROTOTYPE_MODE': 'true', 'BIZBUDDY_AI_PROVIDER': 'chatgpt', 'BIZBUDDY_MANAGED_AI_LIMIT': '999'}):
            month = datetime.now(timezone.utc).strftime('%Y-%m')
            with Session(main.engine) as db:
                for _ in range(99):
                    db.add(main.AIRequest(owner_id=self.owner, month=month, source='managed', state='success'))
                db.add(main.AIRequest(owner_id=self.owner, month='2000-01', source='managed', state='success'))
                db.add(main.AIRequest(owner_id=self.owner, month=month, source='managed', state='fallback'))
                db.commit()
            async def delayed(*_):
                await asyncio.sleep(.05)
                return ANSWER
            async def run():
                return await asyncio.gather(main.merchant_ai_generate(self.owner, 'One'), main.merchant_ai_generate(self.owner, 'Two'))
            with patch('ai_provider.generate', side_effect=delayed) as reply:
                answers = asyncio.run(run())
                self.assertEqual(sum(answer is not None for answer in answers), 1)
                self.assertIsNone(asyncio.run(main.merchant_ai_generate(self.owner, 'Over cap')))
                self.assertIsNotNone(asyncio.run(main.merchant_ai_generate(self.other, 'Separate quota')))
            self.assertEqual(reply.call_count, 2)
            self.assertEqual(main.merchant_ai_status(self.owner)['state'], 'limit_reached')
            self.assertEqual(main.merchant_ai_status(self.owner)['used'], 100)
            self.assertEqual(main.merchant_ai_status(self.other)['used'], 1)

    def test_tenant_key_and_provider_selected_for_customer_reply(self):
        self.connect()
        with patch('merchant_ai.provider_reply', AsyncMock(return_value=ANSWER)) as reply:
            answer = asyncio.run(main.merchant_ai_generate(self.owner, 'Owner knowledge'))
            other = asyncio.run(main.merchant_ai_generate(self.other, 'Other knowledge'))
        self.assertEqual(answer['_source'], 'byok')
        self.assertIsNone(other)
        reply.assert_awaited_once_with('openai', SECRET, 'gpt-6-luna', 'Owner knowledge')
        self.assertEqual(main.merchant_ai_status(self.owner)['used'], 1)
        self.assertEqual(main.merchant_ai_status(self.other)['used'], 0)

    def test_monthly_cap_and_concurrent_reservations(self):
        self.connect()
        with Session(main.engine) as db:
            for _ in range(9):
                db.add(main.AIRequest(owner_id=self.owner, month=datetime.now(timezone.utc).strftime('%Y-%m'), source='byok', model='gpt-6-luna', state='success'))
            db.commit()
        async def delayed(*_):
            await asyncio.sleep(.05)
            return ANSWER
        async def run():
            return await asyncio.gather(main.merchant_ai_generate(self.owner, 'First'), main.merchant_ai_generate(self.owner, 'Second'))
        with patch('merchant_ai.provider_reply', side_effect=delayed):
            answers = asyncio.run(run())
        self.assertEqual(sum(answer is not None for answer in answers), 1)
        self.assertEqual(main.merchant_ai_status(self.owner)['used'], 10)
        self.assertEqual(main.merchant_ai_status(self.owner)['state'], 'limit_reached')

    def test_failed_requests_release_reservation_and_report_rejected_key(self):
        self.connect()
        response = httpx.Response(401, request=httpx.Request('POST', 'https://api.openai.com/v1/chat/completions'))
        with patch('merchant_ai.provider_reply', AsyncMock(side_effect=httpx.HTTPStatusError('rejected', request=response.request, response=response))):
            self.assertIsNone(asyncio.run(main.merchant_ai_generate(self.owner, 'Hello')))
        status = main.merchant_ai_status(self.owner)
        self.assertEqual(status['used'], 0)
        self.assertEqual(status['state'], 'key_rejected')

    def test_disconnect_clears_credentials_and_uses_facts(self):
        self.connect()
        response = self.client.delete('/api/assistant/connection', headers=self.headers)
        self.assertFalse(response.json()['key_connected'])
        self.assertEqual(response.json()['source'], 'grounded')
        with Session(main.engine) as db:
            self.assertEqual(db.get(main.AISettings, self.owner).encrypted_credentials, '')

    def test_skip_and_resume_setup_are_persistent(self):
        self.client.put('/api/onboarding/progress', headers=self.headers, json={'step': 2, 'skipped': True})
        data = self.client.get('/api/onboarding', headers=self.headers).json()
        self.assertEqual(data['step'], 2)
        self.assertTrue(data['skipped'])
        self.assertFalse(data['completed'])

    def test_knowledge_test_activation_and_public_reply_end_to_end(self):
        self.assertEqual(self.client.post('/api/onboarding/activate', headers=self.headers).status_code, 409)
        response = self.client.put('/api/onboarding/knowledge', headers=self.headers, json={'business_description': 'We sell fabrics and tailoring services.', 'operating_hours': 'Monday to Saturday, 9 AM to 6 PM.'})
        self.assertEqual(response.status_code, 200)
        tested = self.client.post('/api/onboarding/test', headers=self.headers, json={'message': 'What are your opening hours?'}).json()
        self.assertEqual(tested['reply_source'], 'saved_facts')
        self.assertFalse(tested['needs_human'])
        active = self.client.post('/api/onboarding/activate', headers=self.headers)
        self.assertEqual(active.status_code, 200, active.text)
        self.assertTrue(self.client.get('/api/onboarding', headers=self.headers).json()['completed'])
        bot = self.client.get('/api/chatbot', headers=self.headers).json()
        public = self.client.post('/api/public/chat', headers={'Origin': bot['website_domain']}, json={'public_id': bot['public_id'], 'message': 'What are your opening hours?'})
        self.assertEqual(public.status_code, 200, public.text)
        self.assertIn('9 AM', public.json()['reply'])
        self.assertFalse(self.client.get('/api/chatbot', headers=self.other_headers).json()['enabled'])

    def test_unknown_answer_prevents_activation(self):
        self.client.put('/api/onboarding/knowledge', headers=self.headers, json={'business_description': 'We sell fabrics and tailoring services.', 'operating_hours': '9 AM to 6 PM'})
        response = self.client.post('/api/onboarding/test', headers=self.headers, json={'message': 'What is the price of an unlisted jet engine?'})
        self.assertTrue(response.json()['needs_human'])
        self.assertEqual(self.client.post('/api/onboarding/activate', headers=self.headers).status_code, 409)

    def test_managed_access_request_is_saved_per_owner(self):
        self.client.post('/api/assistant/managed-access', headers=self.headers)
        self.assertTrue(main.merchant_ai_status(self.owner)['requested_access'])
        self.assertFalse(main.merchant_ai_status(self.other)['requested_access'])

    def test_editing_knowledge_invalidates_previous_activation_test(self):
        self.client.put('/api/onboarding/knowledge', headers=self.headers, json={'business_description': 'We sell confirmed fabrics.', 'operating_hours': '9 AM to 6 PM'})
        self.client.post('/api/onboarding/test', headers=self.headers, json={'message': 'What are your opening hours?'})
        bot = self.client.get('/api/chatbot', headers=self.headers).json()
        self.client.put('/api/chatbot', headers=self.headers, json={**bot, 'operating_hours': '10 AM to 5 PM'})
        self.assertFalse(self.client.get('/api/onboarding', headers=self.headers).json()['test_passed'])
        self.assertEqual(self.client.post('/api/onboarding/activate', headers=self.headers).status_code, 409)

    def test_stale_and_previous_month_reservations_do_not_consume_current_cap(self):
        self.connect()
        with Session(main.engine) as db:
            for _ in range(10):
                db.add(main.AIRequest(owner_id=self.owner, month=datetime.now(timezone.utc).strftime('%Y-%m'), source='byok', state='reserved', created_at='2000-01-01T00:00:00+00:00'))
                db.add(main.AIRequest(owner_id=self.owner, month='2000-01', source='byok', state='success'))
            db.commit()
        self.assertEqual(main.merchant_ai_status(self.owner)['used'], 0)

    def test_provider_http_contract_uses_fixed_upstream_and_no_tools(self):
        original = httpx.AsyncClient
        calls = []
        def handle(request):
            import json
            calls.append(request)
            self.assertEqual(str(request.url), 'https://api.groq.com/openai/v1/chat/completions')
            body = json.loads(request.content)
            self.assertNotIn('tools', body)
            self.assertEqual(body['response_format'], {'type': 'json_object'})
            self.assertEqual(request.headers['Authorization'], 'Bearer ' + SECRET)
            return httpx.Response(200, json={'choices': [{'message': {'content': json.dumps(ANSWER)}}]})
        with patch.object(merchant_ai.httpx, 'AsyncClient', lambda **kw: original(transport=httpx.MockTransport(handle), **kw)):
            self.assertEqual(asyncio.run(merchant_ai.provider_reply('groq', SECRET, 'test-model', 'Business facts')), ANSWER)
        self.assertEqual(len(calls), 1)

    def test_connection_change_during_request_discards_old_model_reply(self):
        self.connect()
        async def changed(*_):
            with Session(main.engine) as db:
                row = db.get(main.AISettings, self.owner)
                row.source = 'grounded'
                row.revision += 1
                db.commit()
            return ANSWER
        with patch('merchant_ai.provider_reply', side_effect=changed):
            self.assertIsNone(asyncio.run(main.merchant_ai_generate(self.owner, 'A customer question')))
        self.assertEqual(main.merchant_ai_status(self.owner)['used'], 0)


if __name__ == '__main__':
    unittest.main()
