# Conversational ordering — batch 2

Kitchen Help now has **Plan an order** and **Kitchen guide** tabs. It reuses the
existing React panel, Django basket, preparation scheduler and PayPal Sandbox
checkout. No new model is trained and no schema migration is needed.

## Try the customer flow

1. Open **Kitchen help → Plan an order** from the storefront.
2. Enter, for example, `Lunch for six tomorrow, budget RM80`. If AI is configured,
   the customer can opt in to interpreting that message with Groq. Otherwise the
   interface labels the interpretation as guided. Review the extracted quantity,
   date, budget and menu keyword; use **Review your request** to correct them.
3. Choose one matching menu and select **Review addition**. Check the selling
   unit (a meal, pack or box), existing quantity, quantity after addition, delivery,
   discount and whole-basket total. **Confirm addition to basket** is the only
   action that changes the basket. Add further menus one at a time.
4. Use **Find delivery times** to check the whole current basket against the
   existing scheduler. If no time fits, search later dates or request another
   arrangement at checkout; a review request remains unpaid.
5. Choose a time, then **Review checkout**. The selected time carries forward,
   and checkout rechecks availability before the customer places the order.
6. Select PayPal Sandbox at checkout and approve in PayPal as usual. The assistant
   never places an order, captures payment, confirms cooking or issues a refund.

The original Kitchen guide, menu filter and multilingual approved answers remain
available in the second tab. Both modes support English, Malay and Simplified
Chinese. Menu names remain the actual owner-entered database names.

## AI setup and truthful fallback

The new mode reuses `GROQ_API_KEY` and optional `GROQ_CHAT_MODEL` (default
`llama-3.3-70b-versatile`). If those are already configured in Vercel, no new AI
credential is needed. If not, enter the key privately in Vercel settings and
redeploy. Never put it in a `VITE_` variable, chat or Git.

A configured key only enables the opt-in checkbox; it does not prove the key,
quota or model is healthy. Only after opt-in is the current message sent to Groq,
with a fixed extraction instruction and Malaysia's current date. The provider may
return only `portions`, `budget`, `date` and `search`. No customer basket, address,
order history, prices, inventory, payment data or conversation history is sent.
Email, URL and phone-like strings receive best-effort redaction. Customers are
asked not to include personal/payment details; redaction is not a guarantee.

Numbers and dates explicitly understood by the local parser take precedence over
AI guesses. The server validates dates, bounds and types again. Invalid output,
timeouts or missing keys use labelled guided controls; missing quantity/date is
requested rather than silently assumed. AI output cannot specify product IDs,
prices, payment actions or arbitrary tools. Allergy, certification and dietary
suitability requests are directed to the owner rather than inferred from names.

The guide tab still uses its original topic classifier only for questions that
local topic matching cannot recognise. The new ordering mode uses separate
structured extraction, not unrestricted provider-generated prose.

## API and business rules

- `POST /api/help/shop/` accepts `{message, draft, use_ai}`. `draft` may contain
  `portions` (1–1000), `date` (today through 90 days), optional `budget` (MYR) and
  `search` (up to 80 characters). It returns the validated draft, interpretation
  mode, missing fields and at most three matching active menus. There is no basket
  mutation or preparation reservation. Only explicit menu selection is accepted.
- Menu matching includes common English/Malay aliases. Candidate quantities must
  fit the menu's recorded daily ceiling; actual booked capacity and preparation
  are checked later against the full basket. A disallowed delivery weekday is
  labelled, not presented as an available slot.
- Budgets mean the **whole resulting basket**, including any existing items,
  current delivery fee and applicable bulk discount. Guest estimates represent a
  new basket; signing in re-prices actual existing items before confirmation.
- `POST /api/help/cart/` with `{product_id, quantity, budget?}` requires customer
  authentication and CSRF. It creates a ten-minute signed addition preview.
  The signature binds a durable `RecommendationSession` row with variant `chat`
  to the customer, basket fingerprint, product price and promotion settings.
- Same endpoint with `{confirm}` applies that exact addition under the same user,
  storefront and product lock order as checkout. If the basket, price or promotion
  changed, the preview must be reviewed again. Changed client IDs/quantities are
  ignored in favour of the signed server record.
- Confirmation and the applied receipt are committed in one transaction. A retry
  after a lost response returns the prior result without adding again, including
  after the item has been removed or the basket checked out. `basket_changed`
  explicitly tells the UI if the current basket differs from that saved result.
- `POST /api/orders/slots/` is the existing read-only whole-basket slot search.
  Selected slots are advisory and never reserve capacity; checkout remains
  authoritative. The handoff uses navigation state and optional session storage.
- Existing help throttling applies: 20 requests/minute per user/IP via Django's
  configured cache. Multi-worker deployments need shared cache/edge limits for a
  global cap. Suggestions inspect a bounded candidate list; provider timeout is
  five seconds. Preview/confirmation tokens expire after ten minutes.

Raw messages remain in panel memory and are not saved as conversations. Structured
basket confirmation records are durable in the existing recommendation-session
storage, and survive browser closure/restarts for duplicate protection. They do
not enter the popularity/personalised experiment denominators or claim causal
conversion improvements. They contain no provider tokens or payment credentials.

## Validation and limitations

Tests cover multilingual extraction, opt-in/redaction, invalid provider output,
actual database prices, whole-basket budget arithmetic, no premature mutation,
signed/expired/foreign previews, stale baskets/prices/promotions and retry after
removal. Browser checks use real local Django APIs and an isolated SQLite fixture
for describe → review → confirmed add → delivery selection → checkout → payment.
External PayPal and any mocked AI response are test doubles, not evidence of a
live provider transaction. The user separately confirmed batch 1's real Sandbox
capture on production; this batch does not alter that payment integration.

This version supports one menu per confirmed addition. It does not infer serving
counts inside a pack, guarantee allergens or inventory, move existing orders,
choose a customer's payment method, read private orders into chat, or act as an
unattended purchasing agent. Webhook/refund reconciliation remains a later batch.

Verification for this batch: full Django application suite (448 tests run, four
skipped); existing frontend suites, new shopping response/rendering checks and
production build; local browser checks at 1440px, 390px and 320px. A separate local
AI-response fixture verified opt-in starts off, interpretation is requested only
after consent, language changes reset consent and the Chinese payment guide links
to My orders. Neither that fixture nor provider HTTP mocks establishes live Groq
availability; verify the configured key/model on the deployed site.
