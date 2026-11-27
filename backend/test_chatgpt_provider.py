import asyncio
import json
import os
from pathlib import Path
import tempfile
import time
import unittest
from unittest.mock import patch

import httpx
import ai_provider
import chatgpt_provider as provider


class ChatGPTPlanTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.env = patch.dict(os.environ, {'BIZBUDDY_AI_PROVIDER': 'chatgpt',
            'CHATGPT_MODEL': 'gpt-6-luna', 'CHATGPT_CREDENTIALS_FILE': str(Path(self.tmp.name) / 'credentials.json'),
            'OPENAI_API_KEY': 'must-never-be-used'})
        self.env.start()
        provider._lock = asyncio.Lock()
        provider._state = 'sign_in_required'
        provider._retry_at = 0
        self.calls = []
        self.answer = {'reply': 'We open at 9 AM.', 'needs_human': False, 'order_request': False}
        self.failure = None
        self.available = True
        self.complete = True
        self.real_client = httpx.AsyncClient

    async def asyncTearDown(self):
        self.env.stop()
        self.tmp.cleanup()

    def credentials(self, expires_at=None):
        provider.save_credentials({'client_id': 'oaiapp_bizbuddy_test', 'subject': 'owner',
            'access_token': 'subscription-token', 'refresh_token': 'rotating-refresh',
            'scopes': ['chatgpt.tokens.use.direct', 'resource.invoke'],
            'expires_at': expires_at if expires_at is not None else time.time() + 3600})

    def transport(self, request):
        self.calls.append(request)
        if request.url.path.endswith('/oauth/token'):
            return httpx.Response(200, json={'access_token': 'renewed-subscription-token',
                'refresh_token': 'new-refresh', 'expires_in': 3600})
        self.assertIn(request.headers['authorization'], ('Bearer subscription-token', 'Bearer renewed-subscription-token'))
        if request.url.path == '/v1/models':
            return httpx.Response(200, json={'models': [{'slug': 'gpt-6-luna', 'visibility': 'list'}] if self.available else []})
        self.assertEqual(str(request.url), provider.API + '/responses')
        body = json.loads(request.content)
        self.assertFalse(body['store'])
        self.assertTrue(body['stream'])
        self.assertEqual(body['model'], 'gpt-6-luna')
        self.assertNotIn('max_output_tokens', body)
        self.assertIsInstance(body['input'], list)
        events = [{'type': 'response.output_text.delta', 'delta': json.dumps(self.answer)}]
        if self.failure:
            events.append({'type': 'response.failed', 'response': {'error': {'code': self.failure}}})
        elif self.complete:
            events.append({'type': 'response.completed'})
        return httpx.Response(200, text=''.join('data: ' + json.dumps(e) + '\n\n' for e in events))

    async def generate(self):
        with patch.object(provider.httpx, 'AsyncClient', lambda **kw: self.real_client(transport=httpx.MockTransport(self.transport), **kw)):
            return await ai_provider.generate('Saved opening hours: 9 AM. Customer asks when we open.')

    async def test_disconnected_never_uses_api_key_or_network(self):
        self.assertTrue(ai_provider.configured())
        self.assertEqual(ai_provider.status()['state'], 'sign_in_required')
        self.assertIsNone(await self.generate())
        self.assertEqual(self.calls, [])

    async def test_completed_subscription_reply_and_private_credentials(self):
        self.credentials()
        self.assertEqual(provider.credential_path().stat().st_mode & 0o777, 0o600)
        self.assertEqual(await self.generate(), self.answer)
        self.assertEqual(ai_provider.status()['state'], 'ready')

    async def test_failed_terminal_event_discards_partial_reply(self):
        self.credentials()
        self.failure = 'subscription_sharing_usage_limit_exceeded'
        self.assertIsNone(await self.generate())
        self.assertEqual(ai_provider.status()['state'], 'limited')
        count = len(self.calls)
        self.assertIsNone(await self.generate())
        self.assertEqual(len(self.calls), count)

    async def test_interrupted_stream_discards_partial_reply(self):
        self.credentials()
        self.complete = False
        self.assertIsNone(await self.generate())
        self.assertEqual(ai_provider.status()['state'], 'unavailable')

    async def test_unavailable_model_does_not_choose_another_or_infer(self):
        self.credentials()
        self.available = False
        self.assertIsNone(await self.generate())
        self.assertEqual(ai_provider.status()['state'], 'model_unavailable')
        self.assertEqual(len(self.calls), 1)

    async def test_rotating_refresh_saved_before_inference(self):
        self.credentials(expires_at=0)
        self.assertEqual(await self.generate(), self.answer)
        record = provider.read_credentials()
        self.assertEqual(record['refresh_token'], 'new-refresh')
        self.assertEqual(record['access_token'], 'renewed-subscription-token')

    async def test_unapproved_plan_scope_and_unsafe_file_are_rejected(self):
        self.credentials()
        record = provider.read_credentials()
        record['scopes'] = ['openid']
        provider.save_credentials(record)
        self.assertIsNone(await self.generate())
        self.assertEqual(self.calls, [])
        self.credentials()
        provider.credential_path().chmod(0o644)
        self.assertEqual(ai_provider.status()['state'], 'sign_in_required')

    async def test_wrong_json_types_never_reach_customer(self):
        self.credentials()
        self.answer['needs_human'] = 'false'
        self.assertIsNone(await self.generate())


if __name__ == '__main__':
    unittest.main()
