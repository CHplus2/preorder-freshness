# Dapur Kita: manual replacement catalogue

Prepared 3 October 2026. 24 proposed products for one Malaysian home kitchen: everyday rice meals, noodles and preorder bakes. Prices, purchase costs, quantities and timings below are planning assumptions, not supplier quotes or tested recipes. Trial yields and timed production before live acceptance. No existing records have been changed.

## Full catalogue index

1. Nasi Lemak Telur — RM 7.50
2. Nasi Ayam Kunyit — RM 12.00
3. Nasi Ayam Kicap — RM 12.50
4. Bihun Goreng Telur — RM 8.50
5. Fudgy Brownies - Box of 6 — RM 15.00
6. Nasi Goreng Kampung — RM 9.00
7. Nasi Goreng Ayam — RM 11.00
8. Nasi Goreng Telur — RM 8.00
9. Bihun Goreng Ayam — RM 10.50
10. Bihun Goreng Sayur — RM 7.50
11. Mee Goreng Telur — RM 9.00
12. Mee Goreng Ayam — RM 11.00
13. Kuey Teow Goreng Telur — RM 9.00
14. Nasi Ayam Halia — RM 12.50
15. Nasi Ayam Sambal — RM 12.50
16. Nasi Ayam Black Pepper — RM 13.00
17. Nasi Ayam Masak Lemak — RM 13.00
18. Nasi Telur Kicap — RM 8.50
19. Nasi Lemak Ayam Kunyit — RM 14.00
20. Nasi Lemak Ayam Sambal — RM 14.50
21. Nasi Lemak Ayam Kicap — RM 14.50
22. Walnut Brownies - Box of 6 — RM 18.00
23. Chocolate Chip Cookies - Pack of 6 — RM 10.00
24. Banana Cake - Box of 4 Slices — RM 12.00

The expanded catalogue contains 24 menus, 35 raw materials and 35 stock templates. The illustrative full stock basket totals RM 350.05. All 24 step lists and ingredient references were validated; all 48 individual one/two-batch empty-kitchen scheduling scenarios passed. This is not a combined-capacity test or a measured kitchen trial. Additional menu entries and six additional raw materials appear after the original entry guide.

## Enter in this order

1. Create categories Rice meals, Noodles and Bakes.
2. Create the raw materials below; keep the stated units consistent. Set their estimated costs in Sales > Costs, wastage and pricing if the raw-material form does not expose cost.
3. Add each menu and its per-selling-unit ingredient quantities, then preparation steps.
4. Add only inventory you physically hold. Complete real receipt dates, supplier evidence and expiry guidance. The stock quantities below are a starter purchase scenario, not a stock-count declaration.
5. Preview sample orders before opening sales. Keep earlier orders and their accepted recipes; do not delete order history or rename an unrelated old ingredient to reuse its ID. Create new menu objects where appropriate. Old menu removal may be protected by historical records.

## Shared setup and important entry rules

- Suggested test kitchen hours: 08:00-18:00; delivery/travel buffer: 60 minutes. These are planning choices, not business facts. Afternoon deliveries are easier for the complete rice workflows.
- Menu advance notice: 24 hours. Maximum preparation span: 1 day. Maximum early finish: 0 minutes for this conservative starting configuration. This does not verify cooked-food holding conditions or guarantee same-day preparation. The delivery buffer is still a holding/transit interval that your actual handling process must support.
- Every listed preparation step uses additional-batch minutes equal to its first-batch minutes; allowed wait is 0; overnight is No; independent batches is Off. This deliberately conservative combined model scales linearly. A partial extra batch takes full extra time. Do not set extra minutes to zero merely to make availability pass.
- Per-menu capacities below are ceilings, not additive whole-kitchen capacity. The scheduler also checks its one-worker/one-unit-per-equipment model. Separate orders do not share rice or cooking batches.
- Sequences are conservative planning estimates, not cooking instructions. Rice sequences assume controlled holding while the stove step completes; trial this process and equipment before enabling orders. Hands-on steps reserve only one named equipment resource: auxiliary scales, knife, bowl and sink are not separately modelled.
- Recipes use raw ingredient weights per sold unit, before cooking. Chicken means usable trimmed boneless weight. Adjust purchasing cost for trim loss. Oil is an allocated ingredient amount, not a deep-fryer fill quantity. Water is a utility, not tracked purchased stock here.
- Brownie quantities are per box of six, not per brownie. Four boxes means 24 pieces and two eggs. Fractional egg usage is recipe accounting; prepare full batches and verify actual yield.
- Image URL and social URL: leave blank until you have your own relevant photo/post. Allergen notes belong in Description (there is no separate structured allergen field). Do not claim halal certification or allergen-free status from this dataset.

## Menus

### Nasi Lemak Telur

- Category: Rice meals; price: RM 7.50; packaging: RM 0.70 per sold unit.
- Description: One box of coconut rice with sambal, one boiled egg, cucumber, roasted peanuts and anchovies. Allergen information: Egg, peanut and fish. Check chilli paste and cross-contact.
- Portions per batch: 5; maximum portions delivered per day: 15. For brownies, a portion means a six-piece box.
- Advance notice: 24 h; maximum span: 1 day; early finish: 0 min; independent batches: Off.
- Basic fallback fields (unused when detailed steps exist): first-batch cooking 90 min; extra-batch cooking 90 min; packing 2 min per sold unit.
- Estimated ingredient + packaging cost: RM 3.06; price less those costs: RM 4.44. Not profit: labour, utilities, delivery, discounts, wastage and fees are excluded.

Ingredients per sold unit:

- Rice: 90.000 g
- Coconut milk UHT: 35.000 ml
- Egg: 1.000 unit
- Cucumber: 30.000 g
- Roasted peanuts: 10.000 g
- Dried anchovies: 8.000 g
- Onion: 25.000 g
- Garlic: 3.000 g
- Chilli paste plain: 15.000 g
- Tamarind paste: 2.000 g
- Sugar: 5.000 g
- Salt: 1.500 g
- Cooking oil: 12.000 ml
- Pandan leaf: 1.000 g

Preparation steps, in order (duration / equipment / worker throughout):

1. Weigh, wash and prepare ingredients: 20 min / prep_table / Yes. Extra batch: 20 min; allowed wait: 0; overnight: No.
2. Load coconut rice into cooker: 5 min / rice_cooker / Yes. Extra batch: 5 min; allowed wait: 0; overnight: No.
3. Cook coconut rice: 30 min / rice_cooker / No. Extra batch: 30 min; allowed wait: 0; overnight: No.
4. Prepare sambal, boil eggs and fry anchovies: 35 min / stove / Yes. Extra batch: 35 min; allowed wait: 0; overnight: No.
5. Portion, label and pack: 10 min / packing_area / Yes. Extra batch: 10 min; allowed wait: 0; overnight: No.

One-batch step total: 100 min; hands-on: 70 min.

### Nasi Ayam Kunyit

- Category: Rice meals; price: RM 12.00; packaging: RM 0.70 per sold unit.
- Description: One box of white rice, turmeric chicken, long beans and carrots. Allergen information: No major allergen intentionally added in this proposed recipe; not an allergen-free claim. Check ingredient brands and shared equipment.
- Portions per batch: 5; maximum portions delivered per day: 15. For brownies, a portion means a six-piece box.
- Advance notice: 24 h; maximum span: 1 day; early finish: 0 min; independent batches: Off.
- Basic fallback fields (unused when detailed steps exist): first-batch cooking 90 min; extra-batch cooking 90 min; packing 2 min per sold unit.
- Estimated ingredient + packaging cost: RM 5.45; price less those costs: RM 6.55. Not profit: labour, utilities, delivery, discounts, wastage and fees are excluded.

Ingredients per sold unit:

- Rice: 90.000 g
- Chicken boneless trimmed: 180.000 g
- Onion: 25.000 g
- Garlic: 5.000 g
- Turmeric powder: 2.000 g
- Long bean: 40.000 g
- Carrot: 30.000 g
- Salt: 2.000 g
- Cooking oil: 18.000 ml

Preparation steps, in order (duration / equipment / worker throughout):

1. Weigh, wash and cut ingredients: 25 min / prep_table / Yes. Extra batch: 25 min; allowed wait: 0; overnight: No.
2. Load rice cooker: 5 min / rice_cooker / Yes. Extra batch: 5 min; allowed wait: 0; overnight: No.
3. Cook rice: 30 min / rice_cooker / No. Extra batch: 30 min; allowed wait: 0; overnight: No.
4. Cook turmeric chicken and vegetables: 30 min / stove / Yes. Extra batch: 30 min; allowed wait: 0; overnight: No.
5. Portion, label and pack: 10 min / packing_area / Yes. Extra batch: 10 min; allowed wait: 0; overnight: No.

One-batch step total: 100 min; hands-on: 70 min.

### Nasi Ayam Kicap

- Category: Rice meals; price: RM 12.50; packaging: RM 0.70 per sold unit.
- Description: One box of white rice and ginger soy chicken with carrots and cucumber. Allergen information: Soy, usually wheat, and mollusc from oyster sauce; verify actual brands.
- Portions per batch: 5; maximum portions delivered per day: 15. For brownies, a portion means a six-piece box.
- Advance notice: 24 h; maximum span: 1 day; early finish: 0 min; independent batches: Off.
- Basic fallback fields (unused when detailed steps exist): first-batch cooking 95 min; extra-batch cooking 95 min; packing 2 min per sold unit.
- Estimated ingredient + packaging cost: RM 5.62; price less those costs: RM 6.88. Not profit: labour, utilities, delivery, discounts, wastage and fees are excluded.

Ingredients per sold unit:

- Rice: 90.000 g
- Chicken boneless trimmed: 180.000 g
- Onion: 30.000 g
- Garlic: 5.000 g
- Ginger: 8.000 g
- Sweet soy sauce: 20.000 ml
- Oyster sauce: 8.000 ml
- Black pepper: 0.500 g
- Carrot: 40.000 g
- Cucumber: 30.000 g
- Sugar: 3.000 g
- Salt: 0.500 g
- Cooking oil: 12.000 ml

Preparation steps, in order (duration / equipment / worker throughout):

1. Weigh, wash and cut ingredients: 25 min / prep_table / Yes. Extra batch: 25 min; allowed wait: 0; overnight: No.
2. Load rice cooker: 5 min / rice_cooker / Yes. Extra batch: 5 min; allowed wait: 0; overnight: No.
3. Cook rice: 30 min / rice_cooker / No. Extra batch: 30 min; allowed wait: 0; overnight: No.
4. Cook and finish chicken and vegetables: 35 min / stove / Yes. Extra batch: 35 min; allowed wait: 0; overnight: No.
5. Portion, label and pack: 10 min / packing_area / Yes. Extra batch: 10 min; allowed wait: 0; overnight: No.

One-batch step total: 105 min; hands-on: 75 min.

### Bihun Goreng Telur

- Category: Noodles; price: RM 8.50; packaging: RM 0.70 per sold unit.
- Description: One box of stir-fried rice vermicelli with egg, cabbage and carrot. Allergen information: Egg, soy, usually wheat, and mollusc from oyster sauce; verify actual brands.
- Portions per batch: 4; maximum portions delivered per day: 12. For brownies, a portion means a six-piece box.
- Advance notice: 24 h; maximum span: 1 day; early finish: 0 min; independent batches: Off.
- Basic fallback fields (unused when detailed steps exist): first-batch cooking 45 min; extra-batch cooking 45 min; packing 2 min per sold unit.
- Estimated ingredient + packaging cost: RM 2.74; price less those costs: RM 5.76. Not profit: labour, utilities, delivery, discounts, wastage and fees are excluded.

Ingredients per sold unit:

- Dried rice vermicelli: 90.000 g
- Egg: 1.000 unit
- Cabbage: 60.000 g
- Carrot: 30.000 g
- Onion: 25.000 g
- Garlic: 5.000 g
- Sweet soy sauce: 12.000 ml
- Oyster sauce: 5.000 ml
- Chilli paste plain: 8.000 g
- Salt: 1.000 g
- Cooking oil: 15.000 ml

Preparation steps, in order (duration / equipment / worker throughout):

1. Weigh, cut vegetables and soak noodles: 20 min / prep_table / Yes. Extra batch: 20 min; allowed wait: 0; overnight: No.
2. Stir-fry noodles, egg and vegetables: 25 min / stove / Yes. Extra batch: 25 min; allowed wait: 0; overnight: No.
3. Portion, label and pack: 10 min / packing_area / Yes. Extra batch: 10 min; allowed wait: 0; overnight: No.

One-batch step total: 55 min; hands-on: 55 min.

### Fudgy Brownies - Box of 6

- Category: Bakes; price: RM 15.00; packaging: RM 1.20 per sold unit.
- Description: Six small fudgy chocolate brownie squares, approximately 30-35 g each after baking. One ordered unit is one box. Allergen information: Wheat, milk, egg and possibly soy in chocolate; check nut cross-contact.
- Portions per batch: 4; maximum portions delivered per day: 8. For brownies, a portion means a six-piece box.
- Advance notice: 24 h; maximum span: 1 day; early finish: 0 min; independent batches: Off.
- Basic fallback fields (unused when detailed steps exist): first-batch cooking 150 min; extra-batch cooking 150 min; packing 2 min per sold unit.
- Estimated ingredient + packaging cost: RM 5.00; price less those costs: RM 10.00. Not profit: labour, utilities, delivery, discounts, wastage and fees are excluded.

Ingredients per sold unit:

- Plain flour: 30.000 g
- Butter: 35.000 g
- Dark cooking chocolate: 50.000 g
- Cocoa powder: 8.000 g
- Sugar: 55.000 g
- Egg: 0.500 unit
- Vanilla extract: 1.000 ml
- Salt: 0.300 g

Preparation steps, in order (duration / equipment / worker throughout):

1. Weigh, melt chocolate and mix batter: 25 min / prep_table / Yes. Extra batch: 25 min; allowed wait: 0; overnight: No.
2. Preheat oven, line pan and load batter: 15 min / oven / Yes. Extra batch: 15 min; allowed wait: 0; overnight: No.
3. Bake brownies: 30 min / oven / No. Extra batch: 30 min; allowed wait: 0; overnight: No.
4. Unload and check bake: 5 min / oven / Yes. Extra batch: 5 min; allowed wait: 0; overnight: No.
5. Cool on a clean rack: 75 min / none / No. Extra batch: 75 min; allowed wait: 0; overnight: No.
6. Cut, check yield and box: 15 min / packing_area / Yes. Extra batch: 15 min; allowed wait: 0; overnight: No.

One-batch step total: 165 min; hands-on: 60 min.

## Raw materials and proposed starting inventory

Each entry gives the raw-material unit, estimated cost per that unit, and one proposed inventory quantity. Use the same unit for recipe, stock and cost. Stock-batch actual cost must come from the receipt; the suggested cost is only for planning. Supplier names and real dates are intentionally not invented.

### Rice

- Unit: g; estimated unit cost: RM 0.004000 per g.
- Proposed starting quantity: 5000.000 g; batch code: DK-START-01 (replace or suffix for each separate purchase).
- Storage starting choice: ambient; suggested location: Dry store - labelled sealed container. Follow the actual product instructions, especially after opening.
- Source: packaged; suggested expiry basis: actual printed label date. See the mandatory batch fields below.

### Coconut milk UHT

- Unit: ml; estimated unit cost: RM 0.012000 per ml.
- Proposed starting quantity: 1000.000 ml; batch code: DK-START-02 (replace or suffix for each separate purchase).
- Storage starting choice: ambient; suggested location: Dry store - labelled sealed container. Follow the actual product instructions, especially after opening.
- Source: packaged; suggested expiry basis: actual printed label date. See the mandatory batch fields below.

### Egg

- Unit: unit; estimated unit cost: RM 0.500000 per unit.
- Proposed starting quantity: 60.000 unit; batch code: DK-START-03 (replace or suffix for each separate purchase).
- Storage starting choice: ambient; suggested location: Dry store - labelled sealed container. Follow the actual product instructions, especially after opening.
- Source: packaged; suggested expiry basis: actual printed label date. See the mandatory batch fields below.

### Cucumber

- Unit: g; estimated unit cost: RM 0.004000 per g.
- Proposed starting quantity: 1000.000 g; batch code: DK-START-04 (replace or suffix for each separate purchase).
- Storage starting choice: chilled; suggested location: Fridge - segregated covered container. Follow the actual product instructions, especially after opening.
- Source: market; suggested expiry basis: receipt + documented storage life, only if supported by supplier guidance. See the mandatory batch fields below.

### Roasted peanuts

- Unit: g; estimated unit cost: RM 0.012000 per g.
- Proposed starting quantity: 250.000 g; batch code: DK-START-05 (replace or suffix for each separate purchase).
- Storage starting choice: ambient; suggested location: Dry store - labelled sealed container. Follow the actual product instructions, especially after opening.
- Source: packaged; suggested expiry basis: actual printed label date. See the mandatory batch fields below.

### Dried anchovies

- Unit: g; estimated unit cost: RM 0.045000 per g.
- Proposed starting quantity: 250.000 g; batch code: DK-START-06 (replace or suffix for each separate purchase).
- Storage starting choice: ambient; suggested location: Dry store - labelled sealed container. Follow the actual product instructions, especially after opening.
- Source: packaged; suggested expiry basis: actual printed label date. See the mandatory batch fields below.

### Onion

- Unit: g; estimated unit cost: RM 0.005000 per g.
- Proposed starting quantity: 2000.000 g; batch code: DK-START-07 (replace or suffix for each separate purchase).
- Storage starting choice: ambient; suggested location: Dry store - labelled sealed container. Follow the actual product instructions, especially after opening.
- Source: market; suggested expiry basis: receipt + documented storage life, only if supported by supplier guidance. See the mandatory batch fields below.

### Garlic

- Unit: g; estimated unit cost: RM 0.009000 per g.
- Proposed starting quantity: 500.000 g; batch code: DK-START-08 (replace or suffix for each separate purchase).
- Storage starting choice: ambient; suggested location: Dry store - labelled sealed container. Follow the actual product instructions, especially after opening.
- Source: market; suggested expiry basis: receipt + documented storage life, only if supported by supplier guidance. See the mandatory batch fields below.

### Chilli paste plain

- Unit: g; estimated unit cost: RM 0.012000 per g.
- Proposed starting quantity: 500.000 g; batch code: DK-START-09 (replace or suffix for each separate purchase).
- Storage starting choice: chilled; suggested location: Fridge - segregated covered container. Follow the actual product instructions, especially after opening.
- Source: packaged; suggested expiry basis: actual printed label date. See the mandatory batch fields below.

### Tamarind paste

- Unit: g; estimated unit cost: RM 0.015000 per g.
- Proposed starting quantity: 100.000 g; batch code: DK-START-10 (replace or suffix for each separate purchase).
- Storage starting choice: ambient; suggested location: Dry store - labelled sealed container. Follow the actual product instructions, especially after opening.
- Source: packaged; suggested expiry basis: actual printed label date. See the mandatory batch fields below.

### Sugar

- Unit: g; estimated unit cost: RM 0.003000 per g.
- Proposed starting quantity: 1000.000 g; batch code: DK-START-11 (replace or suffix for each separate purchase).
- Storage starting choice: ambient; suggested location: Dry store - labelled sealed container. Follow the actual product instructions, especially after opening.
- Source: packaged; suggested expiry basis: actual printed label date. See the mandatory batch fields below.

### Salt

- Unit: g; estimated unit cost: RM 0.002000 per g.
- Proposed starting quantity: 500.000 g; batch code: DK-START-12 (replace or suffix for each separate purchase).
- Storage starting choice: ambient; suggested location: Dry store - labelled sealed container. Follow the actual product instructions, especially after opening.
- Source: packaged; suggested expiry basis: actual printed label date. See the mandatory batch fields below.

### Cooking oil

- Unit: ml; estimated unit cost: RM 0.007000 per ml.
- Proposed starting quantity: 2000.000 ml; batch code: DK-START-13 (replace or suffix for each separate purchase).
- Storage starting choice: ambient; suggested location: Dry store - labelled sealed container. Follow the actual product instructions, especially after opening.
- Source: packaged; suggested expiry basis: actual printed label date. See the mandatory batch fields below.

### Pandan leaf

- Unit: g; estimated unit cost: RM 0.012000 per g.
- Proposed starting quantity: 50.000 g; batch code: DK-START-14 (replace or suffix for each separate purchase).
- Storage starting choice: chilled; suggested location: Fridge - segregated covered container. Follow the actual product instructions, especially after opening.
- Source: market; suggested expiry basis: receipt + documented storage life, only if supported by supplier guidance. See the mandatory batch fields below.

### Chicken boneless trimmed

- Unit: g; estimated unit cost: RM 0.020000 per g.
- Proposed starting quantity: 4000.000 g; batch code: DK-START-15 (replace or suffix for each separate purchase).
- Storage starting choice: chilled; suggested location: Fridge - segregated covered container. Follow the actual product instructions, especially after opening.
- Source: market; suggested expiry basis: receipt + documented storage life, only if supported by supplier guidance. See the mandatory batch fields below.

### Turmeric powder

- Unit: g; estimated unit cost: RM 0.025000 per g.
- Proposed starting quantity: 100.000 g; batch code: DK-START-16 (replace or suffix for each separate purchase).
- Storage starting choice: ambient; suggested location: Dry store - labelled sealed container. Follow the actual product instructions, especially after opening.
- Source: packaged; suggested expiry basis: actual printed label date. See the mandatory batch fields below.

### Long bean

- Unit: g; estimated unit cost: RM 0.008000 per g.
- Proposed starting quantity: 500.000 g; batch code: DK-START-17 (replace or suffix for each separate purchase).
- Storage starting choice: chilled; suggested location: Fridge - segregated covered container. Follow the actual product instructions, especially after opening.
- Source: market; suggested expiry basis: receipt + documented storage life, only if supported by supplier guidance. See the mandatory batch fields below.

### Carrot

- Unit: g; estimated unit cost: RM 0.004000 per g.
- Proposed starting quantity: 1000.000 g; batch code: DK-START-18 (replace or suffix for each separate purchase).
- Storage starting choice: chilled; suggested location: Fridge - segregated covered container. Follow the actual product instructions, especially after opening.
- Source: market; suggested expiry basis: receipt + documented storage life, only if supported by supplier guidance. See the mandatory batch fields below.

### Ginger

- Unit: g; estimated unit cost: RM 0.010000 per g.
- Proposed starting quantity: 250.000 g; batch code: DK-START-19 (replace or suffix for each separate purchase).
- Storage starting choice: chilled; suggested location: Fridge - segregated covered container. Follow the actual product instructions, especially after opening.
- Source: market; suggested expiry basis: receipt + documented storage life, only if supported by supplier guidance. See the mandatory batch fields below.

### Sweet soy sauce

- Unit: ml; estimated unit cost: RM 0.009000 per ml.
- Proposed starting quantity: 500.000 ml; batch code: DK-START-20 (replace or suffix for each separate purchase).
- Storage starting choice: ambient; suggested location: Dry store - labelled sealed container. Follow the actual product instructions, especially after opening.
- Source: packaged; suggested expiry basis: actual printed label date. See the mandatory batch fields below.

### Oyster sauce

- Unit: ml; estimated unit cost: RM 0.014000 per ml.
- Proposed starting quantity: 300.000 ml; batch code: DK-START-21 (replace or suffix for each separate purchase).
- Storage starting choice: ambient; suggested location: Dry store - labelled sealed container. Follow the actual product instructions, especially after opening.
- Source: packaged; suggested expiry basis: actual printed label date. See the mandatory batch fields below.

### Black pepper

- Unit: g; estimated unit cost: RM 0.040000 per g.
- Proposed starting quantity: 50.000 g; batch code: DK-START-22 (replace or suffix for each separate purchase).
- Storage starting choice: ambient; suggested location: Dry store - labelled sealed container. Follow the actual product instructions, especially after opening.
- Source: packaged; suggested expiry basis: actual printed label date. See the mandatory batch fields below.

### Dried rice vermicelli

- Unit: g; estimated unit cost: RM 0.007000 per g.
- Proposed starting quantity: 1000.000 g; batch code: DK-START-23 (replace or suffix for each separate purchase).
- Storage starting choice: ambient; suggested location: Dry store - labelled sealed container. Follow the actual product instructions, especially after opening.
- Source: packaged; suggested expiry basis: actual printed label date. See the mandatory batch fields below.

### Cabbage

- Unit: g; estimated unit cost: RM 0.004000 per g.
- Proposed starting quantity: 1000.000 g; batch code: DK-START-24 (replace or suffix for each separate purchase).
- Storage starting choice: chilled; suggested location: Fridge - segregated covered container. Follow the actual product instructions, especially after opening.
- Source: market; suggested expiry basis: receipt + documented storage life, only if supported by supplier guidance. See the mandatory batch fields below.

### Plain flour

- Unit: g; estimated unit cost: RM 0.004000 per g.
- Proposed starting quantity: 1000.000 g; batch code: DK-START-25 (replace or suffix for each separate purchase).
- Storage starting choice: ambient; suggested location: Dry store - labelled sealed container. Follow the actual product instructions, especially after opening.
- Source: packaged; suggested expiry basis: actual printed label date. See the mandatory batch fields below.

### Butter

- Unit: g; estimated unit cost: RM 0.040000 per g.
- Proposed starting quantity: 500.000 g; batch code: DK-START-26 (replace or suffix for each separate purchase).
- Storage starting choice: chilled; suggested location: Fridge - segregated covered container. Follow the actual product instructions, especially after opening.
- Source: packaged; suggested expiry basis: actual printed label date. See the mandatory batch fields below.

### Dark cooking chocolate

- Unit: g; estimated unit cost: RM 0.030000 per g.
- Proposed starting quantity: 1000.000 g; batch code: DK-START-27 (replace or suffix for each separate purchase).
- Storage starting choice: ambient; suggested location: Dry store - labelled sealed container. Follow the actual product instructions, especially after opening.
- Source: packaged; suggested expiry basis: actual printed label date. See the mandatory batch fields below.

### Cocoa powder

- Unit: g; estimated unit cost: RM 0.035000 per g.
- Proposed starting quantity: 250.000 g; batch code: DK-START-28 (replace or suffix for each separate purchase).
- Storage starting choice: ambient; suggested location: Dry store - labelled sealed container. Follow the actual product instructions, especially after opening.
- Source: packaged; suggested expiry basis: actual printed label date. See the mandatory batch fields below.

### Vanilla extract

- Unit: ml; estimated unit cost: RM 0.080000 per ml.
- Proposed starting quantity: 50.000 ml; batch code: DK-START-29 (replace or suffix for each separate purchase).
- Storage starting choice: ambient; suggested location: Dry store - labelled sealed container. Follow the actual product instructions, especially after opening.
- Source: packaged; suggested expiry basis: actual printed label date. See the mandatory batch fields below.

## Mandatory fields for EVERY real inventory batch

- Supplier/shop: actual seller name. Received date: actual receipt date. Quantity: weighed/countable remaining usable stock, not the proposed purchase amount.
- Printed-label basis: enter the actual original printed deadline and whether it is use-by or best-before. Do not fabricate a label date. Leave manufacture date and shelf-life days empty unless using the corresponding basis.
- Receipt/storage basis: original printed date blank; documented shelf-life days from applicable supplier guidance; guidance note must record source and storage conditions. There is no universal day count supplied here for meat or vegetables. If evidence is missing, keep the batch on hold and do not treat this template as a completed saveable record.
- Manufacture basis, if used instead: real manufacture date plus documented shelf-life days and the supporting conditions.
- Storage type/location: match actual storage. Separate raw chicken from ready-to-eat ingredients; use a covered raw-meat area appropriate to the kitchen. UHT coconut milk/sauces may require a different storage type once opened.
- Opened date / thawing-completed date: enter only actual events. After-open / after-thaw days: only documented limits; blank is not a claim of unlimited life.
- Handling history: Unknown and Hold = Yes in these templates. Change to Documented and release the hold only after reviewing actual transport, storage and date evidence. Do not copy a made-up temperature or supplier assurance into the notes.
- Handling note: actual observations and evidence. Batch unit cost: actual purchase price divided by quantity in the selected unit. Example: RM 20 for 1 kg becomes RM 0.020000 per g.
- Expiry date displayed by the app: verify the earliest applicable base/opening/thawing deadline. Date-only tracking does not assess hourly handling risks. Do not count held, expired or future-received stock as available.

## Entry checks before accepting orders

Initial five-menu validation: all five step lists pass the application's task validator. Each menu separately fits one and two batches in an empty 08:00-18:00 kitchen for 16:00 delivery with a 60-minute buffer. This exercises the real scheduling functions with an isolated SQLite configuration and no live database access; it does not establish that all five menus fit together or that the kitchen timings have been measured. Material references, positive recipe quantities and duplicate ingredients were checked. The original 29-material stock basket totals RM 302.30 at the illustrative unit costs.

- Trial one batch of each dish. Weigh yield, time each step and revise the estimates. Brownies need a pan/oven trial for the stated 24-piece batch.
- In Preparation preview, one batch should show 100 min nasi lemak, 100 min ayam kunyit, 105 min ayam kicap, 55 min bihun and 165 min brownies. A two-batch combined order doubles every step in this starting model.
- Test a future afternoon delivery at least 24 hours ahead, then test overlapping orders and a blocked kitchen interval. Availability still depends on existing orders and delivery buffer; these examples do not guarantee a slot.
- Check shared stock: both chicken menus consume the same chicken inventory. Do not add a full stock allocation separately for every menu.
- Do not use the unverified inventory templates to make a live shop appear in stock. For an FYP demo use a separate demo database with clearly fictional batch evidence.

## Sources and scope

Menu direction was checked against Malaysian operators offering rice meals and home-style dishes; the recipes, prices and times above are independently proposed examples, not copied operator recipes or verified market averages.

- https://vpndkitchen.com/ — Malaysian home-cooking menu context.
- https://mejamakan.my/ — home-style lauk/menu context.
- https://hq.moh.gov.my/fsq/garis-panduan-keselamatan-makanan-homebased — KKM home-based food guidance; use applicable guidance and actual supplier evidence for operations.

Companion JSON: DAPUR-KITA-STARTER-DATA.json. It uses material/category names for manual lookup, not database IDs, and cannot be posted directly to the API. `allergen_review` is an advisory field to append to Description; `unit` on inventory is a reference to the raw-material unit. The [catalogue importer](DAPUR-KITA-CATALOGUE-IMPORT.md) translates menus/materials through authenticated staff APIs and excludes inventory templates. Preparing or testing it does not insert live data.

## Additional menus: expanded catalogue

Offer a rotating subset each day. These 24 menu objects are a catalogue, not a claim that one worker can produce every item daily. Similar dishes intentionally share ingredients; the scheduler still treats separate orders separately. All common settings and evidence requirements earlier in this guide apply. Fried-rice plans here use freshly cooked rice in a continuous workflow, not undocumented overnight leftover rice.

### Nasi Goreng Kampung

- Category: Rice meals; price: RM 9.00; packaging: RM 0.70.
- Description: One box of freshly cooked rice stir-fried with egg, anchovies, long beans and chilli. Allergen information: Egg, fish, soy and usually wheat.
- Portions per batch: 4; daily maximum: 12. A bake portion means the named box/pack.
- Advance notice: 24 h; preparation span: 1 day; early finish: 0 min; independent batches: Off. Image/social links blank pending your own content.
- Basic fallback: first batch 80 min; extra batch 80 min; packing 2 min/unit. Detailed steps take precedence.
- Estimated ingredient plus packaging cost: RM 2.90; price less these costs: RM 6.10, before labour, wastage, delivery and overhead.

Ingredients per sold unit:

- Rice: 90.000 g
- Egg: 1.000 unit
- Onion: 25.000 g
- Garlic: 5.000 g
- Carrot: 30.000 g
- Cabbage: 40.000 g
- Sweet soy sauce: 10.000 ml
- Salt: 1.000 g
- Cooking oil: 15.000 ml
- Dried anchovies: 8.000 g
- Long bean: 30.000 g
- Chilli paste plain: 8.000 g

Steps in order; each has 0 allowed wait, overnight No and extra-batch minutes equal to the stated duration:

1. Weigh, wash and prepare ingredients: 20 min; prep_table; worker Yes.
2. Load rice cooker: 5 min; rice_cooker; worker Yes.
3. Cook rice: 30 min; rice_cooker; worker No.
4. Stir-fry rice and accompaniments: 25 min; stove; worker Yes.
5. Portion, label and pack: 10 min; packing_area; worker Yes.

One-batch step total: 90 min; hands-on: 60 min.

### Nasi Goreng Ayam

- Category: Rice meals; price: RM 11.00; packaging: RM 0.70.
- Description: One box of freshly cooked rice stir-fried with chicken, egg and vegetables. Allergen information: Egg, soy and usually wheat.
- Portions per batch: 4; daily maximum: 12. A bake portion means the named box/pack.
- Advance notice: 24 h; preparation span: 1 day; early finish: 0 min; independent batches: Off. Image/social links blank pending your own content.
- Basic fallback: first batch 80 min; extra batch 80 min; packing 2 min/unit. Detailed steps take precedence.
- Estimated ingredient plus packaging cost: RM 4.61; price less these costs: RM 6.39, before labour, wastage, delivery and overhead.

Ingredients per sold unit:

- Rice: 90.000 g
- Egg: 1.000 unit
- Onion: 25.000 g
- Garlic: 5.000 g
- Carrot: 30.000 g
- Cabbage: 40.000 g
- Sweet soy sauce: 10.000 ml
- Salt: 1.000 g
- Cooking oil: 15.000 ml
- Chicken boneless trimmed: 120.000 g

Steps in order; each has 0 allowed wait, overnight No and extra-batch minutes equal to the stated duration:

1. Weigh, wash and prepare ingredients: 20 min; prep_table; worker Yes.
2. Load rice cooker: 5 min; rice_cooker; worker Yes.
3. Cook rice: 30 min; rice_cooker; worker No.
4. Stir-fry rice and accompaniments: 25 min; stove; worker Yes.
5. Portion, label and pack: 10 min; packing_area; worker Yes.

One-batch step total: 90 min; hands-on: 60 min.

### Nasi Goreng Telur

- Category: Rice meals; price: RM 8.00; packaging: RM 0.70.
- Description: One box of freshly cooked rice stir-fried with egg and vegetables. Allergen information: Egg, soy and usually wheat.
- Portions per batch: 4; daily maximum: 12. A bake portion means the named box/pack.
- Advance notice: 24 h; preparation span: 1 day; early finish: 0 min; independent batches: Off. Image/social links blank pending your own content.
- Basic fallback: first batch 80 min; extra batch 80 min; packing 2 min/unit. Detailed steps take precedence.
- Estimated ingredient plus packaging cost: RM 2.21; price less these costs: RM 5.79, before labour, wastage, delivery and overhead.

Ingredients per sold unit:

- Rice: 90.000 g
- Egg: 1.000 unit
- Onion: 25.000 g
- Garlic: 5.000 g
- Carrot: 30.000 g
- Cabbage: 40.000 g
- Sweet soy sauce: 10.000 ml
- Salt: 1.000 g
- Cooking oil: 15.000 ml

Steps in order; each has 0 allowed wait, overnight No and extra-batch minutes equal to the stated duration:

1. Weigh, wash and prepare ingredients: 20 min; prep_table; worker Yes.
2. Load rice cooker: 5 min; rice_cooker; worker Yes.
3. Cook rice: 30 min; rice_cooker; worker No.
4. Stir-fry rice and accompaniments: 25 min; stove; worker Yes.
5. Portion, label and pack: 10 min; packing_area; worker Yes.

One-batch step total: 90 min; hands-on: 60 min.

### Bihun Goreng Ayam

- Category: Noodles; price: RM 10.50; packaging: RM 0.70.
- Description: One box of rice vermicelli with chicken, egg and vegetables. Allergen information: Egg, soy, usually wheat and mollusc.
- Portions per batch: 4; daily maximum: 12. A bake portion means the named box/pack.
- Advance notice: 24 h; preparation span: 1 day; early finish: 0 min; independent batches: Off. Image/social links blank pending your own content.
- Basic fallback: first batch 50 min; extra batch 50 min; packing 2 min/unit. Detailed steps take precedence.
- Estimated ingredient plus packaging cost: RM 4.74; price less these costs: RM 5.76, before labour, wastage, delivery and overhead.

Ingredients per sold unit:

- Dried rice vermicelli: 90.000 g
- Egg: 1.000 unit
- Cabbage: 60.000 g
- Carrot: 30.000 g
- Onion: 25.000 g
- Garlic: 5.000 g
- Sweet soy sauce: 12.000 ml
- Oyster sauce: 5.000 ml
- Chilli paste plain: 8.000 g
- Salt: 1.000 g
- Cooking oil: 15.000 ml
- Chicken boneless trimmed: 100.000 g

Steps in order; each has 0 allowed wait, overnight No and extra-batch minutes equal to the stated duration:

1. Weigh and prepare noodles and vegetables: 20 min; prep_table; worker Yes.
2. Stir-fry noodles and accompaniments: 30 min; stove; worker Yes.
3. Portion, label and pack: 10 min; packing_area; worker Yes.

One-batch step total: 60 min; hands-on: 60 min.

### Bihun Goreng Sayur

- Category: Noodles; price: RM 7.50; packaging: RM 0.70.
- Description: One box of rice vermicelli with cabbage and carrot. Prepared in a shared kitchen. Allergen information: Soy and usually wheat. No vegetarian or allergen-free certification implied.
- Portions per batch: 4; daily maximum: 12. A bake portion means the named box/pack.
- Advance notice: 24 h; preparation span: 1 day; early finish: 0 min; independent batches: Off. Image/social links blank pending your own content.
- Basic fallback: first batch 50 min; extra batch 50 min; packing 2 min/unit. Detailed steps take precedence.
- Estimated ingredient plus packaging cost: RM 2.29; price less these costs: RM 5.21, before labour, wastage, delivery and overhead.

Ingredients per sold unit:

- Dried rice vermicelli: 90.000 g
- Cabbage: 90.000 g
- Carrot: 30.000 g
- Onion: 25.000 g
- Garlic: 5.000 g
- Sweet soy sauce: 12.000 ml
- Chilli paste plain: 8.000 g
- Salt: 1.000 g
- Cooking oil: 15.000 ml

Steps in order; each has 0 allowed wait, overnight No and extra-batch minutes equal to the stated duration:

1. Weigh and prepare noodles and vegetables: 20 min; prep_table; worker Yes.
2. Stir-fry noodles and accompaniments: 30 min; stove; worker Yes.
3. Portion, label and pack: 10 min; packing_area; worker Yes.

One-batch step total: 60 min; hands-on: 60 min.

### Mee Goreng Telur

- Category: Noodles; price: RM 9.00; packaging: RM 0.70.
- Description: One box of yellow noodles stir-fried with egg and vegetables. Allergen information: Wheat, egg, soy and mollusc.
- Portions per batch: 4; daily maximum: 12. A bake portion means the named box/pack.
- Advance notice: 24 h; preparation span: 1 day; early finish: 0 min; independent batches: Off. Image/social links blank pending your own content.
- Basic fallback: first batch 50 min; extra batch 50 min; packing 2 min/unit. Detailed steps take precedence.
- Estimated ingredient plus packaging cost: RM 3.19; price less these costs: RM 5.81, before labour, wastage, delivery and overhead.

Ingredients per sold unit:

- Egg: 1.000 unit
- Cabbage: 60.000 g
- Carrot: 30.000 g
- Onion: 25.000 g
- Garlic: 5.000 g
- Sweet soy sauce: 12.000 ml
- Oyster sauce: 5.000 ml
- Chilli paste plain: 8.000 g
- Salt: 1.000 g
- Cooking oil: 15.000 ml
- Fresh yellow noodles: 180.000 g

Steps in order; each has 0 allowed wait, overnight No and extra-batch minutes equal to the stated duration:

1. Weigh and prepare noodles and vegetables: 20 min; prep_table; worker Yes.
2. Stir-fry noodles and accompaniments: 30 min; stove; worker Yes.
3. Portion, label and pack: 10 min; packing_area; worker Yes.

One-batch step total: 60 min; hands-on: 60 min.

### Mee Goreng Ayam

- Category: Noodles; price: RM 11.00; packaging: RM 0.70.
- Description: One box of yellow noodles stir-fried with chicken, egg and vegetables. Allergen information: Wheat, egg, soy and mollusc.
- Portions per batch: 4; daily maximum: 12. A bake portion means the named box/pack.
- Advance notice: 24 h; preparation span: 1 day; early finish: 0 min; independent batches: Off. Image/social links blank pending your own content.
- Basic fallback: first batch 50 min; extra batch 50 min; packing 2 min/unit. Detailed steps take precedence.
- Estimated ingredient plus packaging cost: RM 5.19; price less these costs: RM 5.81, before labour, wastage, delivery and overhead.

Ingredients per sold unit:

- Egg: 1.000 unit
- Cabbage: 60.000 g
- Carrot: 30.000 g
- Onion: 25.000 g
- Garlic: 5.000 g
- Sweet soy sauce: 12.000 ml
- Oyster sauce: 5.000 ml
- Chilli paste plain: 8.000 g
- Salt: 1.000 g
- Cooking oil: 15.000 ml
- Fresh yellow noodles: 180.000 g
- Chicken boneless trimmed: 100.000 g

Steps in order; each has 0 allowed wait, overnight No and extra-batch minutes equal to the stated duration:

1. Weigh and prepare noodles and vegetables: 20 min; prep_table; worker Yes.
2. Stir-fry noodles and accompaniments: 30 min; stove; worker Yes.
3. Portion, label and pack: 10 min; packing_area; worker Yes.

One-batch step total: 60 min; hands-on: 60 min.

### Kuey Teow Goreng Telur

- Category: Noodles; price: RM 9.00; packaging: RM 0.70.
- Description: One box of flat rice noodles stir-fried with egg, cabbage and carrot. Allergen information: Egg, soy, usually wheat and mollusc.
- Portions per batch: 4; daily maximum: 12. A bake portion means the named box/pack.
- Advance notice: 24 h; preparation span: 1 day; early finish: 0 min; independent batches: Off. Image/social links blank pending your own content.
- Basic fallback: first batch 50 min; extra batch 50 min; packing 2 min/unit. Detailed steps take precedence.
- Estimated ingredient plus packaging cost: RM 3.19; price less these costs: RM 5.81, before labour, wastage, delivery and overhead.

Ingredients per sold unit:

- Egg: 1.000 unit
- Cabbage: 60.000 g
- Carrot: 30.000 g
- Onion: 25.000 g
- Garlic: 5.000 g
- Sweet soy sauce: 12.000 ml
- Oyster sauce: 5.000 ml
- Chilli paste plain: 8.000 g
- Salt: 1.000 g
- Cooking oil: 15.000 ml
- Fresh flat rice noodles: 180.000 g

Steps in order; each has 0 allowed wait, overnight No and extra-batch minutes equal to the stated duration:

1. Weigh and prepare noodles and vegetables: 20 min; prep_table; worker Yes.
2. Stir-fry noodles and accompaniments: 30 min; stove; worker Yes.
3. Portion, label and pack: 10 min; packing_area; worker Yes.

One-batch step total: 60 min; hands-on: 60 min.

### Nasi Ayam Halia

- Category: Rice meals; price: RM 12.50; packaging: RM 0.70.
- Description: One box of rice with ginger chicken, carrot and cucumber. Allergen information: Soy, usually wheat and mollusc.
- Portions per batch: 5; daily maximum: 15. A bake portion means the named box/pack.
- Advance notice: 24 h; preparation span: 1 day; early finish: 0 min; independent batches: Off. Image/social links blank pending your own content.
- Basic fallback: first batch 95 min; extra batch 95 min; packing 2 min/unit. Detailed steps take precedence.
- Estimated ingredient plus packaging cost: RM 5.62; price less these costs: RM 6.88, before labour, wastage, delivery and overhead.

Ingredients per sold unit:

- Rice: 90.000 g
- Chicken boneless trimmed: 180.000 g
- Onion: 30.000 g
- Garlic: 5.000 g
- Ginger: 15.000 g
- Sweet soy sauce: 12.000 ml
- Oyster sauce: 8.000 ml
- Black pepper: 0.500 g
- Carrot: 40.000 g
- Cucumber: 30.000 g
- Sugar: 3.000 g
- Salt: 0.500 g
- Cooking oil: 12.000 ml

Steps in order; each has 0 allowed wait, overnight No and extra-batch minutes equal to the stated duration:

1. Weigh, wash and prepare ingredients: 25 min; prep_table; worker Yes.
2. Load rice cooker: 5 min; rice_cooker; worker Yes.
3. Cook rice: 30 min; rice_cooker; worker No.
4. Cook main dish and vegetables: 35 min; stove; worker Yes.
5. Portion, label and pack: 10 min; packing_area; worker Yes.

One-batch step total: 105 min; hands-on: 75 min.

### Nasi Ayam Sambal

- Category: Rice meals; price: RM 12.50; packaging: RM 0.70.
- Description: One box of rice with sambal chicken, carrot and cucumber. Allergen information: Verify chilli paste ingredients and shared-kitchen cross-contact.
- Portions per batch: 5; daily maximum: 15. A bake portion means the named box/pack.
- Advance notice: 24 h; preparation span: 1 day; early finish: 0 min; independent batches: Off. Image/social links blank pending your own content.
- Basic fallback: first batch 95 min; extra batch 95 min; packing 2 min/unit. Detailed steps take precedence.
- Estimated ingredient plus packaging cost: RM 5.66; price less these costs: RM 6.84, before labour, wastage, delivery and overhead.

Ingredients per sold unit:

- Rice: 90.000 g
- Chicken boneless trimmed: 180.000 g
- Onion: 30.000 g
- Garlic: 5.000 g
- Ginger: 8.000 g
- Carrot: 40.000 g
- Cucumber: 30.000 g
- Sugar: 6.000 g
- Salt: 1.500 g
- Cooking oil: 12.000 ml
- Chilli paste plain: 25.000 g
- Tamarind paste: 3.000 g

Steps in order; each has 0 allowed wait, overnight No and extra-batch minutes equal to the stated duration:

1. Weigh, wash and prepare ingredients: 25 min; prep_table; worker Yes.
2. Load rice cooker: 5 min; rice_cooker; worker Yes.
3. Cook rice: 30 min; rice_cooker; worker No.
4. Cook main dish and vegetables: 35 min; stove; worker Yes.
5. Portion, label and pack: 10 min; packing_area; worker Yes.

One-batch step total: 105 min; hands-on: 75 min.

### Nasi Ayam Black Pepper

- Category: Rice meals; price: RM 13.00; packaging: RM 0.70.
- Description: One box of rice with black-pepper chicken, carrot and cucumber. Allergen information: Soy, usually wheat and mollusc.
- Portions per batch: 5; daily maximum: 15. A bake portion means the named box/pack.
- Advance notice: 24 h; preparation span: 1 day; early finish: 0 min; independent batches: Off. Image/social links blank pending your own content.
- Basic fallback: first batch 95 min; extra batch 95 min; packing 2 min/unit. Detailed steps take precedence.
- Estimated ingredient plus packaging cost: RM 5.68; price less these costs: RM 7.32, before labour, wastage, delivery and overhead.

Ingredients per sold unit:

- Rice: 90.000 g
- Chicken boneless trimmed: 180.000 g
- Onion: 30.000 g
- Garlic: 5.000 g
- Ginger: 8.000 g
- Sweet soy sauce: 20.000 ml
- Oyster sauce: 8.000 ml
- Black pepper: 2.000 g
- Carrot: 40.000 g
- Cucumber: 30.000 g
- Sugar: 3.000 g
- Salt: 0.500 g
- Cooking oil: 12.000 ml

Steps in order; each has 0 allowed wait, overnight No and extra-batch minutes equal to the stated duration:

1. Weigh, wash and prepare ingredients: 25 min; prep_table; worker Yes.
2. Load rice cooker: 5 min; rice_cooker; worker Yes.
3. Cook rice: 30 min; rice_cooker; worker No.
4. Cook main dish and vegetables: 35 min; stove; worker Yes.
5. Portion, label and pack: 10 min; packing_area; worker Yes.

One-batch step total: 105 min; hands-on: 75 min.

### Nasi Ayam Masak Lemak

- Category: Rice meals; price: RM 13.00; packaging: RM 0.70.
- Description: One box of rice with a home-style coconut turmeric chicken gravy, carrot and cucumber. Allergen information: Check actual brands and shared-kitchen cross-contact.
- Portions per batch: 5; daily maximum: 15. A bake portion means the named box/pack.
- Advance notice: 24 h; preparation span: 1 day; early finish: 0 min; independent batches: Off. Image/social links blank pending your own content.
- Basic fallback: first batch 95 min; extra batch 95 min; packing 2 min/unit. Detailed steps take precedence.
- Estimated ingredient plus packaging cost: RM 6.18; price less these costs: RM 6.82, before labour, wastage, delivery and overhead.

Ingredients per sold unit:

- Rice: 90.000 g
- Chicken boneless trimmed: 180.000 g
- Onion: 30.000 g
- Garlic: 5.000 g
- Ginger: 8.000 g
- Carrot: 40.000 g
- Cucumber: 30.000 g
- Salt: 1.500 g
- Cooking oil: 12.000 ml
- Chilli paste plain: 10.000 g
- Coconut milk UHT: 60.000 ml
- Turmeric powder: 1.500 g

Steps in order; each has 0 allowed wait, overnight No and extra-batch minutes equal to the stated duration:

1. Weigh, wash and prepare ingredients: 25 min; prep_table; worker Yes.
2. Load rice cooker: 5 min; rice_cooker; worker Yes.
3. Cook rice: 30 min; rice_cooker; worker No.
4. Cook main dish and vegetables: 35 min; stove; worker Yes.
5. Portion, label and pack: 10 min; packing_area; worker Yes.

One-batch step total: 105 min; hands-on: 75 min.

### Nasi Telur Kicap

- Category: Rice meals; price: RM 8.50; packaging: RM 0.70.
- Description: One box of rice with two eggs in ginger soy sauce, carrot and cucumber. Allergen information: Egg, soy, usually wheat and mollusc.
- Portions per batch: 5; daily maximum: 15. A bake portion means the named box/pack.
- Advance notice: 24 h; preparation span: 1 day; early finish: 0 min; independent batches: Off. Image/social links blank pending your own content.
- Basic fallback: first batch 95 min; extra batch 95 min; packing 2 min/unit. Detailed steps take precedence.
- Estimated ingredient plus packaging cost: RM 3.02; price less these costs: RM 5.48, before labour, wastage, delivery and overhead.

Ingredients per sold unit:

- Rice: 90.000 g
- Onion: 30.000 g
- Garlic: 5.000 g
- Ginger: 8.000 g
- Sweet soy sauce: 20.000 ml
- Oyster sauce: 8.000 ml
- Black pepper: 0.500 g
- Carrot: 40.000 g
- Cucumber: 30.000 g
- Sugar: 3.000 g
- Salt: 0.500 g
- Cooking oil: 12.000 ml
- Egg: 2.000 unit

Steps in order; each has 0 allowed wait, overnight No and extra-batch minutes equal to the stated duration:

1. Weigh, wash and prepare ingredients: 25 min; prep_table; worker Yes.
2. Load rice cooker: 5 min; rice_cooker; worker Yes.
3. Cook rice: 30 min; rice_cooker; worker No.
4. Cook main dish and vegetables: 35 min; stove; worker Yes.
5. Portion, label and pack: 10 min; packing_area; worker Yes.

One-batch step total: 105 min; hands-on: 75 min.

### Nasi Lemak Ayam Kunyit

- Category: Rice meals; price: RM 14.00; packaging: RM 0.70.
- Description: One coconut-rice box with chicken, sambal, boiled egg, cucumber, peanuts and anchovies. Allergen information: Egg, peanut, fish; soy, wheat and mollusc where sauces are used. Check brands.
- Portions per batch: 5; daily maximum: 10. A bake portion means the named box/pack.
- Advance notice: 24 h; preparation span: 1 day; early finish: 0 min; independent batches: Off. Image/social links blank pending your own content.
- Basic fallback: first batch 110 min; extra batch 110 min; packing 2 min/unit. Detailed steps take precedence.
- Estimated ingredient plus packaging cost: RM 6.32; price less these costs: RM 7.68, before labour, wastage, delivery and overhead.

Ingredients per sold unit:

- Rice: 90.000 g
- Coconut milk UHT: 35.000 ml
- Egg: 1.000 unit
- Cucumber: 30.000 g
- Roasted peanuts: 10.000 g
- Dried anchovies: 8.000 g
- Onion: 43.750 g
- Garlic: 6.750 g
- Chilli paste plain: 15.000 g
- Tamarind paste: 2.000 g
- Sugar: 5.000 g
- Salt: 3.000 g
- Cooking oil: 25.500 ml
- Pandan leaf: 1.000 g
- Chicken boneless trimmed: 150.000 g
- Turmeric powder: 1.500 g

Steps in order; each has 0 allowed wait, overnight No and extra-batch minutes equal to the stated duration:

1. Weigh, wash and prepare ingredients: 25 min; prep_table; worker Yes.
2. Load rice cooker: 5 min; rice_cooker; worker Yes.
3. Cook rice: 30 min; rice_cooker; worker No.
4. Cook main dish and vegetables: 50 min; stove; worker Yes.
5. Portion, label and pack: 10 min; packing_area; worker Yes.

One-batch step total: 120 min; hands-on: 90 min.

### Nasi Lemak Ayam Sambal

- Category: Rice meals; price: RM 14.50; packaging: RM 0.70.
- Description: One coconut-rice box with chicken, sambal, boiled egg, cucumber, peanuts and anchovies. Allergen information: Egg, peanut, fish; soy, wheat and mollusc where sauces are used. Check brands.
- Portions per batch: 5; daily maximum: 10. A bake portion means the named box/pack.
- Advance notice: 24 h; preparation span: 1 day; early finish: 0 min; independent batches: Off. Image/social links blank pending your own content.
- Basic fallback: first batch 110 min; extra batch 110 min; packing 2 min/unit. Detailed steps take precedence.
- Estimated ingredient plus packaging cost: RM 6.60; price less these costs: RM 7.90, before labour, wastage, delivery and overhead.

Ingredients per sold unit:

- Rice: 90.000 g
- Coconut milk UHT: 35.000 ml
- Egg: 1.000 unit
- Cucumber: 30.000 g
- Roasted peanuts: 10.000 g
- Dried anchovies: 8.000 g
- Onion: 47.500 g
- Garlic: 6.750 g
- Chilli paste plain: 33.750 g
- Tamarind paste: 4.250 g
- Sugar: 9.500 g
- Salt: 2.625 g
- Cooking oil: 21.000 ml
- Pandan leaf: 1.000 g
- Chicken boneless trimmed: 150.000 g
- Ginger: 6.000 g

Steps in order; each has 0 allowed wait, overnight No and extra-batch minutes equal to the stated duration:

1. Weigh, wash and prepare ingredients: 25 min; prep_table; worker Yes.
2. Load rice cooker: 5 min; rice_cooker; worker Yes.
3. Cook rice: 30 min; rice_cooker; worker No.
4. Cook main dish and vegetables: 50 min; stove; worker Yes.
5. Portion, label and pack: 10 min; packing_area; worker Yes.

One-batch step total: 120 min; hands-on: 90 min.

### Nasi Lemak Ayam Kicap

- Category: Rice meals; price: RM 14.50; packaging: RM 0.70.
- Description: One coconut-rice box with chicken, sambal, boiled egg, cucumber, peanuts and anchovies. Allergen information: Egg, peanut, fish; soy, wheat and mollusc where sauces are used. Check brands.
- Portions per batch: 5; daily maximum: 10. A bake portion means the named box/pack.
- Advance notice: 24 h; preparation span: 1 day; early finish: 0 min; independent batches: Off. Image/social links blank pending your own content.
- Basic fallback: first batch 110 min; extra batch 110 min; packing 2 min/unit. Detailed steps take precedence.
- Estimated ingredient plus packaging cost: RM 6.57; price less these costs: RM 7.93, before labour, wastage, delivery and overhead.

Ingredients per sold unit:

- Rice: 90.000 g
- Coconut milk UHT: 35.000 ml
- Egg: 1.000 unit
- Cucumber: 30.000 g
- Roasted peanuts: 10.000 g
- Dried anchovies: 8.000 g
- Onion: 47.500 g
- Garlic: 6.750 g
- Chilli paste plain: 15.000 g
- Tamarind paste: 2.000 g
- Sugar: 7.250 g
- Salt: 1.875 g
- Cooking oil: 21.000 ml
- Pandan leaf: 1.000 g
- Chicken boneless trimmed: 150.000 g
- Ginger: 6.000 g
- Sweet soy sauce: 15.000 ml
- Oyster sauce: 6.000 ml
- Black pepper: 0.375 g

Steps in order; each has 0 allowed wait, overnight No and extra-batch minutes equal to the stated duration:

1. Weigh, wash and prepare ingredients: 25 min; prep_table; worker Yes.
2. Load rice cooker: 5 min; rice_cooker; worker Yes.
3. Cook rice: 30 min; rice_cooker; worker No.
4. Cook main dish and vegetables: 50 min; stove; worker Yes.
5. Portion, label and pack: 10 min; packing_area; worker Yes.

One-batch step total: 120 min; hands-on: 90 min.

### Walnut Brownies - Box of 6

- Category: Bakes; price: RM 18.00; packaging: RM 1.20.
- Description: Six small chocolate brownie squares with walnuts. One sold unit is one six-piece box. Allergen information: Wheat, milk, egg, walnut and possibly soy.
- Portions per batch: 4; daily maximum: 8. A bake portion means the named box/pack.
- Advance notice: 24 h; preparation span: 1 day; early finish: 0 min; independent batches: Off. Image/social links blank pending your own content.
- Basic fallback: first batch 150 min; extra batch 150 min; packing 2 min/unit. Detailed steps take precedence.
- Estimated ingredient plus packaging cost: RM 6.10; price less these costs: RM 11.90, before labour, wastage, delivery and overhead.

Ingredients per sold unit:

- Plain flour: 30.000 g
- Butter: 35.000 g
- Dark cooking chocolate: 50.000 g
- Cocoa powder: 8.000 g
- Sugar: 55.000 g
- Egg: 0.500 unit
- Vanilla extract: 1.000 ml
- Salt: 0.300 g
- Walnut kernels: 20.000 g

Steps in order; each has 0 allowed wait, overnight No and extra-batch minutes equal to the stated duration:

1. Weigh, melt chocolate and mix batter: 25 min; prep_table; worker Yes.
2. Preheat oven, line pan and load batter: 15 min; oven; worker Yes.
3. Bake brownies: 30 min; oven; worker No.
4. Unload and check bake: 5 min; oven; worker Yes.
5. Cool on a clean rack: 75 min; none; worker No.
6. Cut, check yield and box: 15 min; packing_area; worker Yes.

One-batch step total: 165 min; hands-on: 60 min.

### Chocolate Chip Cookies - Pack of 6

- Category: Bakes; price: RM 10.00; packaging: RM 1.20.
- Description: Six small chocolate-chip cookies, approximately 20-25 g each. One sold unit is one pack. Allergen information: Wheat, milk, egg and possibly soy.
- Portions per batch: 5; daily maximum: 10. A bake portion means the named box/pack.
- Advance notice: 24 h; preparation span: 1 day; early finish: 0 min; independent batches: Off. Image/social links blank pending your own content.
- Basic fallback: first batch 110 min; extra batch 110 min; packing 2 min/unit. Detailed steps take precedence.
- Estimated ingredient plus packaging cost: RM 3.64; price less these costs: RM 6.36, before labour, wastage, delivery and overhead.

Ingredients per sold unit:

- Plain flour: 55.000 g
- Butter: 30.000 g
- Sugar: 30.000 g
- Egg: 0.200 unit
- Chocolate chips: 30.000 g
- Vanilla extract: 0.500 ml
- Baking powder: 0.500 g
- Salt: 0.300 g

Steps in order; each has 0 allowed wait, overnight No and extra-batch minutes equal to the stated duration:

1. Weigh and mix cookie dough: 25 min; prep_table; worker Yes.
2. Preheat oven, portion dough and load trays: 15 min; oven; worker Yes.
3. Bake cookies: 20 min; oven; worker No.
4. Unload and check bake: 5 min; oven; worker Yes.
5. Cool cookies on rack: 45 min; none; worker No.
6. Count, label and pack: 15 min; packing_area; worker Yes.

One-batch step total: 125 min; hands-on: 60 min.

### Banana Cake - Box of 4 Slices

- Category: Bakes; price: RM 12.00; packaging: RM 1.20.
- Description: Four small banana-cake slices. One sold unit is one box; weigh trial yield before setting final portion claims. Allergen information: Wheat, milk and egg.
- Portions per batch: 4; daily maximum: 8. A bake portion means the named box/pack.
- Advance notice: 24 h; preparation span: 1 day; early finish: 0 min; independent batches: Off. Image/social links blank pending your own content.
- Basic fallback: first batch 165 min; extra batch 165 min; packing 2 min/unit. Detailed steps take precedence.
- Estimated ingredient plus packaging cost: RM 4.05; price less these costs: RM 7.95, before labour, wastage, delivery and overhead.

Ingredients per sold unit:

- Plain flour: 65.000 g
- Banana peeled: 100.000 g
- Egg: 0.500 unit
- Sugar: 40.000 g
- Butter: 35.000 g
- Baking powder: 2.000 g
- Vanilla extract: 1.000 ml
- Salt: 0.500 g

Steps in order; each has 0 allowed wait, overnight No and extra-batch minutes equal to the stated duration:

1. Weigh, mash banana and mix batter: 25 min; prep_table; worker Yes.
2. Preheat oven, prepare tin and load: 15 min; oven; worker Yes.
3. Bake banana cake: 45 min; oven; worker No.
4. Unload and check bake: 5 min; oven; worker Yes.
5. Cool cake on rack: 75 min; none; worker No.
6. Slice, label and box: 15 min; packing_area; worker Yes.

One-batch step total: 180 min; hands-on: 60 min.

## Additional raw materials and stock templates

These six entries extend the original 29 to 35. Use all mandatory actual-date and evidence fields above; templates remain held until verified. Banana quantity and cost refer to peeled usable yield, not whole unpeeled purchase weight.

### Fresh yellow noodles

- Unit: g; estimated cost: RM 0.006000 per g.
- Proposed quantity: 1000.000 g; batch code: DK-START-30.
- Storage starting choice: chilled; location: Fridge - covered separate shelf; follow supplier instructions.
- Source: packaged; expiry basis: label. Supplier and actual dates must be completed. Handling Unknown; Hold Yes pending evidence.

### Fresh flat rice noodles

- Unit: g; estimated cost: RM 0.006000 per g.
- Proposed quantity: 1000.000 g; batch code: DK-START-31.
- Storage starting choice: chilled; location: Fridge - covered separate shelf; follow supplier instructions.
- Source: packaged; expiry basis: label. Supplier and actual dates must be completed. Handling Unknown; Hold Yes pending evidence.

### Walnut kernels

- Unit: g; estimated cost: RM 0.055000 per g.
- Proposed quantity: 250.000 g; batch code: DK-START-32.
- Storage starting choice: ambient; location: Dry store - labelled container; follow supplier instructions.
- Source: packaged; expiry basis: label. Supplier and actual dates must be completed. Handling Unknown; Hold Yes pending evidence.

### Chocolate chips

- Unit: g; estimated cost: RM 0.026000 per g.
- Proposed quantity: 500.000 g; batch code: DK-START-33.
- Storage starting choice: ambient; location: Dry store - labelled container; follow supplier instructions.
- Source: packaged; expiry basis: label. Supplier and actual dates must be completed. Handling Unknown; Hold Yes pending evidence.

### Banana peeled

- Unit: g; estimated cost: RM 0.007000 per g.
- Proposed quantity: 1000.000 g; batch code: DK-START-34.
- Storage starting choice: ambient; location: Dry store - labelled container; follow supplier instructions.
- Source: market; expiry basis: storage. Supplier and actual dates must be completed. Handling Unknown; Hold Yes pending evidence.

### Baking powder

- Unit: g; estimated cost: RM 0.020000 per g.
- Proposed quantity: 100.000 g; batch code: DK-START-35.
- Storage starting choice: ambient; location: Dry store - labelled container; follow supplier instructions.
- Source: packaged; expiry basis: label. Supplier and actual dates must be completed. Handling Unknown; Hold Yes pending evidence.
