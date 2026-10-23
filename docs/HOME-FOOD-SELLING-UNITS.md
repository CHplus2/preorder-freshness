# Home-food case study — batch 3

Menus can describe one meal, box, pack, set, tray, jar, bottle or generic item.
This is optional seller configuration, not an inferred serving or allergen claim.
No production menus, recipes, orders, stock or payments are seeded or converted.

## Owner setup and customer journey

In **Menu management → Edit & steps → Selling unit & contents**:

- Choose the selling unit. Price, recipe ingredients, packaging cost, capacity,
  batch size and ordered quantity all continue to refer to **one selling unit**.
- Optionally describe the size, an estimated minimum/maximum number of servings,
  and what is included in each unit. Both serving bounds must be supplied together;
  they are guidance, not a conversion from customer headcount to quantity.
- Enable **Fixed contents; substitutions are unavailable** only when the contents
  are described. This publishes the offer's policy; it does not add customisation
  controls or change recipes when a customer chats with the owner.

For the example festive box, choose **box**, describe the nine pieces (three
original and two each salted egg, dark chocolate and matcha), and enable fixed
contents. Two boxes are two priced/scheduled units, not two diners or eighteen
priced units. Include all nine pieces in the recipe quantities for one box.

For small/medium/large Kacangma offers, retain separate menu products, each with
its own price, recipe, size label and serving estimate. A shared variant selector
and automatic conversion of headcount into mixed-size orders are not implemented.
Sauce-only and fruit/sauce sets can likewise remain separate priced menus.

The menu grid, recommendations, product detail, basket, checkout and assistant
preview show the configured details. Detailed contents appear before ordering;
compact discovery cards show size, servings and fixed-content policy. The dated
finder labels its input **Quantity**, explicitly counting selling units rather
than diners. Each result identifies the number of boxes/packs/etc being added.

New order items save their accepted selling details inside the existing
`preparation_snapshot`; no extra order column is needed. Customer/owner receipts,
Planner and printed packing lists read that saved document. Editing or deleting
the menu does not rewrite accepted contents. Adopting current cooking settings in
Planner preserves accepted selling details. Earlier orders without the document
remain unspecified rather than borrowing today's offer.

Packing totals separate orders whose accepted size, unit or contents differ,
even if the product ID and name match. These totals do not combine cooking runs.
Unit labels never rescale recipes, change a price, or multiply demand forecasts
by the serving estimate. Create a new menu if the physical yield represented by
one unit changes; renaming its unit cannot repair incompatible sales history.

## API and bounds

`Product.selling_details` is an optional JSON object (empty by default):

```json
{
  "unit": "box",
  "size_label": "Nine pieces",
  "serves_min": 3,
  "serves_max": 4,
  "contents": "3 original; 2 salted egg; 2 dark chocolate; 2 matcha.",
  "no_substitutions": true
}
```

`unit` is an enum; size is at most 60 characters and contents at most 500.
Serving bounds are integers 1–1000, ordered minimum ≤ maximum, or both null.
Unknown properties and non-object documents are rejected. `{}` clears the offer
metadata. A supplied document replaces the entire document, including on PATCH;
omitting it leaves the existing offer unchanged. Product writes remain staff-only.
Text is rendered as text, never HTML.

Public product/detail/card responses, date-free/dated recommendations, assistant
suggestions/previews and kitchen per-menu forecast evidence include the document.
Order item responses include accepted `selling_details`, with `{}` for legacy
orders. Existing field names such as `portions`, `quantity_per_portion` and
`packing_minutes_per_portion` are retained for API compatibility: they count
selling units, not people or individual pieces inside a pack. Genpact records
remain separate; no ML model or forecast arithmetic is changed or retrained.

## Release

Migration **0021_product_selling_details** adds one optional JSON column with
empty details on existing menus. A persistent empty-object database default also lets the previous application create menus during deployment. Apply it **before publishing the new code**.
The earlier application can continue using its old columns during this upgrade.

For the existing `django_app` schema, the reviewed
[Supabase SQL Editor upgrade](../deploy/sql/0021_product_selling_details.sql)
performs the schema change and migration recording in one atomic statement. Run
the whole file. It requires migration 0020, names the schema explicitly, preserves
existing menus and rejects partial/incorrect schemas rather than inventing
migration history. Repeating the SQL verifies the column and restores the database
default without duplicating migration history or replacing offer contents. Success returns `0021_product_selling_details`. The usual
connected `manage.py migrate` is an alternative; do not apply both blindly.
Database credentials remain private and outside GitHub. The Vercel release check
remains enabled. SQL Editor access does not prove external password login works.

Publishing is held until the production schema upgrade is confirmed, to avoid
triggering another deployment against missing columns.

## Verification

Targeted backend regressions cover malformed offers, serving bounds, staff-only
writes, public discovery, two-box checkout pricing, recipe quantities and actual
ingredient deduction, immutable accepted contents, menu deletion, legacy orders
and adopting current preparation settings. Frontend checks cover unit labels,
malformed response recovery, escaped text and distinct packing totals. Release
SQL is exercised against isolated PostgreSQL with a public-only search path.
Validation completed: **603 distinct backend checks passed** across the broad SQLite
suite, the local HTTP integration check, nine PostgreSQL concurrency checks and
the added previous-version compatibility regression. Two real-model-artifact
checks were skipped because the model bundle is not provisioned in this workspace.
No model accuracy claim follows from these checks. Frontend shared utilities, UX/rendering,
checkout, recommendations, planning, assistant and predictive regressions,
changed-source lint (35 files), migration consistency and a production build passed.
The isolated browser journey covers an owner configuring a nine-piece fixed box,
a buyer ordering two boxes for collection, unchanged accepted contents after a
current-menu edit, and Planner/packing. Desktop/tablet/phone widths include 1440,
768, 390 and 320 pixels. **25 final browser scans** reported no page errors, horizontal overflow or automated WCAG A/AA violations. Receipt contrast is evaluated after the entry fade settles.
No real payment or production data mutation is performed by these tests.

Full-repository lint still reports two pre-existing `set-state-in-effect` errors
in unchanged `CostPanel.jsx` and `useOrderCatalogue.js`; changed-source lint passes.
Automated accessibility/overflow checks supplement, rather than replace, owner
usability sessions. A serving estimate does not establish dietary suitability or
sufficient food for every customer.
