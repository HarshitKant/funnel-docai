# Detailed Report + Free/Paid Plans (based on Twishmay's suggestions)

Goal: turn the tool into a money-maker. Free users see a useful preview; paying users unlock the most valuable parts of a detailed report. Hospital (WhatsApp booking) funnels become a built-in use case alongside general funnels.

## 1. Brand and domain
- No change: the FunnelDoc name stays, and no domain is bought for now.


## 2. Detailed report with free preview
Each run produces one full report with these sections:

```text
FREE (visible to everyone)          PAID (locked, blurred preview)
- Summary of what changed           - Full "Check this next" plan: exact steps,
- Evidence Readiness rating           data to pull, owner, effort
- What the data shows (Known)       - All competing explanations with evidence
- Top 1 explanation (headline only)   for/against and "what would disprove it"
- 1 missing-evidence item           - Full missing-evidence list + why it matters
                                    - Implementation checklist and 30-day
                                      investigation roadmap
                                    - Downloadable PDF report
```

- Locked sections show a blurred placeholder and an "Unlock full report" button.
- Important: locked content is never sent to a free user's browser, so it cannot be revealed by inspecting the page.

## 3. Two plans + paywall
- **Free**: 3 reports per month, preview sections only.
- **Pro**: full reports, unlimited runs, PDF download, hospital mode. Proposed price: $19/month, or a single report for $9. (Final prices are your call; the existing $5 unlock would be retired.)
- Sign-in comes back (email + Google), because paid access must be tied to an account.
- Payments via the existing Paddle setup; subscription start, renewal, cancellation (access until period end) and failed-payment handling are all covered.

## 4. Hygiene factors (Twishmay's five)
1. **Security**: plan checks and report locking happen on the server; limits cannot be bypassed; input length limits on every field; no secrets in the browser.
2. **Safety**: patient chats or personal data pasted in are not stored; a warning asks users to remove names and phone numbers before submitting; no medical advice is ever given.
3. **Moral / legal / ethical**: updated Terms, Privacy and Refund pages under the new brand; clear disclosure that output is AI-assisted and not professional advice; no dark patterns on the paywall.
4. **Logical**: keep the strict Known / Assumed / Unknown separation, calculated readiness rating and depth checks already built.
5. **Explainable**: every item tagged "Calculated" or "AI-generated", plus a short "How this report was produced" section in each report.

## 5. Hospital mode (from the files you shared)
- A mode switch: "General funnel" or "Hospital – WhatsApp booking".
- Hospital mode adds stage counts (greeting to booked), the 10 leak reasons from the spreadsheet, and optional spreadsheet upload that fills the form automatically.
- The shared WhatsApp dataset is used as the first test case.

## Build order
1. Brand name + domain choice (needs your pick).
2. Sign-in, Free/Pro plans, paywall.
3. Detailed report with locked sections + PDF.
4. Hygiene updates (legal pages, safety notices, explainability).
5. Hospital mode + test on your dataset.

## Technical details
- Auth: restore email/password + Google; `requireSupabaseAuth` on the report server fn.
- Tables: `subscriptions` (Paddle, environment-filtered), reuse `purchases` for single reports, `investigation_runs` for monthly free quota; RLS + grants.
- Paddle: new products `pro_monthly` (subscription) and `single_report` (one-time); webhook extended for subscription.created/updated/canceled and transaction.completed.
- Server fn returns a redacted report object for free users (paid sections stripped server-side); full object for Pro/single-report owners.
- PDF generated client-side from the full report only for entitled users.
- Hospital mode: `mode` input, hospital prompt block and hospital scoring signals; spreadsheet parsed in browser with SheetJS; stage math computed in code.
- Model stays `openai/gpt-6-astra`, high reasoning.

## Needs your input
- Final prices (defaults above).
- Pick of brand name/domain from the shortlist I will show.
