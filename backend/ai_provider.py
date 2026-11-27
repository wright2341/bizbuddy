"""Bounded, private OpenCode SDK worker with grounded fallback and a cooldown."""
import asyncio
import json
import logging
import os
from pathlib import Path
import time

_process = None
_lock = asyncio.Lock()
_retry_at = 0.0
_state = 'starting'


def configured():
    return os.getenv('BIZBUDDY_AI_PROVIDER', '').lower() == 'opencode'


def status():
    if not configured():
        return {'provider': 'openai' if os.getenv('OPENAI_API_KEY') else 'grounded', 'state': 'configured' if os.getenv('OPENAI_API_KEY') else 'ready', 'fallback': False}
    return {'provider': 'opencode', 'model': os.getenv('OPENCODE_MODEL', 'deepseek-v4.1-flash-free'), 'state': _state, 'fallback': _state != 'ready', 'retry_after': max(0, int(_retry_at - time.monotonic()))}


async def close():
    global _process
    process, _process = _process, None
    if process is not None and process.returncode is None:
        try:
            process.terminate()
        except ProcessLookupError:
            pass
        try:
            await asyncio.wait_for(process.wait(), 2)
        except asyncio.TimeoutError:
            try:
                process.kill()
            except ProcessLookupError:
                pass
            await process.wait()


async def generate(prompt):
    global _process, _retry_at, _state
    if not configured() or len(prompt) > 65000 or time.monotonic() < _retry_at:
        return None
    # A burst never creates unbounded workers or queues customer requests.
    if _lock.locked():
        return None
    async with _lock:
        try:
            if _process is None or _process.returncode is not None:
                runtime = Path(os.environ.get('OPENCODE_RUNTIME_DIR', '/var/lib/bizbuddy/opencode-2.4.2'))
                if not (runtime / 'node_modules/@opencode/sdk/dist/index.js').is_file():
                    raise RuntimeError('runtime unavailable')
                workspace = Path(__file__).resolve().parent / '.opencode-workspace'
                # Production API has write access only to the persistent backend directory.
                workspace = Path(os.getenv('OPENCODE_STATE_DIR', str(workspace)))
                workspace.mkdir(parents=True, exist_ok=True, mode=0o700)
                worker = Path(__file__).resolve().parent.parent / 'ai/opencode/worker.mjs'
                env = {key: os.environ[key] for key in ('PATH', 'LANG', 'TZ') if key in os.environ}
                env.update({'HOME': str(workspace), 'XDG_DATA_HOME': str(workspace/'data'), 'XDG_CACHE_HOME': str(workspace/'cache'), 'XDG_CONFIG_HOME': str(workspace/'config'), 'OPENCODE_RUNTIME_DIR': str(runtime), 'OPENCODE_MODEL': os.getenv('OPENCODE_MODEL', 'deepseek-v4.1-flash-free')})
                _process = await asyncio.create_subprocess_exec('node', str(worker), cwd=workspace, env=env, stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL, limit=128000)
            async def exchange():
                _process.stdin.write((json.dumps({'prompt': prompt})+'\n').encode())
                await _process.stdin.drain()
                return json.loads(await _process.stdout.readline())
            result = await asyncio.wait_for(exchange(), timeout=25)
            if not result.get('ok'):
                _state = result.get('reason') if result.get('reason') in ('limited', 'timeout') else 'unavailable'
                _retry_at = time.monotonic() + 300
                logging.getLogger(__name__).warning('OpenCode SDK %s; grounded replies remain active.', _state)
                await close()
                return None
            content = result.get('text', '').strip()
            if content.startswith('```') and content.endswith('```'):
                content = content.split('\n', 1)[-1].rsplit('```', 1)[0]
            answer = json.loads(content)
            if not isinstance(answer, dict) or not isinstance(answer.get('reply'), str) or not answer['reply'].strip() or len(answer['reply']) > 3000 or type(answer.get('needs_human')) is not bool or type(answer.get('order_request')) is not bool:
                raise ValueError('invalid model response')
            _state = 'ready'
            return answer
        except asyncio.CancelledError:
            await close()
            raise
        except (OSError, ValueError, RuntimeError, asyncio.TimeoutError, ConnectionError):
            _state = 'unavailable'
            _retry_at = time.monotonic() + 300
            await close()
            return None
