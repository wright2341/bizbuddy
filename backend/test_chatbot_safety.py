import json
import os
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import main


class FakeOpenAIClient:
    def __init__(self, reply):
        async def create(**kwargs):
            return SimpleNamespace(
                choices=[
                    SimpleNamespace(
                        message=SimpleNamespace(content=json.dumps(reply))
                    )
                ]
            )

        self.chat = SimpleNamespace(
            completions=SimpleNamespace(create=create)
        )

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_value, traceback):
        return False


class ChatbotPricingSafetyTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.chatbot = main.Chatbot(
            name="Shop assistant",
            business_name="Sample Shop",
            welcome_message="Welcome.",
            personality="Helpful",
            response_tone="Professional",
            business_description="",
            products=json.dumps([
                {
                    "name": "Blue scarf",
                    "price": "₦5,000",
                    "availability": "In stock",
                    "description": "Cotton",
                }
            ]),
            faqs="[]",
            operating_hours="",
            delivery_policy="",
            payment_policy="",
        )

    async def get_reply(self, message, reply):
        with patch.dict(os.environ, {"OPENAI_API_KEY": "test-key", "BIZBUDDY_AI_PROVIDER": "openai"}):
            with patch("main.AsyncOpenAI", return_value=FakeOpenAIClient(reply)):
                return await main.generate_chatbot_reply(
                    self.chatbot,
                    [{"role": "user", "content": message}],
                )

    async def test_unlisted_price_is_referred_to_owner(self):
        result = await self.get_reply(
            "What is the price of the Blue scarf?",
            {
                "reply": "The Blue scarf costs ₦9,000.",
                "needs_human": False,
                "order_request": False,
            },
        )

        self.assertTrue(result["needs_human"])
        self.assertNotIn("9,000", result["reply"])

    async def test_known_product_without_price_is_referred_to_owner(self):
        self.chatbot.products = json.dumps([
            {
                "name": "Blue scarf",
                "price": "",
                "availability": "In stock",
                "description": "Cotton",
            }
        ])
        result = await self.get_reply(
            "How much is the Blue scarf?",
            {
                "reply": "The Blue scarf costs ₦2,500.",
                "needs_human": False,
                "order_request": False,
            },
        )

        self.assertTrue(result["needs_human"])
        self.assertNotIn("2,500", result["reply"])

    async def test_configured_price_can_be_shared(self):
        result = await self.get_reply(
            "What is the price of the Blue scarf?",
            {
                "reply": "The Blue scarf costs ₦5,000.",
                "needs_human": False,
                "order_request": False,
            },
        )

        self.assertFalse(result["needs_human"])
        self.assertEqual(result["reply"], "The Blue scarf costs ₦5,000.")

    async def test_opencode_cannot_bypass_price_guard(self):
        with patch.dict(os.environ, {"BIZBUDDY_AI_PROVIDER": "opencode"}), patch('ai_provider.generate', AsyncMock(return_value={"reply": "The Blue scarf costs ₦9,000.", "needs_human": False, "order_request": False})):
            result = await main.generate_chatbot_reply(self.chatbot, [{"role":"user", "content":"What is the price of the Blue scarf?"}])
        self.assertTrue(result['needs_human'])
        self.assertNotIn('9,000', result['reply'])


if __name__ == "__main__":
    unittest.main()
