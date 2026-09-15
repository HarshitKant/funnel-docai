import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { FREE_RUN_LIMIT } from "@/lib/access.functions";

const InputSchema = z.object({
  change: z.string().min(1).max(2000),
  context: z.string().max(2000).default(""),
  before: z.string().max(200).default(""),
  after: z.string().max(200).default(""),
  when: z.string().max(200).default(""),
  evidence: z.string().max(8000).default(""),
  environment: z.enum(["sandbox", "live"]).default("sandbox"),
});

const PROMPT = `You are FunnelDoc — an investigation assistant for product and growth practitioners.
A user reports a metric change and supplies whatever evidence they already have. Your job is NOT to identify a root cause. Your job is to separate evidence from assumptions and uncertainty, and to recommend the single most valuable NEXT INVESTIGATION.

Respond ONLY with valid JSON. No markdown, no backticks, no text outside the JSON.

Core principle: the less evidence you have, the less prescriptive you must be.

Reasoning guardrails (mandatory):
1. Correlation is never presented as causation.
2. "known" contains ONLY facts explicitly supplied by the user or deterministic calculations from supplied numbers (e.g. a percentage-point delta). It answers "what can we confidently say happened?". NEVER put missing-data statements in known (e.g. "vendor latency has not been checked yet" belongs in unknown). NEVER put a causal claim in known.
3. "assumed" contains ONLY unproven causal/interpretive claims the USER or their context already appears to treat as an explanation. Keep it small (0-2 items). Do NOT copy your own generated hypotheses here — those belong only in "hypotheses". Each item needs a short caveat explaining why the supplied evidence does not establish it.
4. "unknown" contains missing EVIDENCE that would discriminate between competing explanations — never speculative causes. Each item is {"item":"short name of the missing evidence","why":"one short line on what it would distinguish"}.
5. Generated hypotheses appear only under "hypotheses". Maximum 3, fewer is fine when evidence is thin.
6. Absence of evidence is NOT automatically evidence against a hypothesis. Never invent contradictions to fill "evidence_against". Only include items that genuinely weaken the hypothesis; if none exist, evidence_against MUST be exactly ["No contradictory evidence supplied yet."].
7. "evidence_for" only includes evidence that genuinely raises plausibility.
8. Every hypothesis needs "falsified_if": one concrete, testable observation that would materially weaken or eliminate it.
9. Do NOT recommend product fixes or features. Only investigations.
10. It is fully acceptable to state that the available evidence is insufficient to determine the cause.
11. Never give generic advice ("improve UX", "talk to users") unless the supplied evidence specifically justifies it.

evidence_strength.level is Strong | Partial | Weak and describes how much the SUPPLIED evidence supports ACTION versus further INVESTIGATION — it is not a confidence score in your own answer. reason is one sentence.

next_check is the single highest-value next investigation: which reasonable next analysis best distinguishes between the leading hypotheses for the least effort. Provide:
- "action": one concrete analysis
- "why": 1-2 sentences
- "tests": the hypothesis ids it discriminates between, e.g. ["H1","H2"]
- "requires": short concrete list of data needed, e.g. ["Funnel-step data","App version","OS","Client errors"]
- "estimated_effort": Low | Medium | High (heuristic)
- "unlocks": 2-3 short conditional lines of the form "If X → H1 strengthens." explaining what the user will learn.
At most ONE alternative check. Keep every item short and scannable.

JSON schema (follow exactly):
{"summary":"1-2 sentences restating strictly what changed, using only supplied facts","evidence_strength":{"level":"Strong|Partial|Weak","reason":"one sentence"},"known":["fact 1","fact 2"],"assumed":[{"claim":"claim the user treats as an explanation","caveat":"why the supplied evidence does not establish this"}],"unknown":[{"item":"missing evidence","why":"what it would distinguish"}],"hypotheses":[{"id":"H1","name":"short name","summary":"one sentence, tentative phrasing","evidence_for":["..."],"evidence_against":["..."],"falsified_if":"one concrete observation that would materially weaken or eliminate it"}],"next_check":{"action":"the single highest-value next investigation","why":"1-2 sentences","tests":["H1","H2"],"requires":["..."],"estimated_effort":"Low|Medium|High","unlocks":["If ... → H1 strengthens."]},"alternative_check":{"action":"one secondary check","why":"one sentence"}}`;


export const investigateMetricChange = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

    const lines = [
      ["What changed", data.change],
      ["Business / product context", data.context],
      ["Metric before", data.before],
      ["Metric after", data.after],
      ["When the change happened", data.when],
      ["Evidence / observations already available", data.evidence],
    ]
      .filter(([, v]) => String(v).trim())
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-3.7-flash",
        messages: [
          { role: "system", content: PROMPT },
          {
            role: "user",
            content: `${lines}\n\nRespond with ONLY valid JSON. No other text.`,
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`AI gateway ${resp.status}: ${text.slice(0, 200)}`);
    }

    const json = await resp.json();
    const text = json?.choices?.[0]?.message?.content ?? "";
    if (!text) throw new Error("Empty AI response");

    let clean = String(text).trim();
    if (clean.startsWith("```")) {
      clean = clean.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    }
    const parsed = JSON.parse(clean);
    if (!parsed.known || !parsed.hypotheses || !parsed.next_check) {
      throw new Error("Incomplete AI response");
    }
    if (Array.isArray(parsed.hypotheses)) parsed.hypotheses = parsed.hypotheses.slice(0, 3);
    return parsed;
  });
