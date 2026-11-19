# Critical analysis: FunnelDoc vs GPT on the microlending eligibility drop

## Verdict in one line
GPT gave a wider list of reasons. FunnelDoc gave a better order of work but a thinner, harder-to-read report, and the ranking was broken on this case.

## Where FunnelDoc won
- **Metric check first.** It asks whether 38% and 30% count the same users over the same time window before explaining anything. GPT lists this as reason #8, but FunnelDoc makes it step one.
- **Discipline.** It keeps facts separate from guesses. It catches one hidden assumption ("the eligibility drop caused fewer loans"). Every explanation comes with a "would be falsified if" test.
- **One decision.** It names one next check (mix shift vs. rule/process change), says what each result would mean, and gives a 4-week plan. GPT gives an order, but no "if X, then Y".
- **Honesty.** It says the evidence is partial and doesn't claim a cause.

## Where GPT won (and this is what an interviewer will notice)
1. **Breadth: 8 reasons vs 2.** GPT covered stricter rules, KYC/bank-link drop-off, bureau/GST/API failures, lending-partner limits, borrower financial health, and tracking or cohort bugs. FunnelDoc merged all of these into one vague "changed eligibility assessment". For a red-team tool, too few rivals is the core failure.
2. **No domain knowledge.** There is no KYC, credit bureau, lender partner or underwriting version anywhere. It reads as if it could be about any funnel.
3. **Readability.** "Pre-decision segments", "reweight the later period" and "population reweighting reproduces the aggregate decline" read like a stats paper. GPT's worked example (10,000 → 3,800 vs 3,000, which is 21% fewer qualifiers) is clearer at a glance.
4. **Signs of a sudden vs gradual drop.** GPT's "a sudden drop points to a release or rule change, a gradual one to mix" is a cheap, sharp test. FunnelDoc missed it.

## Bugs this report exposed
- **The ranking did nothing.** Both explanations show "0 from your input, 1 inferred". H1 shows no score and H2 shows "score 1", so the order came from the label, not the evidence. The word-matching is too strict, because the AI rewords what the user typed.
- **Only 2 explanations.** The depth floor allows 2 and the prompt caps at 3. That is too few for a case this open.
- **No user hypothesis was given**, so the core "break your hypothesis" feature never ran. This test compared FunnelDoc on GPT's home ground ("list possible reasons").
- **The readiness meter says "which segment is affected" is missing.** That is correct, but it doesn't tell the user what to add.

## Proposed fixes
1. Raise the minimum to 3 rival explanations and the maximum to 5. Require at least one each for: measurement/tracking, user mix, process/rule change, and external/partner causes.
2. Add a domain step: the model first names the likely mechanisms for this industry (for lending: KYC, bureau, underwriting rules, partners), then builds the rivals from them.
3. Add a "plain-English" rule: no stats jargon, plus one worked number example from the user's figures (computed in code, like the 21% relative drop).
4. Fix ranking matching: also count shared numbers and stage names, loosen the 2-word rule, and always show the score, including 0.
5. Add a "sudden or gradual?" quick check to the next-check options.
6. Make the hypothesis box more prominent and nudge users when it is empty ("Add your hunch — FunnelDoc works best when it has something to break").

## Technical details
- `src/lib/investigate.functions.ts`: PROMPT (hypothesis count, category coverage, domain step, plain language), `depthViolations` (min 3, category check), `rankHypotheses` (grounding rule), add a computed relative-change fact next to `stageFacts`.
- `src/routes/index.tsx`: always render the score, add the empty-hypothesis nudge.
- Re-run this exact lending case and compare with GPT side by side.
