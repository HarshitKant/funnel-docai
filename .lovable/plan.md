# No code change — explanation only

The last request was an explanation of the project (what it does, why it's built this way, how the red test works, how the intelligence layer works, and whether it uses anything beyond user input). The full answer was given in chat.

## Current state (no changes proposed)

- FunnelDoc takes a PM's description of a metric change (1 required field, 6 optional) and returns a Funnel Preflight report: verdict on the user's hypothesis, evidence ledger (Strong/Partial/Weak), up to 3 ranked competing hypotheses with falsification conditions, one concrete next check, and a code-computed readiness rating.
- Trust-critical logic (readiness rating, hypothesis ranking, quota) is deterministic code; the AI only generates and grades reasoning.
- Paid sections are stripped server-side for free users (3 reports/month preview; Pro $10/month via Paddle).
- The analysis uses only typed user input — no external data sources or integrations.

## If you want a follow-up

Possible next steps, only on request:

1. Verify the hypothesis ranking in a real report run in the preview.
2. Revisit the parked MCP/agent integrations to pull real analytics data.
3. Finish Paddle identity verification to enable live payments.
