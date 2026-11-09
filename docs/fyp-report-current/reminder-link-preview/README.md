# Reminder link styling preview

The “View sending schedule in GitHub” and “Email setup guide” links now use the existing kitchen action-link style. The shared text-link rule excludes these action controls, so normal, hover and keyboard-focus states do not show an underline. Both retain keyboard-focus outlines and their original destinations.

The existing Figure 4.22 does not show these links: they are in the expanded Email settings & history section below its screenshot crop. Its image does not need replacement for this styling change. If you take a new screenshot that includes the expanded links, capture the updated deployed screen.

- [Laptop styling preview](Reminder_Links_1366.png)
- [Phone styling preview](Reminder_Links_390.png)
- [Download both previews](Reminder_Link_Preview.zip)

These are supplementary screenshots of the real application running locally with isolated example data. The local sending connection setting is present, but the empty local history is not the five-run production history supplied by the user. No reminder send was triggered. These images are not evidence of production sending and are not replacements for the user's Vercel reminder-status screenshot.

## Reading the history table

Each row is a check for reminders that are due, rather than one email. Completed means the check finished. Accepted counts messages the email service accepted for sending; Failed counts sending attempts that failed. A completed row with 0 accepted and 0 failed records no emails attempted in that check. It does not record a failed email send. For example, 2 accepted and 0 failed would record two provider acceptances, without proving that they arrived in an inbox.

The queue count belongs to the displayed status-refresh time. It does not establish the queue at an earlier recorded check. New phone-and-passkey accounts are not automatically subscribed to email, SMS or WhatsApp messages.

## Verification

The production frontend build and existing reminder-monitor regression test passed. The browser verified both requested links at 1366 × 768 and 390 × 844, including normal, hover and keyboard-focus states, retained destinations/new-tab attributes, visible focus outlines and no horizontal overflow or page errors. Browser_Checks.json records these checks. No backend, reminder logic, schedule, production settings, prediction model or trained artifact changed.

Source publication is separate from live Vercel deployment verification. The full report was not rebuilt for this change.
