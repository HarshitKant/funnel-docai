# Add "Why not just ChatGPT?" to the homepage

## What the user sees
On the input view, below the form, a compact card titled **"Why not just ChatGPT?"** with three side-by-side points (stacked on mobile):

1. **ChatGPT agrees with you. FunnelDoc tries to disprove you.** Your hunch is one suspect among 3–5 rivals.
2. **ChatGPT gives a list. FunnelDoc gives a decision.** Ranked explanations and one check, with "if you see X, do Y".
3. **Scores follow fixed rules, not the AI's mood.** Same logic every run, and every score can be explained.

Closing line: "Same kind of AI underneath — the difference is the discipline around it."

Hidden in the printed PDF (no-print), shown only on the input view.

## Technical details
- `src/routes/index.tsx`: add the card after the input form card inside `view === "input"`, reusing the existing `card` / `sectionTitle` / `sectionSub` styles; CSS grid `repeat(auto-fit, minmax(200px, 1fr))`.
- No logic or server changes.
- Check with Playwright at desktop and mobile widths.
