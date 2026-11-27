# Workspace and mobile conversation research

## Original repository

GitHub confirms `EF-Code/bizbuddy` is a fork of `wright2341/bizbuddy`.
Inspected the original main commit `add4dee5dae7f2a1f6cd6a02e4cc9176434abd34`
(25 November 2026), specifically `src/ChatbotWorkspace.jsx`, its stylesheet,
and `src/TwilioWorkspace.jsx`. The original conversation examples are Adaeze
Okafor (blue ankara/WhatsApp), Chidi Nwosu (delivery/Instagram), Amara Bello
(payment verification/Messenger), and Tolu James (opening hours/website).
The existing fork still contains those source files, but its functional inbox
replaced their visible route. The new demo reuses their actual records and
interactions, in an explicitly labeled, isolated client-side demonstration.

Original source: https://github.com/wright2341/bizbuddy/blob/add4dee5dae7f2a1f6cd6a02e4cc9176434abd34/src/ChatbotWorkspace.jsx

## Product constraints from the supplied PDF

Demonstrate a customer question, a grounded reply, order capture for owner
confirmation, an approved invoice follow-up, and a daily summary. Unknown
information, delivery promises and payment verification require owner handoff.
Meta examples can be simulated; payment processing is outside the MVP.

## Findings applied

1. Show capabilities and useful suggested questions instead of a blank composer.
   Keep the sender role, simulated status and owner handoff understandable.
   Source: Nielsen Norman Group, chatbot design study (April 2026):
   https://www.nngroup.com/articles/ai-chatbots-design-guidelines/
2. Use a list/detail layout: two panes on desktop, one focused conversation on a
   small phone, with a clear way back. Preserve the selected conversation.
   Source: Google adaptive canonical layouts:
   https://developer.android.com/develop/ui/views/layout/canonical-layouts
3. Keep the composer reachable when the virtual keyboard reduces the visual
   viewport. Use safe-area padding, dynamic viewport sizing and progressive
   `interactive-widget=resizes-content` support. Do not disable browser zoom.
   Source: MDN viewport documentation:
   https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/viewport
4. Use short message-entry, pane-transition and feedback animations to explain
   the result of actions. Honor reduced-motion preferences; avoid continuous
   decorative motion. Target larger touch controls than WCAG's 24px AA minimum.
   Sources: https://www.w3.org/TR/WCAG22/
   https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions
5. Do not drag a reader away from older messages when a response arrives. Follow
   the latest message only when the reader is already near the end, or they
   explicitly send a message. Provide a new-message action otherwise.

## Delivery decisions

- A public `/demo` lets a presenter experience the original sample workflow
  immediately, without credentials, connected accounts or seeded live records.
- Empty real inboxes offer the interactive demo while retaining a clear real
  inbox/setup action. Existing customer data never gets replaced by samples.
- Reuse the original four conversations and sample invoices; add safe, local
  question/reply, owner confirmation, reminder and daily-summary interactions.
- Preserve the landing-page markup and stylesheet exactly.
- Browser verification covers 375px, 390px, 768px and desktop layouts, keyboard
  navigation, overflow, reduced motion and real business workflow regressions.
