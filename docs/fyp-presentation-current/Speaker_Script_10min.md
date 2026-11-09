# FYP presentation script — provisional ten minutes

Eight minutes of explanation, followed by a two-minute demo. Questions are outside the ten-minute draft. The lecturer has not confirmed the final limit.

## 1. Web-Based Preorder and Freshness Management System for Home-Based Entrepreneurs — 20 seconds

Good morning. I am Christopher Hansen. My project is a web-based preorder and freshness management system for home-based food entrepreneurs. The case-study business is Wrap and Bowl Kuch in Kuching. I will explain the problem, solution and mechanism, then the main functions and evaluation. I will finish with a two-minute demonstration.

## 2. Problem statement — 40 seconds

This project addresses the gaps described in the report’s background and platform review. An order may begin in a conversation, while ingredient records and sales information are kept elsewhere. The kitchen needs to know whether recorded stock can cover the requested date, and customers need clear prices, delivery choices and order details. A dedicated storefront also gives one business control of its own menu and identity. Food-safety concerns motivate better records, but the website does not detect contamination or certify that food is safe.

## 3. Project objectives — 40 seconds

The five objectives cover date-based preordering, ingredient shelf-life records, a personalised storefront, sales analytics and menu recommendations. The complete original statements are shown here. The implemented functions address those objectives at a software level. The fifth objective also mentions reduced decision fatigue and improved purchase conversion. Those are user and business outcomes that still require suitable evaluation; they cannot be established simply by demonstrating a recommendation or counting passing tests.

## 4. Client requirements — 35 seconds

The application was developed in stages and refined through client feedback. The client asked for packaging records, immediate stock deductions, simpler customer details, morning delivery, payment evidence and printing. The normal workflow therefore uses offered ordering dates and handover times without requiring detailed cooking-plan steps. The website records the accepted order and its stock requirements. Bank verification, customer conversations and the actual delivery arrangement still depend on the kitchen’s work outside the website.

## 5. Order processing — 60 seconds

The React interface gathers the choices, Django applies the business rules, and PostgreSQL stores the records. The server checks the actual basket, offered date, service hours, delivery fee, ingredients and packaging. An order can use only recorded batches that are eligible on the selected date. The system does not assume that the owner will restock later. Saving an order and deducting stock form one transaction. Accepted names, prices and requirements are retained so later edits do not rewrite the order. Payment review and confirmation of food receipt remain separate actions.

## 6. Menu choices — 40 seconds

The storefront uses the client’s menu photographs, prices and descriptions of each selling unit. Customers can browse normally and put food into a basket before signing in. The optional finder uses the chosen date, total quantity and whole-order budget. It can propose a mix or a repeated menu type. A proposed option is still subject to the actual date, stock and total checks at checkout. This feature provides choices; it is not evidence by itself that customers feel less decision fatigue or complete more purchases.

## 7. Checkout and account access — 50 seconds

Continuing from the basket opens customer account access. Registration uses a name, full phone number and passkey, without a separate memorised website password or required email. Checkout shows permitted dates, service hours and the applicable area fee. Changing the delivery area keeps a valid selected time and checks fees and availability again. The kitchen’s receiving QR is shown after the total is confirmed. Uploading a receipt attaches evidence; it does not mark the payment as verified. Delivery also supports cash where configured, while collection requires QR payment evidence.

## 8. Ingredient dates and packaging — 50 seconds

The owner can enter a printed expiry date or calculate a planning deadline from a received or manufacture date and documented shelf life. The selected reference must match the ingredient and storage conditions. Earlier printed, opened or thawed limits can shorten the deadline, and held batches are excluded. An accepted order deducts its recorded ingredients and assigned packaging together. In this controlled demonstration, one meal uses one hundred and thirty grams of chicken and one salad bowl. These records guide allocation; handling and actual food safety still require owner judgment.

## 9. Payment and food receipt — 40 seconds

An uploaded image and a completed handover are different facts. The owner checks bank records or cash before recording payment, and confirms food received after actual delivery or collection. The order queue keeps those records separate. Customers can cancel eligible orders and contact the kitchen, while a time change must remain eligible under the recorded allocation rules. A cancellation does not automatically refund money or return ingredients to stock. The owner must review those actions separately so that a status change does not imply an event that never happened.

## 10. Daily orders and sales — 35 seconds

The daily summary helps the owner prepare and hand over orders for a date. Print all opens every matching slip as one print set, including records beyond a list page. Sales and cost views answer a different question: they apply their stated payment, receipt and cost rules. A contribution estimate is not automatically net profit, and an unknown ingredient or packaging cost is not treated as zero. The demonstration uses example records, so these amounts are functional examples rather than measurements of the client’s real trading results.

## 11. Verification and evaluation — 50 seconds

The recorded backend run on the ninth of November passed one thousand and forty-nine tests without skips. Subsequent interface changes were checked separately through relevant regressions and browser interactions. Representative cases cover valid and invalid dates, totals, stock deductions, access, payment evidence and selected simultaneous requests. These automated results support the behaviour that was tested. They do not supply client opinions or participant survey answers. The report includes decision tables, behavioural procedures and editable client and survey result templates. Genuine observations must complete those human-evaluation sections.

## 12. Contribution and limits — 20 seconds

The implemented website connects the five objectives through one kitchen’s ordering and records. It keeps the boundaries clear: date records support planning, payment needs verification, and actual handover needs confirmation. Formal user findings remain pending. I will now show the two-minute customer-to-kitchen workflow.

## 13. System demonstration — 120 seconds

Play the embedded two-minute demonstration. The recording uses the current application with isolated example records and the kitchen’s supplied menu photographs and receiving QR. The receipt is a sample, and no real bank transfer or customer transaction was made. The matching standalone MP4 is supplied in case this presentation software cannot play the embedded video.

## 14. Questions — after the timed talk

Use the separate design backup slides for questions about use cases, the class model and the order-placement sequence. Refer to the report and genuine evaluation records for further detail.
