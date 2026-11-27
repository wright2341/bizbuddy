"""HTTP-level checks for the gateway, release switching, and API proxy."""
import json
import os
from pathlib import Path
import socket
import subprocess
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


class API(BaseHTTPRequestHandler):
    def do_POST(self):
        body = self.rfile.read(int(self.headers.get('Content-Length', 0)))
        self.send_response(201)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({'path': self.path, 'body': body.decode()}).encode())

    def log_message(self, *args):
        pass


class GatewayTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.state = Path(cls.temp.name)
        (cls.state / 'releases').mkdir()
        cls.a, cls.b = cls.state / 'releases' / ('a' * 40), cls.state / 'releases' / ('b' * 40)
        for release, text in ((cls.a, 'FIRST'), (cls.b, 'SECOND')):
            (release / 'dist/assets').mkdir(parents=True)
            (release / 'dist/index.html').write_text(text)
        (cls.a / 'dist/assets/old.js').write_text('old asset')
        (cls.state / 'current').symlink_to(cls.a)
        cls.api = ThreadingHTTPServer(('127.0.0.1', 0), API)
        cls.thread = threading.Thread(target=cls.api.serve_forever, daemon=True)
        cls.thread.start()
        with socket.socket() as listener:
            listener.bind(('127.0.0.1', 0))
            port = listener.getsockname()[1]
        cls.base = f'http://127.0.0.1:{port}'
        env = {**os.environ, 'BIZBUDDY_STATE': str(cls.state), 'BIZBUDDY_HOST': '127.0.0.1', 'BIZBUDDY_PORT': str(port), 'BIZBUDDY_API_PORT': str(cls.api.server_port)}
        cls.process = subprocess.Popen(['node', str(Path(__file__).with_name('gateway.mjs'))], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        for _ in range(100):
            try:
                urllib.request.urlopen(cls.base, timeout=1).close()
                break
            except OSError:
                time.sleep(.05)
        else:
            raise RuntimeError('Gateway did not start')

    @classmethod
    def tearDownClass(cls):
        cls.process.terminate()
        cls.process.wait(timeout=8)
        cls.process.stderr.close()
        cls.api.shutdown()
        cls.api.server_close()
        cls.temp.cleanup()

    def test_1_static_routes_and_private_files(self):
        for path in ('/', '/signin', '/register', '/demo', '/dashboard', '/dashboard/inventory', '/dashboard/inbox', '/chat/public-id'):
            self.assertEqual(urllib.request.urlopen(self.base + path).read(), b'FIRST')
        for path in ('/backend/.env', '/backend/bizbuddy.db', '/src/App.jsx', '/.git/config', '/assets/missing.js'):
            with self.assertRaises(urllib.error.HTTPError) as error:
                urllib.request.urlopen(self.base + path)
            self.assertEqual(error.exception.code, 404)
            error.exception.close()
        asset = urllib.request.urlopen(self.base + '/assets/old.js')
        self.assertIn('immutable', asset.headers['Cache-Control'])

    def test_2_proxy_preserves_method_body_and_status(self):
        req = urllib.request.Request(self.base + '/api/example?query=1', data=b'{"hello":true}', headers={'Content-Type':'application/json'})
        response = urllib.request.urlopen(req)
        self.assertEqual(response.status, 201)
        body = json.load(response)
        self.assertEqual(body['path'], '/api/example?query=1')
        self.assertEqual(body['body'], '{"hello":true}')

    def test_3_atomic_release_and_old_assets(self):
        temporary = self.state / 'next'
        temporary.symlink_to(self.b)
        temporary.replace(self.state / 'current')
        self.assertEqual(urllib.request.urlopen(self.base).read(), b'SECOND')
        self.assertEqual(urllib.request.urlopen(self.base + '/assets/old.js').read(), b'old asset')
        self.assertEqual(json.load(urllib.request.urlopen(self.base + '/__deployment'))['commit'], 'b' * 40)


if __name__ == '__main__':
    unittest.main()
