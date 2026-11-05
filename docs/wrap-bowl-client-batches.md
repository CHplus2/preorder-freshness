# Wrap & Bowl Kuch client rollout

Batch 1 prepared 5 November 2026; stock, area and history refresh reviewed 6 November 2026. Source: the owner-supplied client poster, founder story and explicit confirmation that all affected operational records are fictional FYP data.

This is a data import for the existing single-vendor application, not a new client-specific application fork. The five FYP objectives and frozen report/integration branches are unchanged.

## Batches

| Batch | Scope | State |
| --- | --- | --- |
| 1 | Eight menus/prices/days, Ayu’s story and public contact, estimated ingredient recipes, standard packaging assignments, temporary illustrations; verify bulk checkout | Prepared and tested locally; owner-run Supabase import required |
| 2 | Current ingredient/packaging views, dated stock checks, opening stock and reconciled allocations | Included in the coordinated owner-run operational refresh |
| 3 | Kuching–Samarahan delivery areas and editable fees | Included in the same refresh so historical and future orders share valid areas |
| 4 | Replace fictional historical menu/payment/date/allocation records, with private originals retained | Included in the same refresh; no real financial records were authorised for rewriting |

## Apply batch 1

1. Back up the target database. Deploy the matching `main` source so the three static illustrations and category counts are available.
2. In Supabase → SQL Editor, run the **whole** [catalogue import](../deploy/sql/apply_wrap_bowl_catalogue.sql). It targets the existing `django_app` schema and needs no Django migration. No RLS policy or trigger is disabled.
3. Expect `status: configured`, eight menus and their generated IDs. Keep the result: it includes archived menu IDs/previous states and the previous public story.
4. Refresh Menu, Our story, Settings and Packaging → Menu packaging. Existing delivery/collection settings, payment details, promotion rules, stock quantities and history are preserved. New packaging types start at zero.
5. Record received ingredient/packaging stock before accepting orders. Do not invent stock receipts, purchase costs or expiry evidence merely to clear a shortage.

Repeating with all eight names present returns `already_configured`, without resetting owner-edited prices/recipes/story/counts. A partial setup, ambiguous ingredient/category or incompatible existing ingredient unit fails and rolls back. Use normal forms for later changes. Do not rerun a catalogue reset after intentionally renaming/deleting the entire business.

## Menus transcribed from the poster

| Menu | Price | Offered days |
| --- | --- | --- |
| Chicken Grilled Salad | RM 13.00 | Monday–Friday |
| Chicken Popcorn Salad | RM 13.00 | Monday–Friday |
| Eggsquisite Salad | RM 12.00 | Monday–Friday |
| Beef Sukiya Salad | RM 18.00 | Monday–Friday |
| Wanpaku Chicken Katsu | RM 12.00 | Monday–Friday |
| Wanpaku Chicken Grilled | RM 12.00 | Monday–Friday |
| Salmon Grilled Salad Bowl | RM 28.00 | Monday–Friday |
| Sukiya Beef Rice Bowl | RM 20.00 | Monday only |

Five salad bowls, two Wanpaku sandwiches and one rice bowl. Existing unrelated menus are archived rather than renamed/deleted, so old accepted order lines do not become salad orders. Old raw materials, batches and categories remain for stock and history; customer category tabs/finder hide categories with zero active menus. Staff category management still shows them.

## Estimated recipes and packaging

Owner-authorised editable estimates; confirm actual ingredients, allergens, yields and quantities with Ayu before real production. Rice quantities are dry weight; meat is raw trimmed weight. Dressing, sauces and mayonnaise are tracked as purchased ingredients; homemade versions need their own actual recipe.

The reviewed [data file](../deploy/data/wrap_bowl_kuch.json) contains 25 ingredient types, 89 recipe lines, nine packaging types and 30 menu/packaging assignments. Salad bowls use a lidded 1000 ml bowl, 30 ml dressing cup, fork and label. Sandwiches use a two-half box, greaseproof sheet and label. The rice bowl uses a lidded 750 ml bowl, 60 ml sauce cup, spoon and label. These are editable starting arrangements, not packaging specifications confirmed by the client. No carrier bag is charged per meal because a single bag can serve an entire order.

No received batch, shelf-life guidance, ingredient cost or packaging purchase cost is fabricated by this import. Existing matching ingredient units and packaging balances/costs remain unchanged. Ingredients from older recipes cannot be deleted while historical stock references them; the active client recipe list is the new 25-ingredient set, not a rewrite of old ledgers.

## Images and public identity

Three original local SVG illustrations (salad/sandwich/rice) are explicitly captioned illustrative. They are not client photos. The owner can replace them with device-uploaded images in the existing menu editor. That editor recognises these exact local illustration paths; arbitrary local SVG paths are not accepted. No personal receiving QR is bundled.

The story uses Ayu Shafinaz’s supplied account and the menu poster’s public phone `011-14007567` (international WhatsApp format `601114007567`). No founder portrait, client email, social URL, pickup address or claimed nutrition certification was invented. Unprovided public email/social/portrait entries are cleared; private owner-reminder sender/recipient settings are unchanged.

## Bulk promotion check

Bulk promotion is already connected. The client import preserves the current `bulk_minimum` and `bulk_discount_percent` and returns them in its result; the poster does not authorise a new discount. If the percentage is zero, no discount applies. When enabled, the threshold counts selling units across the basket; the percentage reduces food subtotal only. Delivery is calculated separately under saved area/free-delivery rules.

An added integration test checks below-threshold behaviour, qualifying quote, private proof amount, saved order discount/total and placement stock deductions: ten RM12 meals with 10% off and RM4.50 delivery produce RM120 food, RM12 discount, RM4.50 fee and RM112.50 payable. The receipt is still unverified/unpaid until staff review.

## Verification and limits

See the [local evidence](evidence/20261105-wrap-bowl-batch1/README.md). No production Supabase connection or mutation was performed: this runtime has no configured TCP access grant for that database. Source publication alone does not install database records or prove a successful Vercel deployment.

## Apply the coordinated stock, area and order-history refresh

After batch 1, run the whole [operational refresh SQL](../deploy/sql/refresh_wrap_bowl_operations.sql)
in Supabase SQL Editor, targeting the same `django_app` schema. Back up first.
This is a one-time replacement of the owner-confirmed fictional project dataset,
not a migration or a normal release/build action. Deploy the matching source
before using the new stock-check controls. Expect **`status: refreshed`**, eight
menus, 25 ingredient types, nine packaging types and 12 delivery areas. Reruns
return `already_applied` and never refill consumed stock or rewrite later orders.

The refresh retains user accounts, passkeys, bank instructions, receiving QR and
original order IDs. It saves the original operational records in private existing
OrderAmendment records before replacing them. Use the read-only [recovery export](../deploy/sql/export_wrap_bowl_refresh_backup.sql)
to download those originals privately; do not post its output publicly. Original
receipt images remain private, detached from the newly described orders so they
are not misrepresented as evidence for changed amounts.

It removes unrelated products/categories/materials/batches and rebuilds accepted
recipes and packaging snapshots using the current client menus. Food quantities
are one to ten selling units per line, with up to three lines per refreshed
order. Missing dates are filled; delivery/collection uses offered weekdays and
07:30–11:00 Malaysia time. The latest two non-cancelled records become upcoming
unpaid cash deliveries; earlier non-cancelled records become received, paid
history. Cancellations stay cancelled. QR/bank-transfer and cash replace obsolete
payment choices. Sample receipt/refund amounts and food totals are recalculated
consistently; these are constructed project entries, not bank-confirmed real
transactions. The originals, including provider references, are in the private
recovery archive.

Historical ingredient batches are fully allocated and have zero balance; current
opening lots retain enough for ten of **each** of the eight menus after the
upcoming orders' allocations. Packaging has matching opening/allocation movements
and the same ten-per-menu remaining target. Cancelled orders retain current
packaging terms without claiming an allocation. Batch references use the normal
`ABC-YYYYMMDD-NNN` style. Received dates and per-type planning deadlines are
constructed project values, not verified physical counts or food-safety evidence.
Inventory defaults to non-empty current-menu stock; Include empty batches exposes
the retained allocation trace. The ingredient directory contains the 25 current
material types. No new customer-facing “demo” heading is introduced.

Customer reminder preferences are cleared on refreshed scenario records; no bank,
email or courier request is sent by the script. Historical cooking reservations
are removed. New orders placed normally keep the normal account, payment-proof,
stock and reminder behaviour. The private provenance marker identifies rewritten
history as generated when forecasts report accuracy. No model training/artifacts
were changed; constructed project records cannot establish genuine sales or
demand accuracy.

### Proposed local delivery prices

These are editable kitchen-set project prices for a Petra Jaya-area planning
origin, not verified courier quotes or measured route distances. The former
free-delivery threshold is cleared so the selected area's fee applies.

| Area | Fee |
| --- | --- |
| Petra Jaya | RM 8 |
| Samariang | RM 10 |
| Matang Jaya | RM 12 |
| Satok | RM 12 |
| Kuching city centre | RM 12 |
| Demak Laut | RM 14 |
| Tabuan Jaya | RM 15 |
| Stutong | RM 15 |
| Batu Kawa | RM 16 |
| Kota Sentosa | RM 18 |
| Desa Ilmu, Kota Samarahan | RM 22 |
| UNIMAS, Kota Samarahan | RM 24 |

The exact client pickup address was not supplied. The collection location therefore
asks customers to agree the point with the kitchen in Kuching; it does not claim
an invented private house address. The pickup availability switch and receiving
payment configuration are preserved. Edit the address and prices in Settings
when the owner provides them.

### Stock checks after setup

Inventory → **Check ingredients & packaging for your menus** calculates dated
requirements from current recipes and units of every offered menu. It is read-only,
excludes held/expired/not-yet-received ingredient lots and does not reserve stock.
The worksheet leaves actual receipt quantities and date evidence blank. Add batch
and packaging Update stock open the existing controlled receipt flows. Current
menu filters hide unrelated or empty records without silently deleting data.
Checkout still rechecks and deducts the complete basket, once per request.

See [batch 2 verification](evidence/20261106-wrap-bowl-operations/README.md).
