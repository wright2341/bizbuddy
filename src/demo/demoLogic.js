// Local demonstration rules. This module never calls a messaging provider or LLM.
export function createDemoAnswer(message) {
  const text = message.toLowerCase();
  if (/\b(paid|payment made|transfer|transferred|refund|discount)\b/.test(text))
    return {
      text: "Thank you for letting us know. The owner will verify the payment or request before confirming it. I’ve flagged this sample conversation for review.",
      needsOwner: true,
    };
  if (/\b(order|buy|reserve|purchase)\b/.test(text)) {
    const quantity = Number(
      text.match(/\b(\d{1,3})\s*(?:yards?|units?)\b/)?.[1] || 6,
    );
    return {
      text: `I’ve recorded your request for ${quantity} yards of blue ankara. The owner will confirm the stock, final price and delivery before accepting the order.`,
      needsOwner: true,
      order: { product: "Blue ankara", quantity, unitPrice: 800000 },
    };
  }
  if (/\b(ankara|price|cost|much|available|availability|stock)\b/.test(text))
    return {
      text: "In this sample catalogue, blue ankara is ₦8,000 per yard. Ask to place an order and the owner will confirm the quantity and availability.",
      needsOwner: false,
    };
  if (/\b(deliver|delivery|ship|ikeja|abuja)\b/.test(text))
    return {
      text: "I can help with a delivery enquiry. The owner will confirm your location, dispatch time and delivery fee. I won’t promise a delivery date that hasn’t been verified.",
      needsOwner: true,
    };
  if (/\b(hours|open|close)\b/.test(text))
    return {
      text: "The example business is open Monday to Saturday, 9 AM to 6 PM.",
      needsOwner: false,
    };
  if (/\b(invoice|reminder|owe)\b/.test(text))
    return {
      text: "I can help prepare an invoice request. The owner will review the items, quantity and amount before sending an invoice or reminder.",
      needsOwner: true,
    };
  if (/^(hi|hello|hey)[!. ]*$/.test(text.trim()))
    return {
      text: "Hello! Try asking about blue ankara, opening hours, delivery, or placing an order. This is a safe demonstration; no customer is contacted.",
      needsOwner: false,
    };
  return {
    text: "I don’t have a verified answer to that question in this example. I’ve handed it to the owner instead of guessing. Try asking about the blue ankara price or placing an order.",
    needsOwner: true,
  };
}
