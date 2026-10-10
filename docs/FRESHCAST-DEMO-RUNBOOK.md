# FreshCast connected kitchen demo

Open `https://preorder-freshness.vercel.app/admin/ai/decisions` and sign in using
the existing staff account. The default is **My kitchen**, not Genpact or frontend
fixtures. The UI reads current database preorders, accepted recipe snapshots and
dated stock. Use Refresh kitchen data after making a change elsewhere.

## Four-minute walkthrough

1. Show the source banner and order coverage. The site uses fictional demo
   transactions stored in the database; there is no claim of real customer sales.
2. Select **Chicken boneless trimmed**. Demo order **#25** contains four portions
   of **Nasi Ayam Kunyit**. Its accepted recipe requires **720 g**; usable stock
   covers **360 g**, leaving **360 g uncovered**.
3. Continue through **Understand why** and **Explore actions**. Point to the
   accepted menu name, preparation dates, ingredient quantities and purchasing
   explanation. No forecast of additional customers is included.
4. In **Compare tradeoffs**, enter a hypothetical 360 g purchase, an assumed
   arrival by preparation start, an expiry covering preparation end and an
   optional price **per gram**, not per kilogram. The comparison recalculates
   FEFO: this assumption can bring the chicken shortage to zero. A late arrival
   or expiry before preparation end cannot cover it. No stock/purchase is saved.
5. Select **Rice** to show the other risk: **360 g required**, **540 g stocked**,
   **180 g expiring unused** within the window, with **RM 0.72 estimated waste
   exposure**. This is not observed waste or a verified saving.
6. Use **Confirmed preorders** and **Inventory evidence** illustrated stations
   to show the order, recipe requirements and batch eligibility. Show exclusions:
   18 older active orders still require payment/preparation review. They have not
   been silently counted as zero demand or rewritten to fit the example.
7. Switch Data source to **Genpact · evaluated model demo** for separate ML
   evidence. The same preserved illustrated interface runs the actual CatBoost
   artifact; metrics are **28.23% WAPE versus 34.81% previous-observation baseline**
   on weeks 136–145, excluded from model training through week 135. Lower WAPE
   means less total absolute error, not percentage classification accuracy.
   The staff `backtest/?center_id=13&week=136` route shows actual/predicted/baseline
   quantities for an already evaluated held-out week. Week 146 has no actual
   labels. The model does not beat the baseline in every individual slice.

## What changed and what remains a limitation

The existing dashboard branch was integrated through `4700f89`; its illustrated
Genpact assistant, navigation and fictional rescue exercises remain available.
Local planning is the main entry mode and uses a distinct schema/validator with
native units. Purchase comparison, financial worksheet, refresh, loading/error,
coverage, ingredient selection and the five-step journey are available.
The worksheet contains user assumptions, not causal promotion predictions.

One normal checkout order, one explicitly fictional payment reconciliation and
nine labelled batches were added through existing APIs. All 24 original orders
and all three original batch records were verified unchanged. No historical
sales import, repricing, stock deduction, model retraining or main-branch merge
was performed. The two weaker CatBoost experiments remain offline.

This is a connected **confirmed-order planning** demo plus a separate evaluated
forecasting demo. It is not a validated model of the owner's future customer
demand. A deployment and fictional records do not establish achieved savings,
food safety or real-business prediction accuracy. The dated demo order must
remain upcoming; after its dates pass, review it and prepare a new labelled case
rather than backdating history or fabricating fulfilled sales.

## Repeatable checks

With the existing isolated Django test configuration and verified ML bundle:

```bash
python backend/manage.py test myapp.test_local_planning myapp.test_local_scenario myapp.test_predictive myapp.test_predictive_backtest --noinput
cd frontend
npm run test:predictive
npm run build
```

Use only an isolated test database for Python tests. The cloud execution ran
these through the existing safe settings, with **24 Python tests passed** and
**33 frontend tests passed**; no skipped real-model test. The React build passed.
The full Chromium walkthrough passed against Django and React locally: all five
steps, real API purchase comparison, menu/stock navigation, empty coverage window,
error/retry, mobile without horizontal overflow and switching back to Genpact.
Hosted staff APIs separately verified the same case and unchanged stock after
the hypothetical purchase. The hosted HTML and JS artifacts are checked against
the tested build. Direct cloud Chromium navigation to the hosted HTTPS site
returned `net::ERR_CERT_AUTHORITY_INVALID` in the cloud proxy environment;
HTTPS verification was kept enabled, and a full hosted browser walkthrough must
therefore not be claimed. Standard verified HTTPS API/build checks succeeded.

To prepare a new explicitly fictional case against an existing reviewed catalogue,
provide staff bindings securely and first inspect the read-only plan:

```bash
python scripts/prepare_freshcast_demo.py --base-url https://preorder-freshness.vercel.app --output-dir /path/to/private-demo-receipts
```

Only for an authorized fictional test site, repeat with `--apply --fictional-demo`.
The helper uses an existing address, preserves a nonempty basket, creates labelled
demo stock without overwriting existing batches, uses an idempotent checkout
reference per day, and resumes a partially completed pending order. Receipts and
before-state are private and must stay outside Git. Local rehearsal requires
`--allow-local-http` and a loopback URL. The model and dataset provisioning
instructions remain in `deploy/VERCEL.md`; no artifacts belong in Git.
