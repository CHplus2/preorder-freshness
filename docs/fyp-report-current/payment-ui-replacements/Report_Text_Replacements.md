# Report text replacements

## Figure 4.7

Replace the caption with:

**Figure 4.7: Payment section showing the kitchen’s receiving QR code and an uploaded sample receipt.**

Suggested accompanying description:

The customer can view the kitchen’s receiving QR code after the delivery details, availability and total have been confirmed. A payment receipt image can then be uploaded and attached to the preorder. The kitchen checks the evidence against its bank records before recording payment as received. The screenshot uses the kitchen’s supplied QR image and a sample receipt; no bank transfer was made for this example.

“Sample” or “illustrative” describes the receipt, not the receiving QR. The original caption, “Payment section with an uploaded illustrative receipt,” is still accurate, but the replacement makes that distinction clearer. Do not describe the sample receipt as proof of a genuine payment.

## Figure 4.22

Use your own screenshot from Vercel and replace the caption with:

**Figure 4.22: Kitchen reminder readiness, recorded email checks and reminders waiting.**

Replace the explanation with these paragraphs:

The reminder monitor displays the kitchen’s email setup, the latest recorded processing check and the number of eligible reminders waiting at the time of refresh. In Figure 4.22, the deployed system reports that the email setup is ready. The latest completed check recorded no email attempt, while the displayed waiting count is zero. These are separate observations at the timestamps shown. Configuration readiness and a completed check without a send do not establish successful email delivery. The recency warning indicates that no check has been recorded within the last 15 minutes and that the sending schedule should be reviewed.

Customer accounts use a name, phone number and passkey and do not require an email address. Entering a phone number does not subscribe a customer to automated SMS or WhatsApp messages. Customer handover is coordinated through the available contact routes, while these email reminders are for the kitchen. Reminder processing depends on the configured schedule running successfully; refreshing the status does not send an email.

The first paragraph describes the status you supplied on 9 November 2026. If your new Vercel screenshot shows a different queue count, outcome or recency state, update those state-specific sentences to match the new screenshot. The zero waiting count from the later refresh does not establish why the earlier check attempted no email.

## Why the earlier reminder image showed setup needed

The earlier screenshot came from an isolated local environment without the Vercel SMTP/owner-recipient configuration. It did not establish that the deployed configuration was missing. The deployed “Email setup ready” label detects configuration; it does not itself validate credentials, confirm a continuously running schedule or prove inbox delivery. No credentials are needed to write a factual account of the status you supplied, and none should be included in the report.

Only Figure 4.7 in the current report displays the receiving payment QR. Figure 4.16 displays the payment-proof link; Figure 4.21 displays delivery hours and fees. Those two figures do not need replacement solely because the receiving QR changed.
