# FunnelDoc Hospital Mode (WhatsApp appointment funnel)

Note: Twishmay's written suggestions never came through (the message cut off at "Twishmay (Ex-Boss"). This plan is based on the three files shared: the WhatsApp funnel summary, the evidence sheet, and Ashima's note. When her points arrive, the plan will be updated to match them.

Default scope: build Hospital Mode, and use the uploaded WhatsApp data as the first real test case.

## What the user will see

1. **Mode switch** at the top of the input screen: "General" (the current tool, unchanged) or "Hospital – WhatsApp booking".
2. **Hospital input form** in place of the generic fields:
   - Funnel stages with counts (e.g. Greeting → Intent captured → Registration → Doctor/slot selected → Payment/confirmation → Booked), editable and pre-filled with a typical path.
   - Period and channel (WhatsApp bot, agent handoff).
   - Tagged leak reasons with counts (the 10 leakage types from the sheet, such as registration wall, agent handoff delay, no slot available), plus free-text evidence (sample chats, agent notes).
3. **Upload the spreadsheet** instead of typing: drop the summary Excel file and the stages, counts and leak tags fill in automatically. Nothing is sent until the user presses run.
4. **Hospital-aware results**, same layout and style as today:
   - Evidence Readiness (still calculated, not guessed), with hospital-specific signals: stage counts present, leak reasons tagged, sample chats supplied, slot/doctor availability data, agent response times.
   - Evidence Ledger (Known / Assumed / Unknown) that separates "patients dropped at registration" (known) from "registration is too long" (assumed).
   - Up to 3 competing explanations per major leak, e.g. patient intent vs bot design vs real slot shortage.
   - One "Check this next" investigation, never a fix, never a medical judgement.
5. **Patient-safety guardrails**: no clinical advice, and sample chats are shown only in the user's own browser session — nothing stored.

## Test case
Run the uploaded Medanta-style data through Hospital Mode and check that the result: names the right biggest leaks from the numbers, does not blame the largest drop-off by default, and marks what the chats prove vs don't prove.

## Technical details
- `src/routes/index.tsx`: add mode toggle; hospital form section reusing existing styles; spreadsheet upload parsed in the browser (SheetJS `xlsx`) mapping sheet columns to stages/leak tags.
- `src/lib/investigate.functions.ts`: add `mode` input; a hospital rule block appended to the existing prompt (taxonomy of 10 leak types, stage definitions, no clinical advice); hospital variant of `scoreEvidence` with 6 hospital signals; same depth floor and model settings.
- Stage arithmetic (step conversion, share of total loss per leak tag) computed in code and passed as Known facts, so the model never does the math.
- No new pages, no database changes, no sign-in.

## Open questions
- Twishmay's exact suggestions (needed to finalise priorities).
- Who uses it: your team only, or hospital staff directly.
