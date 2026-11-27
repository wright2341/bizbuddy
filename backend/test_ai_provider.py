import asyncio
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import AsyncMock, patch

import ai_provider


class OpenCodeProviderTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        runtime = Path(self.tmp.name)
        module = runtime / 'node_modules/@opencode/sdk/dist/index.js'
        module.parent.mkdir(parents=True)
        module.write_text('')
        self.env = patch.dict(os.environ, {'BIZBUDDY_AI_PROVIDER': 'opencode', 'OPENCODE_RUNTIME_DIR': str(runtime), 'OPENCODE_STATE_DIR': str(runtime/'state'), 'OPENAI_API_KEY': 'must-not-reach-worker'})
        self.env.start()
        ai_provider._process = None
        ai_provider._lock = asyncio.Lock()
        ai_provider._retry_at = 0
        ai_provider._state = 'starting'

    async def asyncTearDown(self):
        await ai_provider.close()
        self.env.stop()
        self.tmp.cleanup()

    def process(self, response):
        class Writer:
            def write(self, data):
                self.data = data
            async def drain(self):
                pass
        class Process:
            returncode = None
            stdin = Writer()
            stdout = type('Reader', (), {'readline': AsyncMock(return_value=json.dumps(response).encode()+b'\n')})()
            def terminate(self):
                self.returncode = -15
            def kill(self):
                self.returncode = -9
            async def wait(self):
                return self.returncode
        return Process()

    async def test_valid_reply_and_private_worker_environment(self):
        answer = {'reply': 'Welcome to Ada fabrics.', 'needs_human': False, 'order_request': False}
        proc = self.process({'ok': True, 'text': json.dumps(answer)})
        with patch.object(asyncio, 'create_subprocess_exec', AsyncMock(return_value=proc)) as launch:
            self.assertEqual(await ai_provider.generate('Business knowledge and customer question'), answer)
        self.assertEqual(ai_provider.status()['state'], 'ready')
        env = launch.call_args.kwargs['env']
        self.assertNotIn('OPENAI_API_KEY', env)
        self.assertNotIn('DATABASE_URL', env)
        self.assertEqual(env['HOME'], os.environ['OPENCODE_STATE_DIR'])

    async def test_free_limit_opens_cooldown_without_retrying_provider(self):
        proc = self.process({'ok': False, 'reason': 'limited'})
        with patch.object(asyncio, 'create_subprocess_exec', AsyncMock(return_value=proc)) as launch:
            self.assertIsNone(await ai_provider.generate('Hello'))
            self.assertIsNone(await ai_provider.generate('Hello again'))
            self.assertEqual(launch.await_count, 1)
        self.assertEqual(ai_provider.status()['state'], 'limited')
        self.assertTrue(ai_provider.status()['fallback'])
        self.assertIsNotNone(proc.returncode)

    async def test_malformed_or_wrongly_typed_json_never_reaches_customer(self):
        proc = self.process({'ok': True, 'text': '{"reply":"invented", "needs_human":"false", "order_request":false}'})
        with patch.object(asyncio, 'create_subprocess_exec', AsyncMock(return_value=proc)):
            self.assertIsNone(await ai_provider.generate('Question'))
        self.assertEqual(ai_provider.status()['state'], 'unavailable')

    async def test_busy_worker_falls_back_without_a_queue(self):
        async with ai_provider._lock:
            with patch.object(asyncio, 'create_subprocess_exec', AsyncMock()) as launch:
                self.assertIsNone(await ai_provider.generate('Question'))
                launch.assert_not_called()

    async def test_missing_runtime_keeps_chat_available(self):
        with patch.dict(os.environ, {'OPENCODE_RUNTIME_DIR': self.tmp.name+'/missing'}):
            self.assertIsNone(await ai_provider.generate('Question'))
        self.assertEqual(ai_provider.status()['state'], 'unavailable')

    async def test_worker_exit_falls_back_and_discards_process(self):
        proc = self.process({'ok': True})
        proc.stdout.readline = AsyncMock(return_value=b'')
        with patch.object(asyncio, 'create_subprocess_exec', AsyncMock(return_value=proc)):
            self.assertIsNone(await ai_provider.generate('Question'))
        self.assertIsNone(ai_provider._process)
