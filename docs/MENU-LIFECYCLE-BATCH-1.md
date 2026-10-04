# Menu selling lifecycle — batch 1

Owner controls: Pause orders, Resume orders, Archive, Restore as paused. Current menus exclude archives; status filter exposes all states. Archives are reversible and preserve recipe and order records.

Customers cannot add or increase inactive items. Existing baskets display the unavailable items and keep removal available. Checkout blocks until those items are removed; scheduling also enforces this server-side. Accepted orders can still be planned. Discovery, recommendations and menu help exclude inactive products.

No delivery-date restrictions were added. Flexible preorders remain the default. Future date availability should be optional per menu, with explicit fulfilment dates separate from order-collection deadlines.

## Release
Migration myapp.0017_product_selling_status adds a selling_status column with active as default. Apply the migration to the deployment database before deploying this code. The existing Vercel migration check prevents deployment with missing schema. No production migration was run in this batch.

## Validation
31 distinct backend tests passed: lifecycle (5), pagination (3), commitments (23). Changed React pages passed targeted ESLint. Vite production build passed. Repository-wide lint still reports 23 errors and 7 warnings outside the changed pages.

UI styles explicitly set 10px wrapping action gaps, 44px minimum action height, 20–24px section separation, and mobile button wrapping. Basket warnings have their own padding and spacing. Authenticated browser visual verification remains outstanding; these checks are not a claim of pixel-level verification.
