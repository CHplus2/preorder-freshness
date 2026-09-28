# Kitchen Help: English, Bahasa Melayu and Mandarin

## What is implemented

The customer footer includes a responsive help panel. Language selection changes the assistant's
interface, approved answers and error messages to English, Bahasa Melayu or Simplified Chinese
(written Mandarin). It does not translate the entire storefront or owner-entered menu names.

Customers can select a topic or type a question. Local keyword matching recognises common
questions in all three languages. Optional Groq AI classifies unfamiliar questions into supported
topics. Answers are approved translations, not unrestricted AI-generated prose.

Topics: menu ideas, preorder rules, delivery/delays, manual payment guidance, ingredient records,
allergies/diets, order navigation, reviews and owner contact.

Menu search accepts explicit food budget, portions and menu-name filters. It returns up to three
menus sorted by price, calculates the food total from database prices and excludes menus whose
daily portion ceiling is smaller than the requested quantity. It does NOT check the selected
day's booked capacity or actual ingredient availability. Results clearly say availability is
unconfirmed. Checkout remains authoritative for stock, schedule, discounts and delivery fees.
Natural-language numbers are not silently used as budget/portion inputs: use the labelled fields.

Order help links to the authenticated My orders page. It does NOT fetch individual order records
into chat, approve payments, cancel orders, issue refunds, book a courier or promise an ETA.
Owner handoff opens Contact; it does not send the conversation automatically.

## Enable optional AI on Vercel

1. Create a Groq API key in your own provider account.
2. Add GROQ_API_KEY privately to the backend Vercel environment.
3. Optionally set GROQ_CHAT_MODEL to a model enabled for your account. Default:
   llama-3.3-70b-versatile. Check current model availability and free-plan limits.
4. Redeploy. Opening Kitchen Help checks whether a key is configured.
5. The customer can opt in using the AI checkbox. Ask an unfamiliar question to test routing.

No key is needed for guided help. No key has been created or configured by this change.
Configuration readiness is not proof the key/model works. An invalid key, exhausted quota,
timeout or invalid provider response falls back to the guide/owner-contact response.
There is no automatic paid upgrade; control billing and spend caps in the provider account.

Provider documentation:
- https://console.groq.com/docs/openai
- https://console.groq.com/docs/models
- https://console.groq.com/docs/rate-limits

## Data flow and privacy

Only a customer's current question and a fixed classification instruction are sent to Groq,
and only when no local topic matched AND that customer enabled AI. Topic buttons do not need AI.
No order records, addresses, inventory, credentials or conversation history are sent.
Email addresses, URLs and phone-like number strings receive best-effort redaction.
Redaction cannot recognise all personal information; the checkbox explicitly asks customers not
to enter personal/payment details and discloses the provider.

The app does not persist conversations. The panel retains at most a small recent conversation
in memory; changing language or clearing conversation removes it. Do not add request-body logging.
External-provider retention is governed by the provider's terms, not by this application's memory.
API keys stay in server environment variables, never VITE_ variables or Git.

Provider output must exactly match one allowed topic. Other output is discarded.
No model-generated HTML/Markdown is rendered. Link destinations and monetary calculations come
from application code. AI classification can still misunderstand a question; customers can use
the explicit topic buttons or contact the owner.

## Reliability and limits

- 500-character question limit; bounded numeric filters and at most three menu suggestions.
- Provider timeout: 5 seconds; frontend request timeout: 12 seconds.
- 20 help requests per minute per user/IP using Django's cache-based throttle.
- The default local-memory cache is per server process and approximate. A distributed deployment
  needs shared cache or gateway rate limiting for a global limit. Provider quotas remain necessary.
- Menu lists describe suggestions, never reservations.
- No medical/allergen/halal-certification guarantees.
- No multi-turn context inference, automatic language detection, conversion attribution or
  customer satisfaction analytics in this version.

This intentionally bounded assistant supports customer self-service without letting the model
invent business policies. Future enhancements can add authenticated read-only order cards,
confirmed planning quotes and consent-aware evaluation metrics.

## Code and tests

- backend/myapp/services/kitchen_help.py: translations, local matching, Groq routing.
- backend/myapp/views/help.py: validated API, throttling and menu lookup.
- frontend/src/components/KitchenHelp.jsx and .css: accessible non-modal panel.
- backend/myapp/test_help.py: multilingual responses, privacy, invalid input, budget math,
  throttling, provider failures and untrusted output.
- Endpoint: GET /api/help/ for configuration status; POST /api/help/ for help.

Use the isolated test procedure in README/TESTING.md. Provider tests mock HTTP; they do not
spend credits or confirm a live key works.

Manual checks: open/close with keyboard, Escape, focus restoration, narrow screen scrolling,
all three languages, failed requests/retry, empty menu matches, language change during a request,
and fallback with no key. Translation quality should also be reviewed by representative users.
