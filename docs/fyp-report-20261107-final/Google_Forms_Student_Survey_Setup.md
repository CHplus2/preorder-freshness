# Google Forms questionnaire — setup and copy guide

The Word/PDF forms in the report are templates. Students receive the respondent link from a Google Form you create in your own account. No live form has been created by this revision.

## Option 1: create the two blank forms with Apps Script

1. Open https://script.google.com/ and create a project.
2. Paste the contents of Create_Google_Evaluation_Forms.gs.
3. Run createWrapBowlEvaluationForms and authorise Google Forms access for your own account.
4. Open the edit links in the execution log. Responses start switched off so you can check the questions first. Re-running opens the same forms rather than creating another pair.
5. Review with your supervisor, insert or provide the agreed website/test-task instructions, and check the consent routing.
6. In Google Forms, publish the form if your account requires it, allow responses, and share the respondent link. Keep the edit link private.
7. Test the form once yourself, then remove that practice response before collecting participant data.

No API credentials, website cron, bank transfer or email-password setup is needed for these forms. This script was syntax-checked locally; it has not been executed in your Google account. Google may request authorisation and your account may impose sharing restrictions.

## Option 2: copy the questions manually

Form title: Wrap & Bowl Kuch — customer experience

Start with a voluntary consent question. A refusal should go to the end, without requiring ratings. Do not collect email addresses, names, phone numbers, bank details or receipt uploads. Use optional assigned participant codes.

Add optional device type and a question recording whether A, B, both or neither was tried. Give the tasks below before the ratings:

1. Browse the menu and open Ingredient storage records. Review what is recorded and the explanation of date-based status.
2. Task A: start with an empty basket and use ordinary browsing to choose three selling units for an assigned offered date and area, within the agreed budget. Stop at checkout review.
3. Task B: start again with an empty basket and use Suggestions for a date for a comparable date, area, quantity and budget. Review an option and checkout guidance. Stop before payment or order placement.

Use comparable dates, areas, budgets and quantities. Empty the basket before EACH task; a mixed recommendation search keeps an existing basket. Record the task order. Participants must stop before real payment or live order placement. If account access cannot be tried, use Not tried for the relevant item.

For S1–S9, use: 1 — Strongly disagree; 2 — Disagree; 3 — Neither agree nor disagree; 4 — Agree; 5 — Strongly agree; Not tried / not applicable.

S1: I could identify the business I was ordering from.
S2: The price and contents of a selling unit were clear.
S3: I could find an offered date and an allowed delivery or collection time.
S4: I could see the delivery fee and complete order total.
S5: The account and passkey instructions were understandable.
S6: I understood that an uploaded receipt still needs payment verification.
S7: The ingredient storage summary was understandable.
S8: The suggestions matched my date, quantity and budget choices.
S9: The difference between Allow a mix and One menu only was clear.

S10: Compared with ordinary browsing, how much effort did choosing with suggestions require?
Choices: Much less effort; Less effort; About the same effort; More effort; Much more effort; I did not try both.

S11 (optional comment): Which step was most confusing, and what would you change?

## Client follow-up

Use the separate client Google Form or Appendix E on paper. A paper signature is optional; a genuine dated response and the tasks actually tried matter more than the medium. Do not fill it on the client’s behalf or recreate an earlier meeting as a formal interview.

## Where results go

Chapter 5.4.1: actual client tasks, comments, agreed changes and follow-up checks.
Chapter 5.4.2: actual student sample, rating distributions, comments, task comparison and resulting changes.

Keep an anonymised response export and task notes in your private project evidence. Do not publish participant contact details. Count Not tried separately and use the valid-answer count when calculating percentages. Agreement items here are a project-specific questionnaire, not a standard SUS score. Report choice effort and test-task completion without claiming measured paid conversion.
