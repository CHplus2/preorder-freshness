# Payment and checkout screenshot replacements — 9 November 2026

These are actual browser captures of the corrected application running locally with isolated example records and the client's menu photographs. They are not live Vercel or production-data screenshots. Payment proof and the QR placeholder are illustrative; no bank transfer was made. Laptop captures use 1366 × 768. The additional phone guidance view uses 390 × 844.

## Replace existing figures

| Figure | Replacement image | Keep this caption |
| --- | --- | --- |
| 4.6 | [Figure_4.6_Checkout_Time.png](Figure_4.6_Checkout_Time.png) | Checkout date guidance, morning time and stock-availability result. |
| 4.7 | [Figure_4.7_Checkout_Payment.png](Figure_4.7_Checkout_Payment.png) | Payment section with an uploaded illustrative receipt. |
| 4.16 | [Figure_4.16_Payment_Review.png](Figure_4.16_Payment_Review.png) | Reviewing payment details separately from food receipt. |

The existing report's Figure 4.6 shows a valid time, rather than the out-of-range error. Its replacement reflects the adjusted time-field layout. Figure 4.7 retains its uploaded-receipt state. The supplementary screens below show the guidance and error states; they do not replace a caption describing an uploaded receipt.

## Additional states

- [Checkout_Time_Validation.png](Checkout_Time_Validation.png): an out-of-range time with an inline error below the time field, without the coloured callout box. Suggested caption if adding a new figure: “Inline validation for a time outside the kitchen’s delivery hours.”
- [Checkout_Payment_Guidance_1366.png](Checkout_Payment_Guidance_1366.png): payment guidance before choosing the delivery area/date/time, with a consistent 20-pixel gap below the payment choices.
- [Checkout_Payment_Guidance_390.png](Checkout_Payment_Guidance_390.png): the same guidance on a phone-sized viewport.

Use Word's Change Picture function to preserve each figure's existing position and caption. Keep the image aspect ratio. These files are provided for manual replacement; the published full Word/PDF and earlier complete report ZIP were not rebuilt for this screenshot-only request.

## Application changes and validation

- Open payment proof no longer has a text underline in normal, hover or keyboard-focus states. The link still opens the authorised proof in another tab and retains a visible keyboard-focus outline.
- Payment hints have a 20-pixel top gap and no extra bottom margin within the payment section.
- Simple-mode time-range errors appear directly under the time field, with an accessible description and the permitted hours beside the control.
- A valid date/time is retained when changing delivery area in the current simple ordering mode. Fees and availability are checked again; it is not a reservation or a bypass of stock checks. Switching delivery/collection still clears the timing choice. The scheduled workflow is unchanged.
- Actual local browser verification changed Kuching to Samarahan, retained 08:30, confirmed the total changed from RM 21 to RM 23, and retained the time after reload. Returning to Kuching confirmed RM 21 again.
- Report/payment and checkout regression groups, production build and ESLint passed. Laptop/phone browser checks found no horizontal overflow or page errors. This does not establish a verified live Vercel deployment.
- No backend, inventory policy, forecasting model or trained artifact changed.

Browser_Checks.json records the measured spacing, link states and scenario results.
