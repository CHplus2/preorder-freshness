# Presentation, poster and demo guide

## What your report actually says

Sections 1.1–1.2 describe short advance-ordering windows in the reviewed delivery platforms and manually coordinated dates in WhatsApp. Section 2.2.5 and Table 2.3 specifically list GrabFood as up to two days and foodpanda as up to one day. The comparison also includes WhatsApp and McDonald's as a single-vendor reference.

Those are statements in your report, not a new verification of every service available today. Features can vary by region, vendor and platform version. Do not say “Grab cannot preorder beyond one day.” If asked for a current limit, use dated official documentation or a dated observation from the relevant local app. The supplied chapter does not establish that you performed a controlled hands-on platform test, so do not describe it as one.

“Platforms reviewed” means the systems compared in the literature/existing-system review. It does not mean the project proved that all home businesses struggle with them. Safer spoken wording is: “My review identified limited integration between flexible preorder dates, ingredient expiry records and independent storefront presentation in the selected systems.”

GrabFood and foodpanda do offer sales analytics. Your gap is the integration and suitability of the required functions for this home-kitchen case study, not that established platforms have no analytics. Malaysian food-poisoning reports motivate attention to ingredient handling; they are not proof that all cases involved home businesses or that expiry-date software prevents poisoning.

## Timing and presentation strategy

The supplied briefing does not establish your speaking time or a Q&A allocation. The supplied senior report is not evidence of a duration either. The included deck is therefore a provisional ten-minute talk, including a two-minute demo. Confirm the actual limit before rehearsal; A1 poster size has been confirmed by the author.

Retain the useful hackathon structure: problem → solution → mechanism → demonstration. For FYP, add the objectives, client-led development decisions, design, testing, evidence and limitations. Extra time should improve explanation and evaluation rather than simply add more feature descriptions.

Two main feature stories are sufficient: the customer preorder journey and the owner's date-based ingredient records. The mechanism connects them through accepted orders and ingredient/packaging allocation. Locate sales, branding and recommendations within the five objectives and show them briefly. Keep technical detail ready for questions.

A demo does not have to be literally last. The included deck places it before testing, limitations and a short conclusion, so you can explain what the audience has just seen. The five-minute alternative uses a ninety-second walkthrough and a short closing summary. A business plan is a backup topic unless your assessment explicitly requires it.

For fifteen minutes, spend the extra time on design choices, a concrete test case and actual user findings if collected. Do not invent results to fill the slot.

## Use with Gamma

1. Open Gamma's text-paste presentation creation flow and paste Gamma_10min_Paste.txt.
2. Preserve the supplied objective wording and the slide separators. Review any AI rewriting before using it.
3. Choose a clean 16:9 layout with forest green, cream and restrained warm-gold accents. The included PPTX/PDF show the intended layout.
4. Upload the supplied screenshot assets where the text names an image. Gamma cannot obtain an image merely from a local filename in the pasted text. Do not ask it to generate replacement UI screens.
5. Use Speaker_Script_10min.md or the Word/PDF script for rehearsal. The main PPTX also contains speaker notes.
6. Keep the video file available locally. Test how your actual presentation setup launches it before showcase day.

Gamma is not connected to this session. The files are ready to paste/import; no deck was written into your Gamma account.

## Demo sequence and fallbacks

The preferred order is live walkthrough → recorded video → screenshot fallback. These are alternatives for one demonstration, not three demonstrations to play in full.

- Have a customer account and the staff session ready in separate browser profiles. Avoid spending the demo time searching for a password or troubleshooting device prompts.
- Use an offered date and a stocked basket. Show the accepted total, receipt-evidence distinction and resulting ingredient/packaging balances.
- For the freshness story, show how date evidence produces a planning deadline and how held/past-date batches are excluded.
- If the live flow cannot continue after about ten seconds, switch once to the local video. Do not debug a deployment during the talk.
- If the video cannot play, use Screenshot_Fallback.pdf or .pptx. Each page corresponds to a step and contains a short explanation.
- Keep the PDF deck, MP4 and screenshots offline on the laptop, plus a second copy on a USB drive or other local storage. Check projector resolution and speaker volume.

Ninety-second live variant: menu/basket (10 s), prepared-account checkout date/area/total (25 s), evidence and order confirmation (15 s), ingredient/packaging balance (20 s), date-record rule and report overview (20 s). Skip optional account setup and a detailed finder tour in that shorter slot.

The supplied video is an edited current local application walkthrough with example records. It combines screen recordings with held screenshots from the same session so the explanation stays readable. It uses a virtual passkey device for account creation and an illustrative receipt. It is not footage of an actual bank transfer, physical handover, genuine client stock count or live Vercel customer order. The observed local chicken balance changes from 5,000 g to 4,870 g, and the salad-bowl balance from 200 to 199.

## Voiceover and editing

Demo_120s_Narrated.mp4 now uses the Kokoro v1.0 af_heart neural voice with conversational narration and matching captions. Demo_120s_Natural_Voice.mp4 is the same updated video under a new filename. Natural_Voice_Preview.mp3 samples the main voice; Bright_Voice_Preview.mp3 offers the brighter af_bella alternative. Neither is a claimed exact TikTok voice. Demo_120s_Silent.mp4 is for your live narration. The WAV, TXT and SRT files allow further editing. The stock synthetic voice is not the author's or client's voice.

No third-party editing app is connected here. The deliverables were assembled locally using browser recording and FFmpeg. Some editors expose APIs or MCP connectors, but using one requires an available connector and the account's permissions. This package does not claim CapCut, Premiere, DaVinci Resolve or Gamma access.

To edit in an app, import the MP4 or the source clips, add your own recorded voice, and import the SRT captions. You do not need to keep the synthetic voice. Do not speed up your spoken explanation merely to fit every screen; remove secondary steps first.

## A1 poster

Use FYP_Poster_A1.pdf for printing at actual A1 size: 594 × 841 mm, portrait. The PNG is a preview/raster alternative. FYP_Poster_A1_Editable.pptx allows edits to text, shapes and images. No official university logo has been invented; replace text-only institutional identification with an approved logo if required.

The palette follows the kitchen's green/cream identity. It is an academic poster rather than a cryptocurrency dashboard or a product advertisement. The QR links to the public menu, not a payment page. Screenshots use example records and illustrative food graphics.

## Questions to practise

**Why a dedicated system rather than WhatsApp?**
Explain the structured date, total and stock checks and the connection to the kitchen's own records. Messaging remains useful for contact; the system adds the missing structure identified in the case study.

**Is a passkey the phone number?**
No. The number is contact information and is not verified by SMS. The passkey authenticates access through a supported device. The website does not receive fingerprint or face templates.

**Does expiry status prove freshness?**
No. It follows recorded dates, durations and holds. It cannot detect contamination or verify storage temperature. The purpose is consistent stock planning and clearer records.

**Does the uploaded receipt make an order paid?**
No. The owner verifies a bank transfer or cash separately. Food-received status is also a separate record.

**Does changing a menu rewrite old orders?**
No. An order line keeps accepted name/price and requirement snapshots as well as its product relationship. This preserves what was ordered at that time.

**Why no automatic courier tracking?**
The current scope uses externally booked delivery and manual coordination. Automatic status needs approved courier integration and reliable events; a timer cannot prove physical handover.

**Have recommendations improved conversion?**
The generation, budget and eligibility rules have been tested. Reduced effort and paid conversion have not been established. Formal client and student evaluation is still pending.

**Is FreshCast accuracy measured on this client?**
No. The retained external benchmark must not be presented as accuracy on genuine client sales. Example development records are not a business forecasting study.

**What is the business plan?**
Describe the single-vendor operating model and likely recurring hosting, maintenance and delivery costs if asked. Do not invent validated prices, customers, revenue or a market-size estimate. Technical evidence is the priority for this FYP presentation unless the rubric says otherwise.

## Before the final presentation

Confirm the actual time limit and whether Q&A is included. Replace pending evaluation statements only after genuine responses are available. Check the client menu, recipe estimates, packaging and area fees. Rehearse to the allowed duration and keep optional details for questions.
