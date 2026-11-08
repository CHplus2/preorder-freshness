# Preorder and Freshness Management System

A web application for **Wrap & Bowl Kuch**, a home-based food business in Kuching, Sarawak. This is Christopher Hansen’s final-year project: *Web-Based Preorder and Freshness Management System for Home-Based Entrepreneurs*.

[Open the menu](https://preorder-freshness.vercel.app/menu) · [Presentation and demo](docs/fyp-presentation-20261108/README.md) · [Report](docs/fyp-report-20261107-final/README.md) · [Editable poster](docs/fyp-poster-handoff-20261108/README.md)

## Current FYP workflow

- **Customer accounts:** name and full phone number, with a saved passkey for account access. Kitchen staff use their own staff credentials.
- **Menu and suggestions:** client photos, categories, selling units, optional personalised suggestions, and a date/quantity/whole-order-budget finder with mixed-menu or one-menu alternatives.
- **Preorders:** offered dates, morning delivery/collection times and owner-managed delivery areas with their own fees. The client’s delivery window is 7:30–11:00 am; saved business settings determine what is offered.
- **Payments:** configured bank/QR evidence uploads for manual review. Delivery can also use cash; collection requires QR payment. A receipt upload is not automatic bank confirmation.
- **Ingredients and packaging:** received stock, documented shelf-life/storage records, earlier limits and holds. Successful order placement checks and deducts eligible ingredients and assigned packaging together.
- **Owner operations:** accepted order records, payment review, food-received confirmation, daily summaries, printable slips, sales and cost/contribution information.

The normal client workflow does not require cooking-planner approval or a courier API. An order’s accepted names, prices and requirements are retained so later menu edits do not rewrite its history. Recorded dates support stock planning; they do not detect contamination or guarantee food safety.

The development orders and stock used in demonstrations are example records, not proof of real client sales or achieved savings. Formal client/student evaluation is separate from software checks. The five original FYP objectives are unchanged.

## Technology and data

**React/Vite → Django REST API → PostgreSQL on Supabase.** Vercel hosts the application; Supabase holds the configured application database. Uploaded menu photos are persisted through the application’s photo service, separately from the Git source files. Private payment evidence is not a public source asset.

The FYP’s local history forecast is implemented in [kitchen_forecast.py](backend/myapp/services/kitchen_forecast.py). It reads database order history and compares local statistical methods when there is sufficient history; it does not load the separate Genpact CatBoost model. Forecasts based on development records do not establish real-business accuracy.

## Related FreshCast project — preserved separately

**FreshCast is the separate project associated with [integration/dormathon-demo](https://github.com/CHplus2/preorder-freshness/tree/integration/dormathon-demo).** That branch and its forecasting functionality are protected. This `main` README describes the FYP client system.

The original FreshCast trained model is saved in the GitHub Release [freshcast-model-backup-v1](https://github.com/CHplus2/preorder-freshness/releases/tag/freshcast-model-backup-v1), as `freshcast-runtime-bundle.tar.gz`. It is a release asset, not part of an ordinary source ZIP. Its archive SHA-256 is `697f8e10ee6b2c1b794ee38ec81067477870315fb7c51a1280684e7f0601361a`. Batch 1 downloaded and verified that archive and confirmed the model and matching data/metrics are present; no retraining was performed.

For restoration and inference paths, see [the model guide](backend/predictive_ai/README.md). Django loads the provisioned model file on the server for inference. Deployment configuration determines whether that bundle is present in a Vercel function; this documentation update does not verify the current live model deployment.

The retired escrow payment lab, checkout option and API routes have been removed from `main`. Earlier payment records remain readable, with safeguards against manual changes to test-network payments. Other legacy/demo functions are reviewed separately. See [the cleanup and model-preservation audit](docs/FYP-CLEANUP-AUDIT.md).

## Local development on Windows

Use Python 3.13, Node.js 24 and Git. Run from the **repository root** in PowerShell:

```powershell
py -3.13 -m venv backend/venv
.\backend\venv\Scripts\python.exe -m pip install -r requirements.txt
npm ci --prefix frontend

# Explicitly select a local development database, not hosted Supabase.
$env:PYTHON_DOTENV_DISABLED = '1'
$env:DATABASE_URL = 'sqlite:///dev.sqlite3'
$env:SECRET_KEY = (& .\backend\venv\Scripts\python.exe -c "import secrets; print(secrets.token_urlsafe(50))")
$env:DEBUG = 'True'
$env:VERCEL = '0'
$env:ALLOWED_HOSTS = 'localhost,127.0.0.1'
$env:PUBLIC_APP_URL = 'http://localhost:5173'
$env:PASSKEY_ORIGIN = 'http://localhost:5173'
.\backend\venv\Scripts\python.exe backend/manage.py migrate
.\backend\venv\Scripts\python.exe backend/manage.py createsuperuser
.\backend\venv\Scripts\python.exe backend/manage.py runserver 127.0.0.1:8000
```

In a second terminal at the repository root, run `npm --prefix frontend run dev` and open `http://localhost:5173`. Use that same hostname for passkeys. A new local database needs its own kitchen settings, menus and stock. Optional external services and the FreshCast ML bundle have separate setup requirements; never place their credentials in source code or the frontend.

Production migrations are an explicit release step. The build checks database readiness; it does not automatically apply migrations. Do not run tests, data-refresh scripts or development setup against the production database.

## Current presentation materials

The [presentation package](docs/fyp-presentation-20261108/README.md) contains a provisional ten-minute deck with the client-photo demo embedded near the end, speaker notes/script, a PDF, screenshot fallback and separate design slides for questions. The official speaking limit remains unconfirmed. The editing guide lists exact poster font settings and explains how to insert genuine evaluation results before final submission.

Generated reports, posters and presentation downloads are under `docs/` for access from GitHub; `.vercelignore` excludes them from application uploads. Their presence in Git is separate from the function’s runtime storage. Published downloads are preserved during cleanup.
