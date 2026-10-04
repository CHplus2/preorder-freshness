# Browser verification — 5 October 2026 (Malaysia)

Manual developer verification using the Codex in-app browser against localhost:8023. Synthetic owner/customer accounts and orders only; dotenv disabled, explicit temporary SQLite database. Local migrations 0017/0018 applied. No production database, payment provider or email was used.

## Observed results

- Customer sign-in succeeded through the normal UI.
- Basket opened checkout with the saved synthetic address, price breakdown and cash-on-delivery selected.
- Missing delivery input produced a visible error explaining that a complete date/time is needed.
- Native datetime input needed a keyboard edit after automation fill to notify React; this is an automation limitation, not evidence of a normal typing defect. A completed request for 8 November 2026 at 15:00 displayed “Your requested time is available”.
- Placing the synthetic RM21 cash-on-delivery order created ORD-00002, emptied the basket and displayed My Orders. Payment remained **unpaid**. Its progress began at Order received. After another login and page load the order remained visible.
- Owner sign-in succeeded. Planner loaded. Settings loaded with separate cards and spaced controls in the narrow viewport (460px window; no document horizontal overflow observed on settings).
- Edit identity scrolled to the kitchen-name field and focused it; Edit contact details focused the delivery-area input. Smooth scrolling completed visibly.
- Saving a synthetic owner name displayed “Settings saved.” The value persisted across a new tab load.
- Review preparation steps opened the menu page with the correct review banner and contextual edit labels. Opening the editor at its target section was **not verified in this run**.
- Customer access to the owner settings page displayed “Admin access required”; settings fields were not shown. This checks the UI boundary, not a substitute for server authorization tests.

## Defect and recheck

A prior customer order-success notification reappeared after signing into the owner account. AuthProvider now clears the shared alert after successful login, signup and logout; failed authentication keeps error reporting. On the rebuilt frontend, saving settings produced a notification, signing out removed it, and signing in as the customer did not restore it. Signup-specific clearing was code-reviewed but not browser-exercised.

Validation: ESLint passed; Vite build passed after rerunning outside the sandbox (initial build failed to spawn its process with EPERM). Django startup system checks passed. No backend logic changed in this batch.

Screenshot: [customer order after re-login](customer-order.png), synthetic data only. Initial narrow-screen observations covered homepage, checkout, orders and settings; the saved screenshot is the subsequent wider view. This is not a comprehensive device/accessibility audit.

## Remaining validation

Browser failure injection/recovery, delivery amendments, all three editor anchors, seller fulfilment transitions, delivery-weekday conflicts, and representative participant evaluation remain pending. This developer walkthrough does not demonstrate conversion improvements, usability scores or full rubric marks.
