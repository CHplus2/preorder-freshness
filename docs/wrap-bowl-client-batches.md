# Wrap & Bowl Kuch client rollout

Batch 1 prepared 5 November 2026 from the owner-supplied client poster and founder story.

This is a data import for the existing single-vendor application, not a new client-specific application fork. The five FYP objectives and frozen report/integration branches are unchanged.

## Batches

| Batch | Scope | State |
| --- | --- | --- |
| 1 | Eight menus/prices/days, Ayu’s story and public contact, estimated ingredient recipes, standard packaging assignments, temporary illustrations; verify bulk checkout | Prepared and tested locally; owner-run Supabase import required |
| 2 | Inventory and packaging opening stock, relevant-material review, actual shelf-life evidence and stock/checkout deductions | Pending; batch 1 does not fabricate received stock |
| 3 | Kuching–Samarahan delivery area list and provisional owner-editable fees, replacing Kuala Lumpur/Petaling Jaya choices | Pending; fees must be described as kitchen prices, not live courier quotes |
| 4 | Inspect historical orders, missing dates and obsolete payment presentation; review traceable corrections and keep original financial evidence | Pending; no order, payment or allocation ledger changes in batch 1 |

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
