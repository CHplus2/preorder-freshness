# Order-link screenshot replacements

These are actual browser captures of the corrected application running locally, using isolated example orders and the client's menu photos. They are not live production-data captures. Desktop captures use 1366 × 768; supplementary phone captures use 390 × 844. The payment receipt is a sample; no bank transfer was made.

Replace these existing report images manually:

| Report figure | Replacement file | Caption |
| --- | --- | --- |
| Figure 4.8 | Figure_4.8_Cancellation.png | Figure 4.8: Customer order card and cancellation confirmation. |
| Figure 4.15 | Figure_4.15_Owner_Orders.png | Figure 4.15: Owner order queue with filtering and receipt actions. |
| Figure 4.17 | Figure_4.17_Daily_Summary.png | Figure 4.17: Daily order summary for a date containing example orders. |

Figure 4.15 shows both Daily summary links without underlines. Figure 4.17 is included because the workspace navigation contains Daily summary. Figure 4.8 preserves the cancellation-confirmation state of the existing caption, using the corrected customer order page behind it.

Supplementary screenshots show the specific links more clearly:

- `My_Orders_Receipt_1366.png` and `My_Orders_Receipt_390.png`: View payment receipt on a current order.
- `My_Orders_Review_1366.png` and `My_Orders_Review_390.png`: Review Wanpaku Chicken Grilled on a received order, accessed through History.
- `Owner_Orders_390.png`: the owner queue on a phone.

The received Wanpaku order is a separate prepared example from the newly placed Chicken Grilled Salad order. The pending receipt upload was not marked paid for these captures. Changing how these links look does not alter review eligibility, receipt privacy, order status, payment verification or availability rules.

Use the original captions for the three numbered figures. The supplementary received-order screenshot is not a replacement for a caption describing cancellation. Figures 4.7 and 4.16 show different checkout/staff-payment links and are unaffected by this change; keep their existing corrected replacements.

The report Word/PDF is not rebuilt in this batch. Browser checks cover normal, hover and keyboard-focus states for the three link labels, on desktop and phone, plus navigation and absence of horizontal overflow. All controls retain visible keyboard focus and a minimum 44-pixel height. Details are in `Browser_Checks.json`.
