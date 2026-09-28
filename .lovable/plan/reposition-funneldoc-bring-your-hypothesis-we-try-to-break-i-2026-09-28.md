# Reposition FunnelDoc: "Bring your hypothesis — we try to break it"

## Goal
Full reposition from "investigation assistant" to **hypothesis red-teamer**. The PM states their own hypothesis plus their evidence; the tool tries to break it: it grades the hypothesis against the evidence, generates rival explanations, and returns a verdict plus the one check that settles it. Existing discipline (Known/Assumed/Unknown, no hypothesis stated as fact, falsification conditions, deterministic readiness) stays untouched.

## Changes

### 1. Input form — `src/routes/index.tsx`
- New optional textarea: **"Your current hypothesis (what you think is going on)"**, with helper copy "State it plainly — the tool will try to disprove it." Left optional: friction stays low (only "What changed?" remains required).
- Sample investigation gains a plausible-sounding hypothesis (e.g. "The new KYC flow's extra verification step is dropping completion") so users see the intended usage.
- Reposition copy: hero subline becomes "You have a hypothesis. FunnelDoc tries to break it before you spend a sprint on the wrong fix."; form title "Red-team your hypothesis"; loading messages ("Trying to break your hypothesis…", "Grading your evidence honestly…", "Building rival explanations…", "Finding the check that settles it…").
- Update `head()` title/description/og to the red-team positioning.

### 2. Analysis prompt — `src/lib/investigate.functions.ts`
- InputSchema: add `userHypothesis: z.string().max(2000).default("")`.
- Prompt additions (only when a user hypothesis is supplied):
  - Treat the user's hypothesis as **H0** and never as fact; if the user appears to treat it as an explanation, it also appears in "assumed" with a caveat.
  - Explicitly evaluate H0: `evidence_for`, `evidence_against`, `falsified_if` — with the same no-invented-contradictions rule.
  - Always generate at least 2 rival hypotheses even when H0 looks plausible; H0 counts as one of the competitors, not the default answer.
  - New output field `user_hypothesis_verdict`: `{"verdict":"Supported|Undermined|Not testable with current evidence","reason":"1-2 sentences","settle":"the observation or check that would settle H0"}`.
  - Without a user hypothesis, output is exactly as today (verdict field null).
- PII scrub extended to `userHypothesis`.

### 3. Result view — `src/routes/index.tsx`
- New top card when a hypothesis was supplied: **"Verdict on your hypothesis"** — verdict badge (color-coded: Supported green, Undermined red, Not testable amber), the reason, and a "Settled by: …" line. This card is the repositioned product's headline output.
- Result type extended accordingly; rendering stays null-safe when no hypothesis was given.

### 4. Free/Pro redaction (server-side, unchanged principle)
- `redactForFree` **keeps the verdict card visible** (it is the hook that sells Pro) and continues to lock rival hypotheses detail, assumed list, checklist, roadmap and the next check exactly as today. Paid content is still stripped server-side.

## What stays
Free (3 preview reports/month) / Pro ($10/month) plans, quota logic in `access.server.ts`, deterministic evidence scoring, PII scrub, Paddle wiring, sign-in, legal pages.

## Verification
- Build passes; submit the sample case (with hypothesis) in the preview via Playwright and confirm: verdict card renders, rival hypotheses present, free redaction still locks paid sections, verdict survives redaction.
