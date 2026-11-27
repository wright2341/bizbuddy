"""Key-free, deterministic replies drawn only from owner-provided knowledge."""
import re


def answer(knowledge, message):
    text = message.lower().strip()
    handoff = {"reply": "The owner will confirm that for you. I've flagged this conversation for their attention.", "needs_human": True, "order_request": False}
    if re.search(r"\b(order|buy|purchase|reserve)\b", text):
        return {**handoff, "reply": "I've recorded your order request. The owner will confirm availability, final price and delivery before accepting it.", "order_request": True}
    if re.search(r"\b(ignore|override|system|instructions|discount|refund|paid|transfer|complaint)\b", text):
        return handoff
    if text in ('hi', 'hello', 'hey', '/start'):
        return {"reply": f"Hello! Welcome to {knowledge['business_name'] or 'our shop'}. Ask about a product, delivery or opening hours.", "needs_human": False, "order_request": False}
    for pattern, key in [(r'\b(hours|open|opening|close)\b', 'operating_hours'), (r'\b(delivery|deliver|shipping|dispatch)\b', 'delivery_policy'), (r'\b(payment|pay)\b', 'payment_policy')]:
        if re.search(pattern, text):
            # A general policy must never imply an unconfigured destination/fee/date.
            if key == 'delivery_policy' and re.search(r'\b(to|when|tomorrow|today|cost|fee|how much)\b', text):
                return handoff
            fact = knowledge.get(key)
            return {"reply": fact, "needs_human": False, "order_request": False} if fact else handoff
    for faq in knowledge.get('frequently_asked_questions', []):
        if faq['question'].lower().strip(' ?.!') == text.strip(' ?.!'):
            return {"reply": faq['answer'], "needs_human": False, "order_request": False}
    products = knowledge.get('products_and_services', [])
    matches = [p for p in products if re.search(r'(?<!\w)' + re.escape(p['name'].lower()) + r'(?!\w)', text)]
    if len(matches) == 1:
        p = matches[0]
        remainder = re.sub(re.escape(p['name'].lower()), '', text)
        allowed = {'hi','hello','hey','please','what','is','are','the','a','an','of','for','your','price','cost','how','much','does','it','in','stock','available','availability','still','do','you','have','tell','me','about','description','and','can','i','see','details'}
        if set(re.findall(r'[a-z]+', remainder)) - allowed:
            return handoff
        if re.search(r'\b(price|cost|much)\b', text) and not p.get('price'):
            return handoff
        if re.search(r'\b(stock|available|availability)\b', text) and not p.get('availability'):
            return handoff
        facts = [p['name'], p.get('price'), p.get('availability'), p.get('description')]
        return {"reply": ' — '.join(str(f) for f in facts if f), "needs_human": False, "order_request": False}
    if re.search(r'\b(products|catalog|catalogue|sell)\b', text) and products:
        return {"reply": 'Our catalogue: ' + '; '.join(p['name'] + (f" ({p['price']})" if p.get('price') else '') for p in products), "needs_human": False, "order_request": False}
    return handoff
