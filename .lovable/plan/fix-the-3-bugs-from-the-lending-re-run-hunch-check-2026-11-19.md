# Fix the 3 bugs from the lending re-run + hunch check

## What changes for the user
1. **All explanations show.** Reports show every explanation the AI writes (up to 5), so "H3/H4 strengthens" never points at something missing.
2. **Ranking means something.** The shared headline fact ("38% to 30%") no longer counts as support for every explanation. Only evidence that tells explanations apart moves the score, so ties stop being the norm.
3. **Numbers typed in the text count.** "Fell from 38% to 30%" in "What changed" counts as before/after values, and the worked example ("per 10,000, 3,800 becomes 3,000") appears.
4. **Hunch check.** If the hunch just repeats what changed (no cause), a note asks for a cause before running ("e.g. 'the new bureau check rejects thin-file borrowers'"). The user can still run anyway.

## Technical details
- `src/routes/index.tsx`: remove `hypotheses.slice(0, 3)`; add a hunch-restates-change warning (word overlap with "What changed" and no cause words like because/due/after/caused/new/rule).
- `src/lib/investigate.functions.ts`:
  - New `extractBeforeAfter(change)` helper: pulls the first two percentages or numbers from the text when the before/after boxes are empty. `scoreEvidence` and the relative-change fact use it.
  - `rankHypotheses`: a supporting point that only restates the headline metric (overlaps only the change line's numbers/words, appears in 2+ hypotheses) counts 0. Every score still shows, including 0.
  - Prompt: each hypothesis's evidence_for must name something specific to that explanation, never just the headline change. If the hunch only restates the change, H0 is not added as a rival; the verdict says so.
- Tests in `src/lib/` (node:test): before/after extracted from "38% to 30%"; a shared headline point scores 0; 5 hypotheses are kept.
- Re-run the lending case in the preview and check that 4-5 explanations appear with different scores.
