# Stage 7: owner order queue

All Orders now supports combined search, status, payment and Malaysia delivery-date filters, an overdue-only view, newest/earliest-delivery sorting, clear filters and explicit refresh. Search matches order IDs (including `ORD-00021`), customer usernames and menu names. Unscheduled orders sort last when sorting by delivery.

Overdue means the requested delivery time has passed while the recorded status is neither delivered nor cancelled. It is a prompt to review fulfilment, not proof that food was delivered late. The clock updates each minute; record changes still require refresh. Counts and filters operate on the loaded owner order list, not the administrator's personal orders. Filtering makes no database changes.

Verified: all 18 frontend utility tests passed, including four new order queue cases; production build and diff checks passed. Browser interaction remains unverified. No migration required. Server-side pagination remains a future scaling improvement.
