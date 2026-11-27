// Conversation, invoice and payment examples adapted from the original repository.
// Source: wright2341/bizbuddy @ add4dee5dae7f2a1f6cd6a02e4cc9176434abd34
// Original file: src/ChatbotWorkspace.jsx. All records below are DEMO DATA.

export const startingConversations = [
  {
    id: "adaeze",
    name: "Adaeze Okafor",
    initials: "AO",
    channel: "whatsapp",
    phone: "+234 803 ••• ••24",
    preview: "Can you reserve 6 yards for me?",
    time: "2 min ago",
    status: "Needs reply",
    messages: [
      {
        id: "a1",
        sender: "customer",
        text: "Hi, is the blue ankara fabric still available?",
        time: "10:34 AM",
      },
      {
        id: "a2",
        sender: "assistant",
        text: "Hello Adaeze! Yes, we have the blue ankara in stock at ₦8,000 per yard.",
        time: "10:35 AM",
      },
      {
        id: "a3",
        sender: "customer",
        text: "Can you reserve 6 yards for me?",
        time: "10:38 AM",
      },
    ],
  },
  {
    id: "chidi",
    name: "Chidi Nwosu",
    initials: "CN",
    channel: "instagram",
    phone: "@chidistyles",
    preview: "Do you deliver to Ikeja?",
    time: "18 min ago",
    status: "Open",
    messages: [
      {
        id: "c1",
        sender: "customer",
        text: "I love the new aso-oke collection.",
        time: "10:12 AM",
      },
      {
        id: "c2",
        sender: "assistant",
        text: "Thank you, Chidi! Would you like the collection details?",
        time: "10:13 AM",
      },
      {
        id: "c3",
        sender: "customer",
        text: "Do you deliver to Ikeja?",
        time: "10:19 AM",
      },
    ],
  },
  {
    id: "amara",
    name: "Amara Bello",
    initials: "AB",
    channel: "messenger",
    phone: "Facebook customer",
    preview: "I have made the transfer, please confirm.",
    time: "41 min ago",
    status: "Needs reply",
    messages: [
      {
        id: "m1",
        sender: "customer",
        text: "Please send the invoice for my fabric order.",
        time: "9:48 AM",
      },
      {
        id: "m2",
        sender: "owner",
        text: "Invoice INV-2046 is ready. I have sent the payment details.",
        time: "9:51 AM",
      },
      {
        id: "m3",
        sender: "customer",
        text: "I have made the transfer, please confirm.",
        time: "10:02 AM",
      },
    ],
  },
  {
    id: "tolu",
    name: "Tolu James",
    initials: "TJ",
    channel: "website",
    phone: "Website visitor",
    preview: "What are your opening hours?",
    time: "1 hr ago",
    status: "Open",
    messages: [
      {
        id: "t1",
        sender: "customer",
        text: "What are your opening hours?",
        time: "9:06 AM",
      },
      {
        id: "t2",
        sender: "assistant",
        text: "We are open Monday to Saturday, 9 AM to 6 PM.",
        time: "9:06 AM",
      },
    ],
  },
];

export const startingInvoices = [
  {
    id: "INV-2048",
    customer: "Adaeze Okafor",
    description: "Blue ankara · 6 yards",
    amount: 48000,
    status: "Awaiting payment",
    date: "Today",
  },
  {
    id: "INV-2047",
    customer: "Chidi Nwosu",
    description: "Aso-oke set · deposit",
    amount: 125000,
    status: "Paid",
    date: "Today",
  },
  {
    id: "INV-2046",
    customer: "Amara Bello",
    description: "Chiffon · 8 yards",
    amount: 72000,
    status: "Paid",
    date: "Yesterday",
  },
  {
    id: "INV-2045",
    customer: "Tolu James",
    description: "Tailoring · balance",
    amount: 35000,
    status: "Overdue",
    date: "Nov 21",
  },
];

export const startingPayments = [
  {
    id: "PAY-8351",
    customer: "Chidi Nwosu",
    method: "Paystack · Card",
    amount: 125000,
    time: "10:42 AM",
    status: "Successful",
  },
  {
    id: "PAY-8350",
    customer: "Amara Bello",
    method: "Bank transfer",
    amount: 72000,
    time: "10:16 AM",
    status: "Successful",
  },
  {
    id: "PAY-8349",
    customer: "Somto Fabrics",
    method: "Paystack · Transfer",
    amount: 31000,
    time: "9:38 AM",
    status: "Successful",
  },
];
