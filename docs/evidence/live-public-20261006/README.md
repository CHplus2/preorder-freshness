# Deployed public smoke check

6 October 2026. Browser checked https://preorder-freshness.vercel.app/menu without signing in or submitting orders, recommendations, messages or payments.

Observed:
- Dapur Kita branding; 20 menu items loaded, initially 12 visible with load-more available. No service-error banner observed.
- Searching Granola returned one item, Granola Bar.
- View ingredient storage records opened and focused the disclosure. It showed the Malaysia calculation date 2026-10-06 and distinguished recorded dates/holds from food-safety assurance.
- At 390 × 844, help launcher position was static in the footer and the document had no horizontal overflow. Open panel bounds were left 16, right 359.2, top 118.4, bottom 828. The new mobile layout is present on the deployed site.
- Help closed successfully; viewport restored and temporary tab closed. Screenshot: mobile-help.png.

Catalogue still uses sample items such as Mixed Nuts and Granola Bar. The separately prepared Dapur Kita replacement list has not been entered into production.

Scope limits: this is a public smoke check, not a full production release certification or exact deployment-SHA verification. Signed-in checkout, owner tools and production failure recovery were not tested. No production business records were modified. Opening the help panel performs its normal read-only availability request; no question was submitted.
