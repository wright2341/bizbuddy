# From dashboard to AI customer automation

Reference reviewed on 2026-11-27: Tidio / Lyro, with Chatwoot Captain as a second
reference for merchant-owned model keys. This is a comparison of public product
and setup documentation, not a claim of access to paid competitor workspaces.

Sources:
- https://help.tidio.com/articles/lyro-a-quick-setup/
- https://help.tidio.com/articles/test-lyro/
- https://help.tidio.com/articles/getting-started-checklist/
- https://www.tidio.com/pricing/
- https://www.chatwoot.com/hc/user-guide/articles/1755284287-how-to-enable-captain-on-self_hosted-installations
- https://developers.openai.com/siwc/token-sharing-open-source

| Gap observed in BizBuddy | Reference pattern | Implemented response |
| --- | --- | --- |
| Signup opens an operations dashboard | Quick setup checklist, before dashboard | Dedicated resumable setup route after signup |
| Knowledge, connection and test spread across screens | Knowledge → test → activation | Four steps ending in a working chat link |
| Only a server-wide AI connection | Explicit model/service choice | Tenant-isolated BYOK and gated managed access |
| No merchant key form | Provider-owned credentials | Encrypted verified OpenAI, Groq and Gemini keys |
| Model fallback indistinguishable from AI | Test/review actual answers | Test labels identify AI versus saved-fact responses |
| No usage limits or model visibility | Conversation-based limits and monitoring | Per-tenant monthly request caps and usage status |
| Pricing says free toolkit, no AI offer | Clear platform/model allowances | Public pricing, honest managed availability, no fake checkout |

Keep the existing landing artwork, palette, menu and core order/invoice workflows.
The core promise is AI-powered customer management and automation, not a general
storefront builder. Payment collection, verified Meta production onboarding,
Shopify order syncing and website crawling are larger integrations still outside
this change. No new marketing claim should present those as connected.

The owner's working Sign in with ChatGPT connection is a self-hosted entitlement.
It must not be represented as automatically granting pooled hosted/commercial
usage to arbitrary merchants. Managed access is limited to configured owner IDs
unless partner approval is explicitly configured. New merchants can use their own
verified model key immediately. Requests for managed access persist in the app.
