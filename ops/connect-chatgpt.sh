#!/usr/bin/env bash
# Run from an SSH session forwarding local port 1455 to this VPS's port 1455.
set -euo pipefail
cd /home/vangaard/bizbuddy
export CHATGPT_CREDENTIALS_FILE=/home/vangaard/bizbuddy/backend/.chatgpt/credentials.json
export CHATGPT_MODEL=gpt-6-luna
backend/.venv/bin/python ops/chatgpt-login.py
# Verify a real completed response before selecting this provider in production.
backend/.venv/bin/python - <<'PY'
import asyncio
import os
import sys
from pathlib import Path
sys.path.insert(0, str(Path.cwd() / 'backend'))
from dotenv import set_key
import chatgpt_provider
result = asyncio.run(chatgpt_provider.generate('Return only JSON: {"reply":"Connected","needs_human":false,"order_request":false}'))
if result is None:
    raise SystemExit('Connection saved but model verification failed: ' + chatgpt_provider.status()['state'] + '. The current production provider was not changed.')
path = Path('backend/.env')
for key, value in {'BIZBUDDY_AI_PROVIDER': 'chatgpt', 'CHATGPT_MODEL': os.environ['CHATGPT_MODEL'], 'CHATGPT_CREDENTIALS_FILE': os.environ['CHATGPT_CREDENTIALS_FILE']}.items():
    set_key(path, key, value)
path.chmod(0o600)
print('GPT-6-Luna completed a real response using ChatGPT plan authorization.')
PY
sudo systemctl restart bizbuddy-api.service
echo 'BizBuddy is now using Sign in with ChatGPT. Manage plan usage at https://chatgpt.com/settings/usage.'
