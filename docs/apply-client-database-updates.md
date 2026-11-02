# Apply the client database updates

A **migration** updates the database structure, such as adding packaging tables
or a payment-proof table. **Pending** means that update has not been run on the
target database. Publishing code to GitHub does not update Supabase.

You can use Supabase's web editor instead of a terminal or local DATABASE_URL.

1. Keep a private backup of the target database before making schema changes.
2. Open your **Preorder and Freshness** project in Supabase → **SQL Editor** →
   **New query**.
3. Open `deploy/sql/apply_client_updates_0024_to_0026.sql` from the tested
   `integration/dormathon-demo` release. Copy the **whole file**, including BEGIN
   and COMMIT. On GitHub use **Copy raw file**, rather than copying page navigation.
4. Paste it into the new Supabase query and click **Run**.
5. The final result must list three rows: `0024_packaging_stock`,
   `0025_simple_ordering`, `0026_guest_qr_fulfilment`.

The script checks that 0023 is already applied, then applies 0024, 0025 and 0026 in
order. Completed steps are verified and skipped. The transaction rolls back if a
step fails. It does not deduct stock, change order statuses, upload payment QR
images or mark payments received. Keep the full error if it stops; do not remove
guards, disable RLS or manually insert migration records to force success.

This updates the database only. The matching application code must still be
deployed before the new features appear. No git pull or terminal command is
needed for this SQL Editor route. Main/production has not been updated by the
integration source commits.

# Upload a receiving QR after deployment

In Settings → Manual payments, choose **Upload receiving QR image**. Select the
Maybank image, keep **Maybank receiving card · QR only**, and check the preview.
It must contain the entire QR and a white border, with the printed name outside
the selected square. Adjust the crop for a differently arranged export.

Choose **Use this QR crop**, then **Save settings**. The application stores only
the selected crop as a lossless image; it does not resize or regenerate the QR.
The original card is not published. No new database migration is needed for this
upload feature; it reuses the existing 0022 image table.

Scan the saved QR in the banking app and check the recipient before accepting
payments. Customers can scan it, or use their banking app's image-import option
where supported. Bank recipient confirmation can still display your name even
when the website's printed heading is removed. This is a real receiving QR when
you use your actual bank image. QR image URLs remain supported as an alternative,
but an external image is displayed as supplied and is not automatically cropped.

The developer has not uploaded the real Maybank card, committed it to GitHub,
changed the production database or sent a payment. Owner receipt verification
remains manual; uploading a receipt does not mark an order paid.
