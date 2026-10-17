# Order outcomes and price scenarios

Sales contains two different financial calculations. They must not be interpreted
as the same evidence or as net profit.

## Recorded order contribution

The existing contribution endpoint subtracts actual recorded batch ingredient
costs and the packaging estimate frozen at order acceptance from realised food
revenue. It requires recorded consumption matching the accepted recipe, known
batch costs and packaging, and an eligible realised outcome. Delivery status
alone is insufficient. Payment and cancellation treatment remain defined by
the backend; this UI change does not alter them.

The report groups orders by placement date and totals only the shown orders
with complete contribution records. This differs from delivery-based sales
trends and FreshCast forecasts. When no shown order can be calculated, the UI
shows an unavailable total rather than presenting the backend's empty sum as
RM 0 contribution. A genuinely calculated zero or negative value remains visible.

Generated FreshCast daily history summaries deliberately do not create cooking
or ingredient-consumption transactions. Paid/delivered demo history can support
forecast scenarios while lacking historical contribution evidence. Current
supplier estimates or a newly seeded stock batch do not reconstruct historical
consumption costs. No records are backfilled or altered in this change.

## Price and bulk-offer estimates

The price preview uses current recipes, estimated ingredient unit costs,
packaging and manager-entered assumptions. It can return an estimate even when
older orders cannot supply recorded contribution. Missing required current
costs leave contribution unavailable.

Example for ten portions:

- RM 67.50 discounted food revenue minus RM 15.91 ingredients, RM 7 packaging
  and RM 10 entered other costs gives RM 34.59 estimated contribution.
- A 5% ingredient increase gives approximately RM 16.71 ingredients and
  RM 33.79 contribution, a change of RM -0.80 at displayed precision.
- The 51.2% and 50.1% figures are contribution divided by discounted food
  revenue, not forecast accuracy or net profit margins.

Pricing tools resolve menu selling status from the existing product API.
Archived menus are hidden by default and available through an explicit toggle;
paused menus remain available and labelled. Unknown menu identities are not
assumed active. Catalogue loading/failure disables pricing selection with a
retry while the independent expense, waste and order reports remain available.
Historical order reports retain archived items.

The full current-menu recipe-estimate list is expandable. Scenario edits clear
previous results, and financial blanks remain unknown rather than becoming zero.
CSV export semantics and all backend calculations are unchanged.

Validation: existing frontend suites/build, regression coverage for unknown vs
zero/negative contribution and catalogue filtering, and the existing Django
pricing, contribution export and commitment tests. Browser fixtures validate
scenario rendering, input invalidation, archived visibility, missing costs,
catalogue failure/retry and mobile layout; they are not live accounting evidence.
