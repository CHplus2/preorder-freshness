# Menu notifications — 5 October 2026

Isolated local synthetic owner account and SQLite fixture only.

Existing behaviour: success/info notifications expire after five seconds; errors intentionally persist. Menu validation also rendered the shared error inside the dialog, duplicating the floating notification behind it.

Changes: floating notifications are hidden while a native dialog is open; form errors remain inside with Dismiss. Newly raised errors scroll into view and receive focus. Closing a dialog clears shared error state but preserves success notifications. Required menu fields are named in the error. Shared form, inventory, checkout, availability and floating error styles use neutral backgrounds with a restrained red accent. Errors still use text and accessible alert semantics.

Browser checks: empty Add produced an inline dismissible error and no visible floating notification; Dismiss removed it. Creating Synthetic notification check with price RM12 and Lunch boxes category closed the dialog and created the menu. No success notification remained at the later observation, consistent with the existing five-second timer. Rebuilt with focus handling: empty Add focused the alert containing the specific missing fields. [Screenshot](form-error.png).

ESLint and production build passed. Other error surfaces received shared CSS changes and source review, not individual fault-injection tests in this batch. No real payments, emails, production writes or migrations.
