#!/usr/bin/env python3
"""Operator-only, loopback Sign in with ChatGPT. Run using backend/.venv/bin/python."""
import base64
import hashlib
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import os
from pathlib import Path
import secrets
import sys
import time
from urllib.parse import parse_qs, urlencode, urlsplit
from uuid import uuid4

import httpx
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding, rsa

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
from chatgpt_provider import API, TOKEN_URL, credential_path, save_credentials


def decode(value):
    return base64.urlsafe_b64decode(value + '=' * (-len(value) % 4))


def validate_identity(token, client_id, nonce, jwks):
    head, body, signature = token.split('.')
    header, claims = json.loads(decode(head)), json.loads(decode(body))
    if header.get('alg') != 'RS256':
        raise ValueError('Unsupported identity signature')
    key = next(k for k in jwks['keys'] if k['kid'] == header['kid'])
    public = rsa.RSAPublicNumbers(int.from_bytes(decode(key['e'])), int.from_bytes(decode(key['n']))).public_key()
    public.verify(decode(signature), (head + '.' + body).encode(), padding.PKCS1v15(), hashes.SHA256())
    audience = claims.get('aud', [])
    if isinstance(audience, str):
        audience = [audience]
    if claims.get('iss') != 'https://auth.openai.com' or client_id not in audience or claims.get('exp', 0) <= time.time() or claims.get('nonce') != nonce or not claims.get('sub'):
        raise ValueError('Identity validation failed')
    if len(audience) > 1 and claims.get('azp') != client_id:
        raise ValueError('Unexpected authorized party')
    return claims


def main():
    directory = credential_path().parent
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    host_file = directory / 'host-id'
    try:
        with host_file.open('x') as stream:
            os.chmod(host_file, 0o600)
            stream.write('urn:uuid:' + str(uuid4()))
    except FileExistsError:
        pass
    state, nonce, verifier = (secrets.token_urlsafe(32) for _ in range(3))
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip('=')
    callback = 'http://127.0.0.1:1455/auth/callback'
    params = {'client_id': 'dynamic_agent_client', 'agent_name_hint': 'BizBuddy',
              'ext_agent_host_id': host_file.read_text().strip(), 'response_type': 'code',
              'redirect_uri': callback, 'scope': 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct',
              'resource': API, 'state': state, 'nonce': nonce,
              'code_challenge_method': 'S256', 'code_challenge': challenge}
    # Reuse this installation's existing registration; never import another tool's credentials.
    if credential_path().exists():
        previous = json.loads(credential_path().read_text())
        params['client_id'] = previous['client_id']
        params.pop('agent_name_hint')
    else:
        previous = None
    outcome = {}

    class Callback(BaseHTTPRequestHandler):
        def log_message(self, *_):
            pass  # Never log codes or OAuth callback URLs.

        def do_GET(self):
            parsed = urlsplit(self.path)
            values = parse_qs(parsed.query)
            if parsed.path != '/auth/callback' or not secrets.compare_digest(values.get('state', [''])[0], state):
                self.send_error(400, 'Invalid sign-in attempt')
                return
            try:
                if 'error' in values:
                    raise ValueError('Sign-in or ChatGPT plan permission was declined')
                issued = values.get('client_id', [params['client_id']])[0]
                if issued == 'dynamic_agent_client' or (previous and issued != previous['client_id']):
                    raise ValueError('Missing or mismatched registration')
                with httpx.Client(timeout=20, follow_redirects=False) as client:
                    response = client.post(TOKEN_URL, data={'grant_type': 'authorization_code', 'client_id': issued,
                        'code': values['code'][0], 'code_verifier': verifier, 'redirect_uri': callback, 'resource': API})
                    response.raise_for_status()
                    tokens = response.json()
                    keys = client.get('https://auth.openai.com/.well-known/jwks.json')
                    keys.raise_for_status()
                    identity = validate_identity(tokens['id_token'], issued, nonce, keys.json())
                    if previous and (identity['sub'] != previous['subject'] or identity['iss'] != previous['issuer']):
                        raise ValueError('This registration belongs to a different account')
                    scopes = tokens.get('scope', '').split()
                    if not {'resource.invoke', 'chatgpt.tokens.use.direct'}.issubset(scopes):
                        raise ValueError('ChatGPT plan usage was not authorized')
                    record = {**tokens, 'client_id': issued, 'ext_agent_host_id': params['ext_agent_host_id'],
                        'subject': identity['sub'], 'issuer': identity['iss'], 'email': identity.get('email', ''),
                        'scopes': scopes, 'expires_at': time.time() + tokens.get('expires_in', 3600)}
                    catalog = client.get(API + '/models', headers={'Authorization': 'Bearer ' + tokens['access_token']})
                    catalog.raise_for_status()
                    models = [m['slug'] for m in catalog.json().get('models', []) if m.get('visibility') == 'list']
                    save_credentials(record)
                    outcome['models'] = models
                message = 'ChatGPT connected to BizBuddy. You can close this tab.'
            except Exception:
                outcome['error'] = True
                message = 'Connection failed. Return to the terminal and start a fresh sign-in. No credentials were replaced.'
            self.send_response(200 if not outcome.get('error') else 400)
            self.send_header('Content-Type', 'text/plain; charset=utf-8')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Referrer-Policy', 'no-referrer')
            self.end_headers()
            self.wfile.write(message.encode())

    with HTTPServer(('127.0.0.1', 1455), Callback) as server:
        server.timeout = 1
        print('Open this URL in your browser. For a remote VPS, first forward local port 1455 with SSH.', flush=True)
        print('https://auth.openai.com/api/accounts/authorize?' + urlencode(params), flush=True)
        deadline = time.monotonic() + 600
        while not outcome and time.monotonic() < deadline:
            server.handle_request()
    if not outcome or outcome.get('error'):
        raise SystemExit('ChatGPT was not connected. No token or provider error body was logged.')
    print('Connected. Account models: ' + ', '.join(outcome['models']))
    if 'gpt-6-luna' not in outcome['models']:
        print('GPT-6-Luna is not available for this account. No other model was selected.')


if __name__ == '__main__':
    main()
