# FYP presentation and demo

Prepared 9 November 2026 for Christopher Hansen, 2402081406.

The talk follows problem, solution, mechanism, implemented functions, evaluation and a demonstration at the end. The provisional timing is ten minutes: eight minutes of speaking followed by a two-minute video. Questions are outside that timing. Confirm the final duration with the lecturer.

Download the [complete package](FYP_Presentation_Complete.zip), or choose individual files below. The complete package includes both voice editions.

## Start here

- **FYP_Presentation_10min_Female.pptx**: editable main deck with the female-narrated video embedded on slide 13.
- **FYP_Presentation_10min_Male.pptx**: the same slides with the male-narrated video on slide 13. Choose one deck for the presentation.
- **FYP_Presentation_10min.pdf**: static slide preview; PDFs do not play the demo.
- **Demo_120s_Female.mp4** and **Demo_120s_Male.mp4**: matching standalone videos. Each is two minutes, 1920 × 1080, H.264 with AAC audio.
- **Speaker_Script_10min.md / .pdf**: slide timings and rehearsal notes. The notes are also included in both PowerPoint files.
- **Design_Backup_Slides.pptx / .pdf**: use cases, class model and order-placement sequence, outside the timed talk. The diagrams.net sources are in `diagram-sources/`.
- **Screenshot_Fallback.pptx / .pdf**: eight screenshots for presenting the journey if the video cannot be played.
- **Demo_*_Captions.srt**: editable timed captions. Captions are already visible in the MP4s; do not enable a second caption track unless you want duplicate captions.
- **Demo_*_Voiceover.mp3** and **Demo_Narration_Script.txt**: separate narration assets for future editing.

The main deck contains fourteen slides, including the demonstration and questions. It retains all five original objectives. There is no old university logo; add the approved new logo when it becomes available.

## Before presenting

Open the chosen PPTX in desktop PowerPoint, enter Slide Show mode and click the video on slide 13. Rehearse playback and volume on the actual presentation laptop. Embedded media was checked structurally and against the standalone video; native Microsoft PowerPoint playback has not been exercised in this environment. Keep the standalone MP4 nearby. If your presentation software drops the embedded video, insert that MP4 again or play it separately.

PowerPoint text remains editable. In Canva, import the PPTX, then upload and place the matching MP4 on slide 13 if the movie is not retained. Canva may reflow text; compare its result with the supplied PDF. Use the screenshot fallback if necessary.

The typeface is **Liberation Sans** (Arial-compatible). Theme colours are forest green `#234B37`, cream `#F8F6EE`, body text `#283D30` and muted text `#5E6D61`. Standard slide titles are 33 pt; body text is usually 21–25.5 pt, the five full objectives use 18.75 pt, and the cover title is 42 pt. Select the existing text box to retain its exact size when editing.

## Content to update after evaluation

Slide 11 and its notes explicitly mark formal client acceptance and the participant survey as pending. Replace these statements only after genuine results have been collected and analysed. The deck reports the recorded backend run of 1,049 passing PostgreSQL-backed tests on 9 November 2026, with later interface checks described separately. Those results are not a participant survey or proof of improved conversion. If a new test run changes the count, update the slide and notes together.

The five original objective statements remain unchanged. The claim of reducing decision fatigue and improving conversion is an objective, not a measured result in this package.

## Recording context

The footage is an actual browser recording of the current application source running locally, captured on 9 November 2026 at a 1366 × 768 laptop viewport. The page is scaled proportionally into the 1080p video. Chapter labels and captions sit outside the page image. Interactions are edited to the two-minute timeline, with final-frame holds where appropriate; website screens were not drawn or regenerated.

The isolated local example database uses the supplied client menu photographs and the user's receiving QR uploaded through local Settings. The receipt is a sample; no real bank transfer or customer order was made. A virtual browser authenticator completes the demonstration passkey flow. This records implemented functionality, not a live production transaction or deployment verification.

The new preorder deducts 130 g of chicken and one salad bowl: 5,000 g becomes 4,870 g and 200 bowls becomes 199. The Print all preview contains two example order slips. The sales example is a separately prepared paid-and-received record; the newly uploaded receipt was not falsely marked paid.

The video covers browsing, customer account access, date/budget suggestions, checkout and the receiving QR, staff payment review, stock and packaging, batch dates, daily summaries, Print all and sales/cost views. It is a selected two-minute walkthrough, not an exhaustive demonstration of every screen. No forecasting model, application logic, production data or deployment settings were changed for this batch.

## Narration and assets

Both videos use the same script and browser footage. Female narration uses Kokoro `af_heart`; male narration uses `am_michael`, generated locally with Sherpa-ONNX and the existing Kokoro model. These are stock synthetic voices, not recordings or clones of the student or client. Voice timing is adjusted without changing pitch.

Client food photographs and the receiving QR were supplied by the user. Architecture and design diagrams come from the current project report. Model weights, private example databases, raw browser recordings and credentials are excluded from the download.
