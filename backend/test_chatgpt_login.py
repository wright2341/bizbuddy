import base64
import importlib.util
import json
from pathlib import Path
import time
import unittest

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding, rsa

spec = importlib.util.spec_from_file_location('bizbuddy_chatgpt_login', Path(__file__).parents[1] / 'ops/chatgpt-login.py')
login = importlib.util.module_from_spec(spec)
spec.loader.exec_module(login)


def encode(value):
    raw = value if isinstance(value, bytes) else json.dumps(value).encode()
    return base64.urlsafe_b64encode(raw).decode().rstrip('=')


class ChatGPTIdentityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        numbers = cls.key.public_key().public_numbers()
        cls.jwks = {'keys': [{'kid': 'test', 'n': encode(numbers.n.to_bytes(256)), 'e': encode(numbers.e.to_bytes(3))}]}

    def token(self, **overrides):
        claims = {'iss': 'https://auth.openai.com', 'aud': 'oaiapp_test', 'exp': time.time() + 300, 'nonce': 'expected-nonce', 'sub': 'owner', **overrides}
        payload = encode({'alg': 'RS256', 'kid': 'test'}) + '.' + encode(claims)
        return payload + '.' + encode(self.key.sign(payload.encode(), padding.PKCS1v15(), hashes.SHA256()))

    def test_valid_signature_and_identity(self):
        self.assertEqual(login.validate_identity(self.token(), 'oaiapp_test', 'expected-nonce', self.jwks)['sub'], 'owner')

    def test_wrong_nonce_issuer_audience_or_expiry_rejected(self):
        for change in ({'nonce': 'replayed'}, {'iss': 'https://other.example'}, {'aud': 'other-client'}, {'exp': 0}, {'sub': ''}, {'aud': ['oaiapp_test', 'other'], 'azp': 'other'}):
            with self.subTest(change=change), self.assertRaises(ValueError):
                login.validate_identity(self.token(**change), 'oaiapp_test', 'expected-nonce', self.jwks)

    def test_tampered_signature_rejected(self):
        token = self.token().split('.')
        token[1] = encode({'iss': 'https://auth.openai.com', 'aud': 'oaiapp_test', 'exp': time.time()+300, 'nonce': 'expected-nonce', 'sub': 'attacker'})
        with self.assertRaises(InvalidSignature):
            login.validate_identity('.'.join(token), 'oaiapp_test', 'expected-nonce', self.jwks)
