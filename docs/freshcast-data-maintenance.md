# FreshCast fictional-data preparation maintenance

This is an operator tool for owner-confirmed **fictional demo records only**. Normal builds and deployments never invoke it. It does not train a model, invent stock, rewrite recipes, create sales history, or move delivery/creation dates. Real payment/order corrections must use the normal verified order/payment workflow.

## Before applying to the intended database

Use the same PostgreSQL database and `DATABASE_SCHEMA` as the intended Vercel deployment, supplied privately through environment settings. The owner's read-only catalogue check identified the current app tables in **`django_app`**, not `public`; set `DATABASE_SCHEMA=django_app` for this deployment. Do not paste database URLs/passwords in chat or commit them. A local checkout without those settings does not have production data. An isolated maintenance process can use its own temporary SECRET_KEY; no production signing key is required by this command. A supplied URL does not establish network connectivity: the managed workspace's database connection failed, while the owner's local PowerShell session subsequently connected successfully.

Preview with the intended flags:

```sh
python backend/manage.py prepare_freshcast_demo --mark-demo-paid --complete-past-demo-orders
```

The preview makes no writes. Review the returned menu/order IDs, missing preparation templates, dates, requested changes and fingerprint. Fingerprint includes the database snapshot, source preparation templates and requested payment/completion flags. Preview without those two flags if only preparation steps/task plans are intended.

Apply the reviewed intent, using an existing staff actor and a new private backup path **outside the checkout**:

```sh
python backend/manage.py prepare_freshcast_demo --apply --confirm-fictional \
  --mark-demo-paid --complete-past-demo-orders \
  --expected-fingerprint FINGERPRINT_FROM_PREVIEW \
  --actor-id EXISTING_STAFF_ID --backup /private/backup/new-before.json
```

These are operator placeholders, not values to run unchanged. Confirmation flags do not establish that a production database is fictional; the owner must establish that before use. Configuration and source control alone do not execute the command.

## What it changes

- Matches current menu names to the 24 existing Dapur Kita guide templates. Fills **only missing** preparation tasks and relevant batch/timing fields; preserves already populated steps, lead hours, daily capacity and delivery weekdays. Timings remain guide assumptions requiring kitchen verification, not measured operating facts. Unknown names are not given generic steps.
- For future pending orders whose inventory has not been deducted, uses the existing kitchen scheduler with current menu preparation terms. It saves detailed tasks/preparation snapshots when scheduling succeeds. Existing reviewed detailed plans remain unchanged. It does not alter accepted ingredient recipes or menu/order prices.
- Only with `--mark-demo-paid`, records synthetic receipt events for missing amounts and marks eligible fictional orders paid. Events have source `fictional_demo`, a run-specific reference and an explicit no-money-captured note. No provider capture, wallet debit or customer notification occurs.
- Only with `--complete-past-demo-orders`, changes eligible already-past fictional orders to delivered. Past task times and delivery dates are **not** reconstructed. Historical orders do not become active kitchen reservations. Records whose creation is after delivery remain unresolved.
- Cancelled/refunded orders or orders with refund records are preserved. Missing dates, unknown menus, missing steps, invalid dates, overpayment and scheduler conflicts are reported, not forced through.

Before any apply, a new 0600 JSON backup stores the affected original preparation fields, order status/date/planning fields, item preparation snapshots and payment identifiers. Each changed order receives an `OrderAmendment` with before/after evidence. Report includes maintenance run ID and created synthetic payment IDs. Store the private backup durably; source control or rolling back a deployment does not undo database edits. Restoration must compare that run's backup/audit and synthetic event IDs rather than deleting unrelated subsequent records.

`partial_review_needed` explicitly means unresolved records remain. For example, an explicitly requested demo payment correction may succeed while its future schedule cannot be generated. The command reports that partial result. It never claims to have planned every order.

## Forecast meaning

Paying a future order supports confirmed stock planning; it is not a completed historical sale. Per-menu local sales use paid, delivered records with eligible historical dates. Missing delivery dates remain unresolved by this tool, while the existing reporting forecast's fallback behavior stays separately labeled. Old/out-of-window data, insufficient history, missing recipes or missing stock can still prevent useful expiry recommendations after maintenance. No forecast quality or real-world accuracy is established by editing fictional records.

## This batch's access limit

At preparation time the cloud workspace had no DATABASE_URL and no configured authenticated production browser/database session. The tool was exercised only on isolated synthetic test databases. The user's live “18 menus / 22 task plans” counts are not verified or changed until the intended database can be inspected and the fictional-data classification is settled.

## Owner-reported local run and unresolved schedules

The owner subsequently confirmed all affected orders are fictional, connected locally to `django_app`, and ran the maintenance command. Local read-only checks showed 19 archived grocery products and 24 active kitchen menus. All 24 active menus already had preparation steps. Archived products are retained for historical references. The owner reported a partial apply result and subsequently verified orders 28 and 29 were paid. Those two orders still lacked feasible task plans. This is user-reported local evidence, not independent access from the cloud workspace.

Both deliveries were around 09:00, while the storefront had a 90-minute delivery buffer and kitchen hours starting at 08:00. Their menus had zero early-finish allowances. A temporary, unsaved test at 15:00 with a hypothetical 120-minute allowance passed for order 29 and failed for the five-menu order 28. Those hypothetical changes must not be described as saved or as verified food-holding policy.

`reschedule_freshcast_demo` can preview a **single paid pending fictional order** at an explicit timezone-aware delivery time using the original preparation/holding rules. It never changes menu policy, prices, payment status, recipes or stock. It refuses refunded, nonpending or stock-deducted orders. A successful apply saves only that order's delivery/task plan and item preparation snapshots, creates an `OrderAmendment`, and requires an exclusive private before-backup outside the checkout. A fingerprint covers the requested order/date, original database snapshot, storefront settings and kitchen blocks; changes require a fresh preview. Availability is recalculated at apply. If no schedule fits, no write occurs.

For the owner's existing PowerShell session (database variables and virtual environment already configured), exit the Django shell and update the checkout first. Preview the proposed **fictional order 29** change without the earlier hypothetical holding allowance:

```powershell
git pull --ff-only origin main
$preview = python backend/manage.py reschedule_freshcast_demo --order-id 29 --delivery-at "2027-01-13T15:00:00+08:00" | ConvertFrom-Json
$preview | Format-List
```

Only if there are no errors and `ready` is `True`, apply the exact reviewed intent with the owner's verified staff ID 2:

```powershell
New-Item -ItemType Directory -Force "$HOME\FreshCast-backups" | Out-Null
$backup = "$HOME\FreshCast-backups\before-order29-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
python backend/manage.py reschedule_freshcast_demo --order-id 29 --delivery-at "2027-01-13T15:00:00+08:00" --apply --confirm-fictional --expected-fingerprint $preview.fingerprint --actor-id 2 --backup $backup
```

This is an explicit demo rebooking, not a change to observed sales dates or a model prediction. Order 28 remains for manual planning review. More hours alone do not resolve mutually incompatible finish times and step gaps across five menus; do not silently broaden holding limits, fabricate resources, split charged orders or mark a missing plan as valid.
