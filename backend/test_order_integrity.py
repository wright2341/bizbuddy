import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect, select, text
from sqlalchemy.orm import Session
import main


class OrderIntegrityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.original = main.engine
        main.engine = create_engine('sqlite:///' + str(Path(cls.temp.name) / 'orders.db'), connect_args={'check_same_thread': False})
        cls.environment = patch.dict(os.environ, {'BIZBUDDY_AI_PROVIDER': 'grounded', 'OPENAI_API_KEY': ''})
        cls.environment.start()
        cls.client = TestClient(main.app)
        cls.client.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls.client.__exit__(None, None, None)
        main.engine.dispose()
        main.engine = cls.original
        cls.environment.stop()
        cls.temp.cleanup()

    def setUp(self):
        from uuid import uuid4
        main._rate_windows.clear()
        self.email = 'order-' + uuid4().hex + '@example.com'
        result = self.client.post('/api/auth/register', json={'name': 'QA Owner', 'email': self.email, 'password': 'test-password-123', 'business': 'QA Shop'})
        self.headers = {'Authorization': 'Bearer ' + result.json()['token']}
        self.product = self.client.post('/api/operations/products', headers=self.headers, json={'name': 'Blue canvas', 'price': 800000, 'stock': 10, 'description': 'Blue cotton fabric'}).json()
        self.bot = self.client.post('/api/operations/website/setup', headers=self.headers).json()
        result = self.client.post('/api/public/chat', headers={'Origin': self.bot['website_domain']}, json={'public_id': self.bot['public_id'], 'message': 'I want to order 2 Blue canvas'})
        self.assertEqual(result.status_code, 200, result.text)
        self.pending = self.client.get('/api/chatbot/dashboard', headers=self.headers).json()['order_requests'][0]
        self.url = '/api/operations/order-requests/' + self.pending['id'] + '/confirm'

    def tearDown(self):
        main._rate_windows.clear()

    def edit(self):
        current = next(row for row in self.client.get('/api/operations', headers=self.headers).json()['products'] if row['id'] == self.product['id'])
        return self.client.put('/api/operations/products/' + self.product['id'], headers=self.headers, json={'name': 'Red canvas', 'price': 950000, 'stock': current['stock'], 'description': 'Red synthetic fabric', 'expected_edit_version': current['edit_version']}).json()

    def confirm(self, product=None, **extra):
        product = product or self.product
        return self.client.post(self.url, headers=self.headers, json={'product_id': product['id'], 'quantity': 2, 'expected_version': product['version'], **extra})

    def test_product_changes_preserve_original_pending_snapshot(self):
        self.edit()
        pending = self.client.get('/api/chatbot/dashboard', headers=self.headers).json()['order_requests'][0]
        self.assertEqual(pending['request'], 'I want to order 2 Blue canvas')
        self.assertEqual(pending['captured_products'][0]['name'], 'Blue canvas')
        self.assertEqual(pending['captured_products'][0]['price'], 800000)
        self.assertEqual(pending['captured_products'][0]['description'], 'Blue cotton fabric')
        self.assertEqual(self.client.get('/api/orders', headers=self.headers).json(), [])

    def test_stale_form_cannot_confirm_or_adjust_stock(self):
        current = self.edit()
        stale = self.confirm(reviewed_changes=True)
        self.assertEqual(stale.status_code, 409)
        self.assertIn('form was loaded', stale.json()['detail'])
        self.assertEqual(self.client.get('/api/operations', headers=self.headers).json()['products'][0]['stock'], 10)
        self.assertEqual(self.client.get('/api/chatbot/dashboard', headers=self.headers).json()['pending_order_count'], 1)
        self.assertNotEqual(current['version'], self.product['version'])

    def test_changed_item_needs_explicit_review_then_uses_agreed_current_details(self):
        current = self.edit()
        self.assertEqual(self.confirm(current).status_code, 409)
        confirmed = self.confirm(current, reviewed_changes=True)
        self.assertEqual(confirmed.status_code, 200, confirmed.text)
        orders = self.client.get('/api/orders', headers=self.headers).json()
        self.assertEqual(len(orders), 1)
        self.assertEqual(orders[0]['cuts'], 'Red canvas')
        self.assertEqual(orders[0]['amount'], 'NGN 19,000.00')
        self.assertEqual(self.client.get('/api/operations', headers=self.headers).json()['products'][0]['stock'], 8)
        self.assertEqual(self.confirm(current, reviewed_changes=True).status_code, 409)

    def test_confirmed_order_does_not_change_when_catalogue_or_business_category_changes(self):
        self.assertEqual(self.confirm().status_code, 200)
        before = self.client.get('/api/orders', headers=self.headers).json()
        self.edit()
        profile = self.client.get('/api/profile', headers=self.headers).json()
        changed = self.client.put('/api/profile', headers=self.headers, json={**profile, 'category': 'Retail & boutique'})
        self.assertEqual(changed.status_code, 200)
        self.assertEqual(self.client.get('/api/orders', headers=self.headers).json(), before)
        self.assertEqual(before[0]['cuts'], 'Blue canvas')
        self.assertEqual(before[0]['amount'], 'NGN 16,000.00')

    def test_replacement_product_requires_review(self):
        alternate = self.client.post('/api/operations/products', headers=self.headers, json={'name': 'Replacement linen', 'price': 1000000, 'stock': 3}).json()
        self.assertEqual(self.confirm(alternate).status_code, 409)
        self.assertEqual(self.confirm(alternate, reviewed_changes=True).status_code, 200)

    def test_legacy_requests_are_not_given_fabricated_snapshots(self):
        with Session(main.engine) as db:
            db.get(main.ChatbotOrderRequest, self.pending['id']).catalog_snapshot = None
            db.commit()
        self.assertEqual(self.confirm().status_code, 409)
        self.assertEqual(self.confirm(reviewed_changes=True).status_code, 200)

    def test_owner_must_refresh_even_without_a_product_change(self):
        response = self.client.post(self.url, headers=self.headers, json={'product_id': self.product['id'], 'quantity': 2})
        self.assertEqual(response.status_code, 409)
        self.assertEqual(self.client.get('/api/chatbot/dashboard', headers=self.headers).json()['pending_order_count'], 1)

    def test_manual_pending_order_is_independent_of_catalogue_edits(self):
        created = self.client.post('/api/orders', headers=self.headers, json={'name': 'QA customer', 'channel': 'Walk-in', 'cuts': 'Blue canvas', 'material': 'Blue cotton fabric', 'yards': '2', 'amount': 'NGN 16,000.00', 'status': 'Pending', 'status_class': 'pending', 'time': '2026-11-27'})
        self.assertEqual(created.status_code, 201, created.text)
        before = created.json()
        self.edit()
        after = next(row for row in self.client.get('/api/orders', headers=self.headers).json() if row['id'] == before['id'])
        self.assertEqual(after, before)
        self.assertEqual(after['status'], 'Pending')

    def test_stale_inventory_editor_cannot_restore_stock_after_an_order(self):
        self.assertEqual(self.confirm().status_code, 200)
        response = self.client.put('/api/operations/products/' + self.product['id'], headers=self.headers, json={'name': 'Edited type', 'price': 950000, 'stock': 10, 'description': 'Changed details', 'expected_edit_version': self.product['edit_version']})
        self.assertEqual(response.status_code, 409)
        current = self.client.get('/api/operations', headers=self.headers).json()['products'][0]
        self.assertEqual(current['stock'], 8)
        self.assertEqual(current['name'], 'Blue canvas')


class SnapshotMigrationTests(unittest.TestCase):
    def test_existing_request_text_survives_repeatable_migration(self):
        original = main.engine
        engine = create_engine('sqlite:///:memory:')
        main.engine = engine
        try:
            with engine.begin() as db:
                db.execute(text('CREATE TABLE chatbot_order_requests (id VARCHAR(32) PRIMARY KEY, owner_id INTEGER, conversation_id VARCHAR(32), request TEXT, status VARCHAR(32), created_at DATETIME)'))
                db.execute(text("INSERT INTO chatbot_order_requests VALUES ('legacy', 1, 'conversation', 'Original blue fabric request', 'needs_owner_confirmation', '2026-01-01')"))
            main.seed_database()
            main.seed_database()
            self.assertIn('catalog_snapshot', {c['name'] for c in inspect(engine).get_columns('chatbot_order_requests')})
            with engine.connect() as db:
                row = db.execute(text("SELECT request, catalog_snapshot FROM chatbot_order_requests WHERE id='legacy'")).one()
                self.assertEqual(row.request, 'Original blue fabric request')
                self.assertIsNone(row.catalog_snapshot)
        finally:
            main.engine = original
            engine.dispose()
