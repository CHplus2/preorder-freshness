# FYP technical handoff: current repository implementation

Inspection and local verification: 29 September 2026. Application baseline: `6f8e03e9b5075b88f52d9a966a289d41745119ff`. The working tree was clean at inspection. This handoff adds documentation only; no application fixes were made.

## Reading this handoff

This is a source-based description for another AI helping write the FYP report. **Implemented** means an executable code path exists; it does not prove that production configuration, external services, or real business data are present. **Partial/demo/configuration-dependent** identifies narrower functionality. **Planned/not implemented** is explicitly separated below. Repository documentation and screenshots are supporting history, not proof that an old feature still works.

Source citations use repository-relative filenames and exact symbols so they remain useful after copying this document to another AI. The companion `docs/FYP-SOURCE-CATALOG.md` provides clickable source locations, the complete application model field declarations, and a symbol index. Do not infer deployed database contents from models or migrations; no production database was inspected.

## 1. System architecture and stack

The application, branded **Dapur Kita**, is a single-kitchen preorder storefront with customer and staff interfaces. It is a React SPA communicating with a Django REST API, with relational persistence through Django ORM. The kitchen, owner permissions, and settings are not separated by tenant/business IDs. Application access uses Django's built-in User and `is_staff`; there is no custom owner/customer role model. [Sources: `frontend/src/App.jsx::App/AnimatedRoutes`; `backend/myapp/models.py`; `backend/myapp/views/admin.py`; `backend/myapp/views/storefront.py::storefront`.]

```text
React pages + Context providers
    -> Axios requests to /api/ (session cookie + CSRF header on mutations)
    -> config.urls -> myapp.urls -> DRF views
    -> serializers / scheduling, reporting and other services
    -> Django ORM -> SQLite locally or PostgreSQL via DATABASE_URL

Separate optional paths:
    reminder command / secret-protected HTTP trigger -> SMTP
    Kitchen Help -> local topic rules -> optional Groq topic classification
    escrow demo page -> browser Ethereum wallet -> separate testnet contract
```

Declared production stack: Python `>=3.13,<3.14`; Django `6.0.3`; Django REST Framework `3.17.1`; django-cors-headers `4.9.0`; dj-database-url `3.1.2`; python-dotenv `1.2.2`; psycopg2-binary `2.9.11`; WhiteNoise `6.12.0`. Frontend package ranges include React/React DOM `^19.2.5`, React Router `^7.14.2`, Axios `^1.15.2`, Vite `^8.0.10`, Framer Motion `^12.38.0`, Lucide React `^1.9.0`, and ethers `^6.17.0`. These are manifest declarations, not a statement that all installations resolve to precisely the range's minimum. [Sources: root `pyproject.toml`, `requirements.txt`; `frontend/package.json`.]

`backend/requirements.txt` contains a broader historical dependency list, including Google AI SDKs and Gunicorn. The root production dependencies are smaller. A PayPal React package is declared but checkout does not provide a working PayPal integration. The Solidity demonstration uses compiler `0.8.30`, ethers and Ganache. [Sources: the dependency files above; `escrow/package.json`; `backend/myapp/views/orders.py::place_order`.]

Development Vite proxies `/api` to `127.0.0.1:8000`. Production configuration serves SPA routes through Django's `TemplateView(index.html)` and builds assets with `/static/` base. Root `app.py` inserts `backend` into `sys.path` and exposes WSGI `application`; `vercel.json` and `pyproject.toml` identify that entrypoint. `build.py::main` runs frontend dependency installation/build; migrations are a separate release step. `config/asgi.py` and `config/wsgi.py` also exist as Django entrypoint modules; they do not establish WebSocket features. [Sources: `frontend/vite.config.js`; `backend/config/urls.py::urlpatterns`; `backend/config/settings.py`; `app.py`; `build.py::main`.]

Database settings use `DATABASE_URL` when present, otherwise `backend/db.sqlite3`. PostgreSQL configuration requires SSL, supports a validated schema name through `DATABASE_SCHEMA`, and disables server-side cursors. Vercel mode refuses a missing/non-PostgreSQL database URL. Supabase is a PostgreSQL hosting/transfer option, **not Supabase Auth**. `prepare_supabase.Command` is an explicit management command for initial transfer; it was not executed for this review. Datetimes use `USE_TZ=True`, with `Asia/Kuala_Lumpur` as application timezone. [Sources: `backend/config/settings.py`; `backend/myapp/management/commands/prepare_supabase.py::Command`.]

## 2. Frontend structure and implemented pages

`frontend/src/main.jsx` mounts React StrictMode, `ErrorBoundary`, and `App`; Axios has a 30-second default timeout. `App.jsx::AnimatedRoutes` registers the routes below; owner pages and the escrow page are lazy imports. Styling is ordinary CSS across global, business, admin, component and page stylesheets.

- `/`, `/story`, `/how-it-works`, `/contact`: `pages/customer/BusinessPages.jsx::{HomePage,StoryPage,HowItWorksPage,ContactPage}`. Storefront-driven business content and contact/social links, with `components/BusinessLayout.jsx::{PageMeta,BusinessFooter}`.
- `/menu`: `pages/customer/ProductsPage.jsx::ProductsPage`. Public paginated menu, debounced search, category filtering, load-more controls, recommendations, and inventory-date transparency. Requests `/api/menu/` rather than downloading the full product management payload.
- `/products/:id`: `ProductDetailPage.jsx::{ProductDetailPage,ProductContent}`. Product information, lead time, recorded freshness message, add-to-cart, social link and reviews. Abortable fetching, unavailable/error states, retry and return-to-menu are implemented. AI-summary rendering is commented out.
- `/cart`: `CartPage.jsx::CartPage`, backed by `CartProvider`, for quantities/removal and pricing totals.
- `/checkout`: `CheckoutPage.jsx::CheckoutPage`. One saved address, delivery datetime/service choice, advisory scheduling quote, payment choice and placement. The delivery plan is stored in sessionStorage; wallet navigation also stores an address ID in localStorage. The backend still verifies address ownership and recalculates the order.
- `/payment/:method`: `PaymentPage.jsx::PaymentPage`. Demo-wallet creation/top-up/payment; the PayPal branch displays an unavailable/setup message.
- `/orders`: `OrdersPage.jsx::OrdersPage`. Customer order records, statuses and saved manual-payment instructions through `ManualPayment`.
- `/admin/products`: `AdminProductsPage.jsx::AdminProductsPage`. Menu CRUD, recipe quantities, scheduling parameters, preparation steps and photo URL editing; components `RecipeEditor`, `PreparationTasks`, `MenuPhotoField` and `DeleteProduct`.
- `/admin/inventory`: `AdminInventoryPage.jsx::AdminInventoryPage`. Raw-material and batch CRUD, search/material/freshness filters, expiry inputs, loading/error/retry states, and stale-edit recovery. `ExpiryFields` supplies evidence/handling fields.
- `/admin/orders`: `AdminOrdersPage.jsx::{AdminOrdersPage,startEdit,saveEdit}`. Owner order list and status/payment-status changes; submission guard and modal feedback.
- `/admin/planner`: `PlannerPage.jsx::PlannerPage`. Daily tasks, calendar, order review, shopping shortages, workload indicators and ICS export; uses `PlannerCalendar`, `KitchenAvailability`, `PlanReview`, and `utils/planner.js::dailyWork`.
- `/admin/reports`: `AdminReportsPage.jsx::AdminReportsPage`. Product sales, summary/trend/forecast and `CostPanel` for costs, expenses and waste.
- `/admin/customers`: `AdminCustomersPage.jsx::AdminCustomersPage`. Customer/owner list and activation/deactivation controls for non-staff accounts in the UI. The backend API has broader permissions than these UI controls (see limitations).
- `/admin/settings`: `StoreSettingsPage.jsx::StoreSettingsPage`. Business content, kitchen/promotion/manual-payment settings and reminder readiness display.
- `/escrow-demo`: `EscrowDemoPage.jsx::EscrowDemoPage`. Separate Sepolia demonstration, not order checkout integration.

The filenames above are under `frontend/src/`. `App.jsx` also supplies a wildcard not-found page. `hoc/RequireAuth.jsx::RequireAuth` handles frontend login/admin gating; it is not a substitute for API permissions.

Context responsibilities: `AuthProvider` checks auth, handles account actions and owns cart state; `CartProvider` loads/mutates cart and demo wallet and calculates displayed totals; `OrderProvider` loads/places/updates orders; `ProductProvider` handles categories, menus and recommendations; `StorefrontProvider` centralizes public settings and responds to `storefront-updated`; `UIProvider` owns dialogs/alerts and formatting. Shared `ModalDialog` uses native `dialog.showModal()`, Escape dismissal and focus restoration. `apiError` normalizes API failures. [Sources: `frontend/src/contexts/*.jsx`, respective exported providers/functions; `components/ModalDialog.jsx::ModalDialog`; `utils/apiError.js::apiError`.]

## 3. Backend organization

There is **one custom Django app, `myapp`**. Inventory, orders and planning are modules inside that app, not independently installed Django apps. `config` contains project settings/routing. Built-in Django auth, sessions, admin, contenttypes, messages and staticfiles are installed alongside DRF and CORS middleware. `myapp/admin.py` registers no custom models; the owner React interface is the implemented operational UI. [Sources: `backend/config/settings.py::INSTALLED_APPS`; `backend/myapp/admin.py`.]

`models.py` defines 18 application models; `serializers.py` handles their main representations and validation. `views/` contains `auth`, `products`, `cart`, `orders`, `admin`, `inventory`, `planning`, `kitchen`, `storefront`, `wallet`, `costs`, `reminders`, and `help`. `services/` contains deterministic scheduling, stock-date summary, forecast, recommendation, reminder delivery, kitchen-help classification, and an unused legacy AI summarizer. `exceptions.py::api_exception_handler` maps protected/integrity conflicts to 409, operational database failures to 503, and unexpected failures to a generic 500 with a reference while logging server details. [Sources: those modules and `backend/myapp/urls.py::urlpatterns`.]

Fourteen application migrations are present. Migration `0005` introduces the raw-material/recipe inventory structure; `0011` introduces detailed planning fields; `0012::preserve_windows` preserves legacy preparation windows without fabricating tasks; `0013` adds manual-payment settings/snapshots; `0014` adds costing/wastage/handling fields. The models and applied migration state must be distinguished from migration history.

## 4. Database models, keys and relationships

All 18 custom models have an implicit `id` BigAutoField primary key (`DEFAULT_AUTO_FIELD`), with conventional table names such as `myapp_product`. FK columns are named `<field>_id`; JSON snapshots are not foreign keys. The built-in Django `auth.User` has its own framework schema (username, hashed password, names/email, staff/active/superuser flags, login/join dates, groups and permissions); it is not a custom `myapp` model. Consult the complete field declarations in `FYP-SOURCE-CATALOG.md` for every field type, length, precision, null/default/choice and constraint. [Sources: `backend/myapp/models.py`, each named class; `backend/config/settings.py::DEFAULT_AUTO_FIELD`.]

- `Category`: unique name and creation timestamp. One category to many products; `Product.category` is nullable, `SET_NULL`.
- `Product`: name/description/AI-summary field, price, category, image/social URLs, creation/update timestamps; packaging cost; lead hours, basic preparation/extra-batch/packing durations, batch size, daily capacity, early-finish/preparation-span limits and JSON preparation tasks. **No stored product stock column**: serializer `stock` is computed.
- `RawMaterial`: unique name, one inventory unit (`g`, `kg`, `ml`, `l`, `unit`), optional estimated unit cost, creation timestamp.
- `ProductIngredient`: product FK (`CASCADE`, reverse `ingredients`), raw-material FK (`CASCADE`, reverse `product_ingredients`), decimal `quantity_required` per portion. Unique `(product, raw_material)` pair. This is the explicit many-to-many recipe junction.
- `InventoryItem`: raw-material FK (`PROTECT`, reverse `inventory_items`); decimal remaining quantity, batch code, location, receipt/effective-expiry dates, timestamps. Also expiry basis, manufacture date, shelf-life days, storage type, guidance, quarantine, supplier/source, printed-date type/original date, opened/thawed dates and durations, handling history/note, optional unit purchase cost. Batch codes are not unique.
- `Wallet`: one-to-one User (`CASCADE`), decimal balance (18 digits/10 decimal places), unique generated wallet address, external flag, timestamps. `WalletTransaction`: many-to-one wallet (`CASCADE`, reverse `transactions`), amount, type, text reference and creation time. Type choices include deposit/withdrawal/payment/refund, but choices alone do not implement all operations.
- `Address`: User FK (`CASCADE`), recipient/address/contact fields and default flag. Conditional uniqueness permits at most one default address per user; it does not forbid additional non-default database rows.
- `CartItem`: User and Product FKs (both `CASCADE`), positive-integer quantity and added timestamp; unique `(user, product)`.
- `Order`: User FK (`CASCADE`); nullable Address FK (`SET_NULL`); food total, discount, shipping fee, order/payment status and method; delivery/preparation start/end, delivery method, inventory-deducted flag, JSON delivery-address/payment-instruction/preparation-plan snapshots, timestamps.
- `OrderItem`: Order FK (`CASCADE`, reverse `items`), nullable Product FK (`SET_NULL`), product-name and unit-price snapshots, quantity and subtotal. Historical item names/prices survive product deletion; the live recipe does not.
- `InventoryLog`: nullable InventoryItem FK (`SET_NULL`, reverse `logs`), signed change, reason, free-text reference, nullable User FK named `admin` (`SET_NULL`), creation timestamp. There is **no Order FK**.
- `Storefront`: business/story/contact/social fields, kitchen opening/closing hours, delivery buffer, bulk threshold/discount, manual-payment flag/instructions/QR URL. Application code uses PK 1 as a singleton; the database does not enforce only one row.
- `Review`: Product and User FKs (`CASCADE`), rating, comment, creation time; unique `(product,user)`.
- `OrderReminder`: Order FK (`CASCADE`), event string, sent timestamp; unique `(order,event)`.
- `KitchenBlock`: start/end, reason; ordered by start; database check `end_at > start_at`.
- `OperatingExpense`: unique UUID request ID, void flag, date, category, amount, note, creation timestamp. No user/supplier FK.
- `WasteRecord`: unique UUID request ID; InventoryItem FK (`PROTECT`); quantity, nullable estimated-cost snapshot, reason, creation timestamp. No order FK.

Deletion implications matter for the report: deleting a product removes its recipe and cart links, nulls order-item product links and deletes its reviews. API raw-material deletion is stricter than the recipe FK: it refuses any linked batch or recipe. Inventory deletion is refused when a waste record exists; otherwise its logs survive with a null batch FK. User deletion through the broad staff viewset can cascade into orders and other user-owned records. [Sources: model `on_delete` declarations; `views/inventory.py::{RawMaterialDetail.perform_destroy,InventoryItemDetail.perform_destroy}`; `views/admin.py::AdminCustomerViewSet`.]

## 5. Important API endpoints

All paths below begin with `/api/`, as established by `backend/config/urls.py`. Route bindings are in `backend/myapp/urls.py::urlpatterns/router`. “Staff” means DRF `IsAdminUser` or an explicit `is_staff` check; “user” means authenticated, generally scoped to that user.

- Public account/bootstrap: `POST signup/`, `POST login/`, `POST logout/`, `GET check-auth/` → `views/auth.py::{signup_view,login_view,logout_view,check_auth}`.
- Public catalog: `GET menu/?page=&search=&category=` → `views/products.py::MenuList`, 12/page; `GET products/`, `GET products/<pk>/`, `GET categories/`, `GET categories/<pk>/` → corresponding list/detail generic views. Product/category writes are staff-only: POST collection; PUT/PATCH/DELETE detail. `admin/products/add/` and `admin/products/<pk>/` alias the product views; their GET permissions remain public despite the prefix.
- User cart: `GET/POST cart/`, `PATCH/DELETE cart/<pk>/` → `views/cart.py::CartViewSet`. No implemented retrieve/PUT action on this ViewSet.
- User address: `GET/PUT address/` → `views/orders.py::saved_address`; `GET addresses/` → `AddressListCreate`, which actually inherits **ListAPIView** and does not support POST.
- User order: `POST orders/quote/`, `POST orders/place/`, `GET orders/` → `preparation_quote`, `place_order`, `OrderList` in `views/orders.py`.
- Staff orders: `GET admin/orders/`, `PATCH admin/orders/<pk>/` → `views/admin.py::{admin_order_list,admin_order_detail}`.
- Staff materials/batches: `GET/POST admin/raw-materials/`, `GET/PUT/PATCH/DELETE admin/raw-materials/<pk>/`; same methods for `admin/inventory-items/` and detail → generic classes in `views/inventory.py`. Batch updates require the latest `updated_at` value.
- Staff planning: `GET admin/planning/` → `views/planning.py::planning`; `GET/POST admin/kitchen-blocks/`, `DELETE admin/kitchen-blocks/<pk>/`, `POST admin/orders/<pk>/preparation-plan/` → `views/kitchen.py::{kitchen_blocks,kitchen_block_detail,review_order_plan}`.
- Staff reporting: `GET admin/reports/sales/` → `views/admin.py::product_sales_report`; `GET admin/analytics/` → `views/planning.py::sales_analytics`.
- Staff costs: `GET admin/costs/?start=&end=`, `GET/POST admin/expenses/`, `POST admin/expenses/<pk>/void/`, `POST admin/waste/` → `views/costs.py::{cost_report,expenses,void_expense,record_waste}`.
- Staff customers: router-generated `admin/customers/` and `admin/customers/<pk>/` → `AdminCustomerViewSet`, a full ModelViewSet with inherited CRUD routes. `UserSerializer` exposes writable staff/active flags and read-only id/username; there is no purpose-built account-creation flow here. Older standalone `admin_customers_list/admin_customer_update` functions are not the registered routes.
- Storefront: public `GET storefront/`, staff `PATCH storefront/` → `views/storefront.py::storefront`; public `GET inventory-freshness/` → `inventory_freshness`.
- Reviews: public `GET products/<pk>/reviews/` and `GET products/<pk>/review-access/`; authenticated/eligible `POST products/<pk>/reviews/` → `reviews`, `review_access` in `views/storefront.py`.
- Recommendations: user `GET recommendation/` → `views/products.py::recommend`.
- Demo wallet: user `GET wallet/`, `POST wallet/create/`, `POST wallet/topup/` → `views/wallet.py::{get_wallet,create_wallet,topup_wallet}`.
- Help: public `GET/POST help/` → `views/help.py::KitchenHelp`, throttled by `HelpThrottle`.
- Reminders: staff `GET admin/reminder-status/`; `GET reminders/run/` with a valid secret Bearer token (session auth disabled on this route) → `views/reminders.py::{reminder_status,run_reminders}`.

No inventory-log listing API, dedicated ingredient endpoint, customer cancellation endpoint, live payment webhook, or supplier endpoint is registered. Recipe writes occur within product payloads. `/django-admin/` is separate from the API.

## 6. Authentication and authorization flow

1. `AuthProvider::checkAuth` requests `/api/check-auth/`. `check_auth` calls `get_token`, setting up the CSRF cookie, and returns authentication/staff status.
2. Signup checks required username/password/confirmation, matching passwords and duplicate username, then uses `User.objects.create_user` and immediately `login`. Login uses `authenticate` followed by `login`; logout calls Django `logout`.
3. Django persists the session server-side. Browser requests use session cookies; mutating Axios calls normally read `csrftoken` through `cookieUtils::getCookie` and send `X-CSRFToken`.
4. `RequireAuth` controls rendering and opens the login dialog; DRF enforces authenticated/staff access on protected backend operations and querysets restrict customer records.

[Sources: `views/auth.py`; `frontend/src/contexts/AuthProvider.jsx`; `frontend/src/utils/cookieUtils.jsx`; `frontend/src/hoc/RequireAuth.jsx`; protected views; `backend/config/settings.py`.]

Settings use SameSite=Lax cookies, HttpOnly session cookie, readable CSRF cookie, configured CORS credentials/trusted origins, and Secure cookies in Vercel mode. DRF authentication classes are not overridden, so its default session/basic authentication applies; there is no JWT/token issuance flow. Configured Django password validators are **not explicitly invoked by this signup handler**; do not claim signup enforces all configured password-strength checks. Anonymous login/signup should not be described as having a dedicated enforced CSRF login protection simply because the frontend sends a header: these are DRF function views with no explicit anonymous CSRF enforcement. No password reset, email verification, MFA, or account rate-limit implementation was found in account routes. [Sources: settings; `views/auth.py::signup_view/login_view`; compare explicit `HelpThrottle` on the help endpoint.]

## 7. Preorder and order workflow

Customers add positive quantities to a persistent user cart. Adds merge the same product; PATCH quantity 0 removes it. Neither cart operations nor checkout require current inventory availability. This permits buying ingredients later for future preorders. [Source: `views/cart.py::CartViewSet`; `views/orders.py::place_order`.]

`place_order` executes in an atomic transaction:

1. Lock the requesting User row; validate owned address, nonempty cart and supported payment.
2. Reject PayPal. For manual payment require enabled settings plus transfer text or a QR URL.
3. Ensure Storefront PK 1 exists and lock it to serialize bookings across the single kitchen; lock the involved products in ID order.
4. Parse delivery datetime and call `schedule_order` for lead-time, working-hours, task/resource conflict, horizon and capacity checks. Validate standard/express method; independently recheck per-product delivery-day capacity.
5. Calculate prices from current database product prices, not client totals. If total portions reach `bulk_minimum`, apply the configured percentage to the food subtotal, rounded to cents. Shipping is RM5 when the **pre-discount** food subtotal is below RM50, otherwise zero. `Order.total_amount` is discounted food only; payable amount adds `shipping_fee`.
6. Wallet payment locks/checks/debits the demo balance and starts paid. COD/manual start unpaid. Create the pending order with address/payment-instruction/preparation-plan snapshots and scheduled start/end.
7. Create OrderItems containing product reference plus name/unit-price/subtotal snapshots, save order totals, clear cart and record a wallet payment transaction if applicable. Return HTTP 201 and order ID. No inventory is deducted here.

[Source: `backend/myapp/views/orders.py::place_order`; tests `KitchenTests::{test_preorder_does_not_deduct,test_early_delivery_rejected,test_capacity_enforced,test_bulk_discount}` and `SavedAddressTests::test_order_snapshot_survives_saved_address_edit`.]

The quote is advisory: `preparation_quote` calls the scheduler but reserves nothing. Placement re-evaluates availability. Customer checkout does not require a prior successful quote token. Address and preparation snapshots preserve an accepted order when settings/address/menu timing are subsequently changed; ingredient recipes are **not** snapshotted. [Sources: `preparation_quote`, `place_order`, `OrderSerializer.get_address`; `PlanningTests::test_quote_is_advisory_and_snapshot_is_immutable`.]

Owner status changes use `admin_order_detail` with these permitted transitions (self-transitions also allowed): pending → processing/cancelled; processing → cooked/cancelled; cooked → shipped/cancelled; shipped → delivered; delivered/cancelled are terminal. Cooking triggers FEFO once. Payment status can independently be set to unpaid/paid/refunded after validating the choice; there is no required payment-before-cooking rule. Marking refunded only changes a status, not wallet/bank balances. Cancellation after cooking does not restore ingredients; cancellation of a paid wallet order does not automatically refund credits. [Source: `views/admin.py::admin_order_detail`.]

Express is a request flag/external arrangement, not a courier booking or different server shipping tariff. Delivery snapshots and owner status progression are implemented; live tracking, proof of delivery and traffic-aware ETA are not. [Sources: `Order.delivery_method`; `place_order`; `frontend/src/pages/admin/PlannerPage.jsx`; `docs/OPERATIONS-AND-FEATURE-STATUS.md`.]

## 8. Raw-material inventory workflow and expiry rules

Staff creates a RawMaterial with one fixed unit, then records InventoryItem batches linked to it. A batch is a remaining-quantity record, not a purchase order. Staff can edit absolute quantity and evidence fields; no conversion between grams/kilograms or millilitres/litres is implemented. Once batches or recipes reference a material, API unit changes and deletion are blocked. [Sources: `views/inventory.py` generic classes and `RawMaterialDetail.perform_destroy`; `serializers.py::RawMaterialSerializer.validate_unit`; `AdminInventoryPage`.]

`InventoryItemSerializer.validate` determines the effective date:

- `label`: printed expiry is required; preserve/use `original_expiry_date` separately.
- `manufactured`: manufacture date + shelf-life days; manufacture must not be later than receipt.
- `storage`: receipt date + storage-life days.
- Calculated bases require a start, positive duration and guidance source. Receipt cannot be future; quantity cannot be negative; base expiry cannot precede receipt.
- If opening or thawing is recorded, its duration must also be recorded, the event must be between receipt and today, and guidance must be nonblank. Effective expiry is the earliest base/opened/thawed deadline.
- Documented handling requires a handling note. Unknown handling or known breach forces `quarantined=True`; changing the description to documented does not automatically clear an existing hold.

The code uses calendar dates, not time-temperature sensors. Storage type alone does not change the duration. The label's use-by/best-before classification is recorded, but there is no distinct automatic disposal model for the two types. [Sources: `models.py::InventoryItem`; `serializers.py::InventoryItemSerializer.validate`; `components/ExpiryFields.jsx`.]

Updates lock the batch and compare submitted `updated_at` with the stored timestamp. Missing, malformed or stale versions return 409, avoiding overwriting consumption with a stale absolute quantity. Fresh edits advance the timestamp. The frontend offers reload/discard-edits recovery. [Sources: `views/inventory.py::InventoryItemDetail.update`; `AdminInventoryPage`; `test_inventory_audit.py::InventoryAuditTests`.]

Waste recording is separate: staff posts a UUID, batch, quantity and reason; `record_waste` locks user/batch, validates available quantity, deducts stock, snapshots `unit_cost × quantity` if known, creates WasteRecord and negative InventoryLog atomically. Matching retries return the previous result; the same UUID with different details is rejected. This protection should not be generalized to every write endpoint. [Source: `views/costs.py::record_waste/WasteInput`; `CostsAndFreshnessTests`.]

## 9. Product–RawMaterial / MenuIngredient relationship and availability

**The repository's actual class is `ProductIngredient`; no `MenuIngredient` class is present.** “MenuIngredient” may be used in conceptual discussion only if explicitly mapped to ProductIngredient. Product is the menu item, RawMaterial is the ingredient master, and ProductIngredient holds how much of that material one portion consumes. A material may be used by many products; each material has many stock batches. [Source: `models.py::{Product,RawMaterial,ProductIngredient,InventoryItem}`.]

Example for explanation, not seeded business data: a product needing 100g chicken and 150g rice per portion, with eligible stocks 550g and 900g, has `min(floor(550/100), floor(900/150)) = 5` possible portions.

Eligibility uses positive remaining quantity, received on/before today, expiry on/after today and not quarantined. For each material, sum eligible batch quantity, divide by quantity-per-portion with floor division, then take the minimum across recipe rows. No recipe means zero. The model method defensively makes a nonpositive recipe requirement yield zero; the serializer skips nonpositive rows in its generator. Valid API recipes require at least 0.001, so invalid direct-database records can produce divergent edge behaviour. [Sources: `Product.get_available_quantity`; `ProductSerializer.get_stock`; `RecipeSerializer`.]

`ProductSerializer.get_stock` aggregates eligible inventory by raw-material ID once per serializer instance and returns an integer; this is the live full-product serialization/recommendation path. The model method performs per-material queries. `/api/menu/` uses `MenuCardSerializer`, which does not include stock/freshness. Current stock is shown on owner menus and informs detail freshness/recommendations, but **does not disable preorder placement**. Products sharing a raw material each get a standalone possible-portions figure; those figures cannot be added as simultaneous supply commitments. Neither computation subtracts outstanding preorder demand. [Sources: `serializers.py::ProductSerializer`; `views/products.py::{MenuCardSerializer,MenuList}`; `services/recommendation.py::recommend_for_user`; `views/cart.py`; `views/orders.py::place_order`; frontend product pages.]

Recipe writes are nested product `ingredients` lists, containing `raw_material` ID and `quantity_required`. Duplicate materials are rejected. Product create/update wraps recipe persistence in a transaction; an omitted list on update preserves the recipe, while a supplied list replaces all rows (including an empty list removing the recipe). There is no recipe version history, yield/loss factor or automatic unit conversion. [Source: `serializers.py::ProductSerializer.{validate_ingredients,create,update}`.]

## 10. Actual FEFO inventory deduction execution flow

The trigger chain is:

`AdminOrdersPage.saveEdit` → `OrderProvider.updateOrder` → `PATCH /api/admin/orders/<id>/` → `admin_order_detail` → `deduct_inventory` once per OrderItem → InventoryItem updates + InventoryLog inserts → mark `inventory_deducted=True` and save order.

`admin_order_detail` is staff-only and atomic. It locks the Order row and validates transitions. Only requested status `cooked` with `inventory_deducted=False` enters deduction. A deleted ordered product or a product without a recorded recipe raises a validation error. [Sources: `frontend/src/pages/admin/AdminOrdersPage.jsx`; `frontend/src/contexts/OrderProvider.jsx`; `backend/myapp/views/admin.py::admin_order_detail`; `views/orders.py::deduct_inventory`.]

For each current recipe row, the algorithm:

1. Computes required quantity = `ingredient.quantity_required × ordered portions` using Decimal arithmetic.
2. Selects and row-locks eligible batches for that raw material: positive quantity, expiry >= today's local date, receipt <= today, not quarantined.
3. Orders candidates by `expiry_date`, then `received_date`, then `id` ascending. It is FEFO, not receipt-only FIFO.
4. Takes `min(batch.quantity, remaining_requirement)`, subtracts it, saves quantity/update timestamp, and inserts a negative log for that batch.
5. Continues across batches until the requirement is satisfied. If stock runs out first, raises DRF ValidationError naming the material/product.

The surrounding order transaction rolls back earlier deductions/logs and order changes on a shortage, including deductions from preceding items. After all items succeed, the boolean prevents a repeated cooked request from deducting again. The helper itself is not decorated atomic; correct rollback/locking depends on its transactional caller. Expired or quarantined stock remains stored but is excluded. [Sources: `deduct_inventory`; `admin_order_detail`; `KitchenTests::{test_cooking_fefo_and_idempotence,test_shortage_rolls_back_every_deduction}`.]

Important limits: deduction uses the **date the owner marks cooked**, not the scheduled preparation date; it uses the current recipe, not the order's historical recipe; it does not check that the scheduled time has arrived. It does not follow a saved planner allocation, because no such stock reservation is persisted. PostgreSQL row locking is present in code, but the local SQLite tests do not prove concurrent PostgreSQL behaviour or absence of deadlocks across multi-material orders.

## 11. InventoryLog behaviour

Two production write sites create logs:

- `views/orders.py::deduct_inventory`: one negative change per consumed batch per recipe/order-item execution; reason `Used for <product name>`; reference `Order #<id>`; actor is the staff user.
- `views/costs.py::record_waste`: negative waste quantity; reason prefixed `Waste: `; reference `Waste #<id>`; actor is the staff user.

Stock changes and logs are committed/rolled back together in those transactional paths. Matching waste retries and repeated cooked transitions do not create duplicate deductions/logs. But ordinary batch creation, absolute quantity edits and batch deletion do **not** create receipt/adjustment/deletion logs. There are no signals or save overrides supplying automatic audit logging. Thus InventoryLog is a partial consumption/waste history, **not a complete perpetual inventory ledger**. [Sources: both write sites; `InventoryItemSerializer`; inventory CRUD views; repository search for `InventoryLog`.]

`reference` is plain text, not a database relationship. Deleting a batch nulls its log FK; deleting the acting user nulls `admin`. The log has no material-name/unit/batch-code snapshot, before/after balances, structured event type or immutable enforcement. There is no exposed log-viewing page or API in current routing. [Sources: `models.py::InventoryLog`; `urls.py`; `App.jsx`; `myapp/admin.py`.]

## 12. Preparation planner: scheduling and procurement

### Deterministic scheduling

`services/scheduling.py::{validate_tasks,preparation_work,schedule_order,booked_tasks,order_interval,plan_snapshot}` implements a conservative greedy **backward scheduler**, not an AI-generated schedule or globally optimal solver. It assumes one worker and one unit of each named resource: prep table, stove, oven, rice cooker, fridge, packing area; `none` means no equipment.

`validate_tasks` permits up to 20 ordered steps. Each has a name, base minutes, extra-batch minutes, equipment, worker flag, overnight flag and maximum permitted wait before the next step. Durations are integers. Only unattended fridge/none steps may run overnight. Tasks run without interruption; occasional attention must be modeled as separate steps.

`preparation_work` computes `ceil(portions / batch_size)` and step duration `base_minutes + (batches−1) × additional_batch_minutes`. Explicit task lists replace basic timing, so packing must be included explicitly if required. If tasks are empty, it supplies a hands-on Cook estimate using prep_table and, when configured, Pack time proportional to portions. Separate orders are not merged into one production batch.

`schedule_order`:

1. Rejects an empty basket, past/over-90-day delivery, delivery outside 09:00–before 21:00 Malaysia time, or excess per-product daily capacity. Capacity counts noncancelled order quantities on the requested delivery day, regardless of payment status.
2. Sets ready time to delivery minus the store's delivery buffer. The earliest allowed preparation is at least now plus the maximum menu lead time (or the original notice origin for replanning), also bounded by each menu's maximum preparation days before ready time.
3. Reads kitchen closures plus immutable pending/processing, not-deducted orders. Saved tasks reserve their resources/worker; legacy orders reserve the whole interval as `resource='all'`.
4. Sorts menu sequences by descending total task minutes, then product ID. Places each sequence in reverse task order, initially ending at ready time.
5. Constrains attended/non-overnight steps to kitchen opening/closing hours. A final task can finish earlier only within `max_early_minutes`; earlier steps are constrained by their maximum wait before the following step.
6. Detects overlap with a kitchen block/all-resource interval, identical non-none equipment, or two worker-required tasks. On conflict, moves the candidate ending time to the earliest conflicting start and tries again. Rejects when the earliest-start/wait bounds cannot be satisfied.
7. Returns earliest start, latest end, total step minutes, hands-on minutes, timestamped tasks, menu lines and timing assumptions. `plan_snapshot` excludes the top-level start/end because Order stores them separately.

Some tasks can overlap when equipment differs and no worker conflict exists. Total step minutes, hands-on minutes and elapsed window are therefore different measures. Accepted plans are saved JSON snapshots; current configuration changes do not silently move them. Greedy rejection does not prove no feasible human arrangement exists. [Source: the scheduling functions above; `test_planning.py::PlanningTests`.]

### Owner review and daily UI

`review_order_plan` permits replanning only pending, undeducted orders with a delivery date, existing products and explicit menu tasks. It excludes the current order from conflicts and uses original creation time for notice. First POST returns a proposed snapshot and signed confirmation token. A confirming POST recalculates under locks and verifies an exact match and token age <=600 seconds; changed availability yields 409. Only then does it save. This is implemented review, not arbitrary drag-and-drop scheduling. [Source: `views/kitchen.py::review_order_plan`; `components/PlanReview.jsx::PlanReview`.]

KitchenBlock create/delete is staff-only and serialized by the Storefront lock; creation refuses overlap with existing booked work. Store opening-hour edits do not automatically replan old orders. `utils/planner.js::dailyWork` clips tasks to a Malaysia calendar day, sums hands-on work, unions overlapping closures, and flags overlaps/out-of-hours work. Legacy intervals are labelled as needing review. `PlannerPage::exportCalendar` creates a downloadable ICS file for saved steps/deliveries, including 15-minute preparation alerts; this is one-way export, not live calendar synchronization. [Sources: `views/kitchen.py`; `StoreSerializer`; `frontend/src/utils/planner.js`; `PlannerPage.jsx`.]

### Inventory allocation and shopping preview

`views/planning.py::planning` separately performs **read-only** stock simulation. It reads outstanding orders excluding cancelled/delivered, ordered by preparation start then ID. It ignores already-deducted orders for material demand. It loads current positive, received, in-date, unquarantined batches and orders them by expiry then ID (not the receipt-date tie-break used by cooking).

For each order it aggregates current recipe requirements, allocates from a shared in-memory remaining balance so the same quantity is not reused across orders in that response, and only uses a batch whose expiry reaches the order's preparation-end date (fallback start/today for older records). Each residual need becomes a shopping row with order/material/quantity/unit and needed-by preparation-start date. Allocations and shortages are returned alongside orders, kitchen availability, menus needing tasks, analytics and forecast. No InventoryItem or reservation row is written. Missing/deleted product recipes cannot contribute needs, so an empty shopping list is not proof that all orders can be cooked. [Source: `views/planning.py::planning`; tests `test_shopping_does_not_double_allocate`, `test_shortages_exclude_batch_expiring_during_multiday_preparation`.]

## 13. Other implemented functionality and its limits

**Freshness transparency:** `services/freshness.py::inventory_summary` calculates equal-weight average recorded shelf-life remaining per nonempty received batch. Expired/held batches contribute zero; unknown evidence is counted separately and excluded from the average. Manufacture-based batches use manufacture-to-expiry; others use receipt-to-expiry. Formula is clamped `100 × (expiry−today)/(expiry−start)`. This is neither quantity-weighted nor a food-safety measurement; stock remains eligible through expiry day even though that day's percentage can be zero. Public `inventory_freshness` returns aggregate indicators rather than individual private batch records.

**Recommendations:** `services/recommendation.py::recommend_for_user/get_score` uses category history (180 days), individual quantities (365 days), and global popularity (30 days). Score adds 25 for a preferred category, up to 20 for prior quantities, up to 15 for popularity. It filters by computed stock, sorts by score then product ID, and returns up to 20, with a cold-start exploration reason. The routed call uses `exclude_bought=False`. History excludes cancelled orders but does not require paid status. This is a local heuristic, not machine-learning training. Older `handle_recommendation` code is not the active routed algorithm.

**Sales and forecast:** `views/planning.py::sales_summary` reports paid noncancelled orders: food revenue after discounts/excluding shipping, count, average, recent seven-day trend and 28-day portions. It uses order creation dates, not delivery dates. `product_sales_report` uses item quantities × snapshot unit prices, so its product revenue is before allocated order discounts; do not equate its sum with net food revenue. `services/forecast.py::estimate` predicts seven-day portions using trailing daily average, optionally compares a 28-day linear-trend fit with that average using the last seven completed days as chronological holdout when >=42 days and >=14 nonzero days exist. It reports MAE when that comparison is possible; absent sales return unknown. There is no measured real-business prediction accuracy in this review.

**Costs:** `views/costs.py::cost_report` computes current recipe ingredients × estimated unit costs plus packaging, then current price contribution/margin. Missing recipe/cost assumptions yield unknowns. Date ranges affect expense/waste totals, not historical reconstruction of menu costs. Expenses support categories, UUID retry protection and voiding; waste values use batch purchase cost snapshots. This is not historical COGS, net profit, double-entry accounting or automatic valuation.

**Reviews:** `views/storefront.py::{reviews,review_access}` requires a delivered order containing the product, one review per user/product, rating 1–5 and bounded comment. Eligibility checks delivered status, not payment status. Review browsing is public; no moderation/edit/delete flow is registered.

**Manual payments/demo credit:** COD/manual order placement and owner payment marking are implemented. Manual instructions and QR URL are snapshotted; the owner verifies payment externally. `views/wallet.py` lets users create generated internal wallet identifiers and directly top up demo balances; no funded real-money verification occurs. Wallet debit on placement is transactional, but top-up is not similarly locked/atomic and parses Decimal directly. Treat the wallet as a demonstration, not a financial service.

**Email reminders:** `services/reminders.py::{email_ready,send_due_reminders}` checks configuration and sends owner preparation/delivery reminders in a ±24-hour window, at most three attempts per run. Preparation reminders require pending status; cancelled/delivered orders are skipped. It locks orders, records unique event receipts only after success, and permits retries on failure. `send_order_reminders.Command` previews by default and sends only with `--send`. The HTTP worker uses a >=32-character configured Bearer secret. SMTP and an external invocation schedule are required; there is no bundled Celery worker or cron schedule in `vercel.json`. An email accepted before a process/database failure can still lead to a retry; do not claim exactly-once external delivery.

**Kitchen Help:** `views/help.py::{KitchenHelp,HelpInput,HelpThrottle}` and `services/kitchen_help.py::{TEXT,TOPICS,local_topic,ai_topic}` provide approved answers in English, Malay and Simplified Chinese. Local keyword/topic selection runs first; optional user-enabled Groq classification runs only for unknown questions and configured keys. Provider output must be one allowed topic; timeout/invalid output falls back. Redaction is best effort. Answers come from fixed text, not unrestricted model generation. Menu suggestions filter database price, requested portions and optional name/budget; they do not book time or prove inventory availability. Limit is 20 requests/minute via DRF throttle/cache. No private-order chatbot access is provided.

**Separate escrow prototype:** `escrow/PreorderEscrow.sol::PreorderEscrow` provides fund, dispatch, confirmReceipt, refund, dispute, resolve and pull-payment withdraw. Constructor allows only chain IDs 11155111 or 31337; funding requires distinct buyer/seller/arbiter, nonzero unique bytes32 ID, >0 and <=0.01 test ETH, dispatch within seven days. Resolution deadline is dispatch deadline +7 days. Browser `EscrowDemoPage` permits Sepolia and requires a deployed contract/browser wallet. There is no Django order or payment synchronization and no evidence of a deployed contract in this inspection. Current local lifecycle testing failed (next section); do not call it fully verified or audited.

## 14. Business-rule boundaries and known gaps

Implemented validations include recipe quantities >=0.001/no duplicate materials; product price >=0.01; bounded lead/capacity/batch/task inputs; cart additions 1–10000 and edits 0–10000; owned addresses; future scheduling/hours/capacity; allowed order transitions; nonnegative stock/dated expiry evidence; timestamp-conflict checks; waste quantity <= stock; positive expenses not dated in the future; valid store hours/discount range 0–50; review eligibility; help input limits and staff access. [Sources: `serializers.py`; `views/{cart,orders,admin,costs,storefront,help}.py`; `services/scheduling.py`.]

Most of these are **API serializer/view rules**, not database constraints automatically enforced on every ORM write. Model `save()` does not call these serializers. Migration/ORM/admin/manual database edits must not be assumed to receive identical validation. Explicit database uniqueness/check constraints are listed in the schema catalog.

Partial or incomplete areas that are observable in code:

- Stock audit history is incomplete; receipts/edits/deletes are unlogged, and deletion loses log batch context. [InventoryLog section.]
- Recipes can change after booking, altering cooking and shopping needs; no historical recipe/cost snapshot. [ProductSerializer.update; deduct_inventory; planning.]
- Product deletion is permitted even with outstanding orders; cooking/replanning later refuses a null product. [ProductDetail; admin_order_detail; review_order_plan.]
- Staff customer API can modify `is_staff`/`is_active` and inherits deletion; UI protections against editing owner accounts are not mirrored by a last-owner/self-deletion policy. [AdminCustomerViewSet; UserSerializer; AdminCustomersPage.]
- Wallet top-up lacks real payment verification and robust transactional/serializer protection; refunds are status changes only. [wallet.py; admin_order_detail.]
- Authentication has no implemented reset/verification/MFA flow and signup does not run password validators. [auth.py; urls.py.]
- Staff lists and full products/orders/reviews generally lack pagination; recommendations inspect all product candidates before slicing. Only public menu has explicit pagination. [generic views, admin.py, recommendation.py.]
- Some frontend effect/dependency/state patterns remain lint failures; cart/auth/loading race concerns are recorded in the prior audit. They were not comprehensively browser-tested again in this review. [Current lint output; `docs/AUDIT-2026-09-28.md`.]
- Scheduler is single-worker/single-equipment-unit, greedy, no task splitting, no cross-order batching or automatic rescheduling. Procurement preview is not stock reservation. [scheduling.py; planning.py.]

Planned/not implemented, supported by repository status documents and absent corresponding application routes/models:

- Supplier directory, purchase orders, supplier messages/APIs, expected-arrival/partial-receipt procurement flow. Implemented supplier data is only batch free text.
- Direct menu photo upload/object-storage pipeline. Current implementation stores external image URLs with preview.
- Double-entry ledger, balance sheet, e-Invoice/tax integration, bank reconciliation, supplier payables and historical per-order COGS.
- Live PayPal verification/webhooks, automatic DuitNow/bank confirmation, real-money escrow integrated with orders, automatic refunds.
- Courier booking API/live tracking/traffic ETA; social publishing/campaign attribution; full-site localization.
- Continuous temperature monitoring, image-based freshness diagnosis, measured microbiological safety prediction.

[Sources: `docs/OPERATIONS-AND-FEATURE-STATUS.md`; `models.py`; `urls.py`; `MenuPhotoField`; `place_order`; `EscrowDemoPage`; `freshness.py`. These are limitations/future scope, not promised scheduled development.]

Legacy/non-active artifacts: `services/ai.py::ai_summarize` calls Gemini but no current route/product write invokes it; `ai_summary` remains a field and its detail rendering is commented. `components/KitchenStory.jsx` is not the current routed business/help implementation (`BusinessLayout` uses `KitchenHelp`). Historical screenshots and README language about crypto/PayPal should not override current code. [Sources: imports/call-site search; App.jsx; ProductDetailPage; BusinessLayout; products.py.]

## 15. Tests implemented and actual results

Fresh verification on 29 September 2026 used repository `backend/venv/Scripts/python.exe` (**Python 3.13.2**) and **Node v24.21.0**. Backend execution disabled dotenv, set a test-only secret, selected `DATABASE_URL=sqlite:///:memory:`, `DEBUG=False`, `VERCEL=0`. The Django suite created/destroyed a temporary in-memory test database. No production migrations or data operations were performed.

- `python manage.py test myapp --noinput --verbosity 2`: **87 passed**, 12.232 seconds; Django system check found no issues.
- `python manage.py check`: **passed**, no issues.
- `python manage.py makemigrations --check --dry-run`: **passed**, “No changes detected.” This verifies model/migration consistency, not production migration application.
- `npm.cmd test` in frontend: **10 passed** (4 API-error utility tests and 6 planner utility tests), zero failures.
- `npm.cmd run build` in frontend: **passed**, Vite 8.0.10, 2390 modules, 7.36 seconds. Main JS 473.00 kB / 150.97 kB gzip; escrow lazy chunk 272.49 kB / 100.63 kB gzip. An initial sandbox attempt failed with process-spawn EPERM; the permitted build outside that restriction succeeded. These are bundle/build measurements, not page-load timings.
- `npm.cmd run lint`: **failed**, 27 errors and 9 warnings. Includes unused variables, React hook/dependency/effect/purity and refresh-export diagnostics. No blanket rule disabling or code fixes were made.
- `python -m unittest discover -s tests -v`: **1 passed**, 2.024 seconds. `tests/test_vercel_entrypoint.py::EntrypointTests.test_vercel_file_import_and_frontend_routes` imports the configured root WSGI entrypoint and checks SPA responses for `/`, `/checkout`, `/escrow-demo`; it uses an intentionally unusable PostgreSQL connection string and does not validate a live PostgreSQL database.
- Escrow `npm.cmd test` initially could not start its test child process in the sandbox (`spawn EPERM`). Running the same test module directly with `node escrow.test.mjs` executed both Node tests: **1 passed, 1 failed**. Mainnet deployment refusal passed. The lifecycle/roles/deadlines test failed at `escrow/escrow.test.mjs:21` with **“Missing expected rejection”** on the duplicate-funding expectation. Subsequent lifecycle assertions in that test did not execute. Ganache also reported a missing matching native µWS binary and fallback to its JS implementation. The cause of the assertion failure was not diagnosed; do not infer a proven contract exploit, or claim the lifecycle passed.

Implemented backend coverage by file/class:

- `tests.py::KitchenTests`: expiry sources, invalid stock/evidence, availability, FEFO/idempotence/rollback, transitions, checkout timing/capacity/discount, private endpoints, reviews, shopping allocation, recipes, reminders, recommendation cold start and material protection.
- `tests.py::{BrowserCartTests,SavedAddressTests}`: CSRF/origin behaviour via API client, auth bootstrap, SPA routing, story settings, single default address, ownership and order-address snapshot persistence. “BrowserCartTests” is a Django test class, not a browser automation suite.
- `test_planning.py::PlanningTests`: scaled durations, equipment/worker overlap, overnight steps, closures, capacity, task inputs, error hiding, query counts, forecast branches, immutable quote/bookings, expiry through multi-day preparation, preview/confirm/stale replanning and setup/hours.
- `test_menu.py::MenuPaginationTests`: bounded/stable pages, filtering, invalid page/category.
- `test_freshness.py::FreshnessSummaryTests`: date percentages, manufacturing start, expired/held/unknown/empty batches.
- `test_costs_freshness.py::CostsAndFreshnessTests`: missing costs, waste/expense retry and voiding, overdraw, effective deadlines, forced holds and private costing.
- `test_integrations.py::IntegrationTests`: manual-payment setup/snapshots, reminder authorization/readiness/bounds/deduplication/failures/stale orders. Email is mocked in relevant tests; this is not proof of SMTP delivery.
- `test_help.py::KitchenHelpTests`: languages, topic matching, consent, budgets, private-data boundaries, validation/throttle, provider timeout/output/redaction. Provider calls are mocked; this is not a live AI-provider check.
- `test_inventory_audit.py::InventoryAuditTests`: stale/missing/fresh edit versions, constant batch-list query count, compact analytics parity/query count and staff permission. In its forced-auth fixture, inventory serialization is one query for both 1 and 30 rows and compact analytics is five queries. These results exclude normal authentication middleware cost and do not measure production latency.

Frontend tests are `src/utils/apiError.test.js` and `planner.test.js`; the escrow module contains two named Node tests. `.github/workflows` declares frontend tests/build, Django checks/migration check/tests/static collection, entrypoint test and escrow tests on push/PR. Lint is not part of that workflow. Workflow existence is not evidence of a current successful remote CI run.

Historical evidence: `docs/AUDIT-2026-09-28.md` records prior query comparisons and keyboard/responsive/error-recovery browser checks. Cite those as the prior audit's reported results, not as newly rerun user testing. This handoff did not conduct another browser sweep, user study, load test, coverage-percentage measurement, PostgreSQL concurrency test, live SMTP/provider test, or Sepolia deployment. A passing build is compilation evidence, not proof of every interface flow.

## 16. Information useful for FYP Chapter 4 and later chapters

### Chapter 4: implementation material safe to document

Describe a React/Django relational preorder system for a single home kitchen. Explain customer versus staff access, Context-based frontend data flow, API modules, and the explicit recipe junction. Use the actual model names/fields and FK deletion behaviours from Section 4 and the source catalog; label ProductIngredient clearly if the report's conceptual ERD calls it MenuIngredient.

The strongest implementation walkthrough is **recipe → raw-material batches → computed current portions → future preorder scheduling → owner cooked transition → transactional FEFO/logs**. Show that current portions, scheduling capacity, planning allocations and actual consumption are separate calculations. Cite `ProductSerializer.get_stock`, `schedule_order`, `planning`, `admin_order_detail` and `deduct_inventory`. Do not say checkout reserves or consumes ingredients.

Explain backward scheduling with batch rounding, ordered steps, single worker/equipment conflicts, allowed unattended overlap, date/hours limits and immutable booking snapshots. Include an annotated worked example explicitly labelled illustrative rather than measured business data. Describe signed preview/confirm replanning and legacy-window preservation. Do not describe an optimal solver or autonomous AI preparation planner.

Show expiry-evidence handling and optimistic edit conflict detection as concrete implementation decisions. Describe recorded shelf-life remaining as a date-based indicator. Separate consumption/waste logs from the incomplete general stock audit history. Native dialogs, retry states and compact analytics are implemented improvements, but avoid broad accessibility/performance certification claims.

Document manual payment verification, demo credits and testnet escrow in separate subsections. Optional Groq is topic classification with approved responses; recommendation and demand forecasting are deterministic local algorithms. Gemini summary code is legacy/unwired.

### Testing/evaluation chapters

Use Section 15's dated pass/fail results, runtime/commit/database context and named test methods to build requirement-linked test cases. Include successful, rejected, repeated and rollback cases. Preserve the lint and escrow failures. The test suite's exact assertions support narrower claims than “all functionality fully tested.”

For performance discussion, cite only fixture query counts and distinguish prior measured changes from fresh regression assertions. Do not convert query-count reductions into unmeasured latency gains. Report holdout MAE as a capability unless actual representative data/results are separately collected; do not fabricate forecast accuracy, waste reduction, customer satisfaction or time savings.

### Discussion, limitations and future work

Explain single-worker scheduling, absent persistent material reservations/recipe history, incomplete audit logs, payment/refund limitations, supplier/photo/accounting gaps, frontend lint debt and unresolved escrow testing. Use the future features explicitly documented in Section 14 as proposals, not achievements. State that PostgreSQL concurrency, real integrations, usability and food-safety outcomes need separate evidence.

### Suggested wording for the report-writing AI

“The implemented system supports preorder booking with deterministic preparation scheduling and recipe-linked inventory calculations. Ingredient quantities are deducted using FEFO when a staff user marks an order cooked, within a transaction that also records consumption logs. The preparation planner estimates allocations and shortages without persisting stock reservations. Freshness indicators are derived from recorded storage dates and are not measurements of food safety. Payment integration is limited to COD, owner-verified manual transfer and demonstration facilities. Local verification passed 87 Django tests, 10 frontend utility tests and one entrypoint test, while frontend lint and one escrow lifecycle test remained failing.”

Use this paragraph as a factual scope summary, not as evidence of business impact or deployed service readiness. Every later claim should remain bounded by its cited implementation or separately collected evaluation data.
