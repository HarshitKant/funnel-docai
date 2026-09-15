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

DEPTH FLOOR (a response that misses any of these is invalid):
- At least 2 "unknown" items, each with a non-empty "why".
- At least 2 hypotheses whenever the supplied evidence permits more than one plausible explanation; each hypothesis MUST have a non-empty "falsified_if" and at least one item in both "evidence_for" and "evidence_against" (using the exact no-contradiction sentence from guardrail 6 when nothing genuinely weakens it).
- Hypotheses must be genuinely competing explanations, not restatements of each other.
- next_check MUST have a non-empty "requires" list, a "tests" list naming the hypothesis ids it discriminates between, and 2-3 "unlocks" lines.

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

const MODEL = "openai/gpt-6-astra";

type Signals = {
  numbers: boolean;
  timing: boolean;
  detail: boolean;
  segment: boolean;
  diagnostic: boolean;
  context: boolean;
};

/**
 * Deterministic Evidence-Readiness scoring.
 * The level is computed in code from countable properties of the SUPPLIED input
 * plus how many discriminating unknowns remain, so the same input always yields
 * the same level. The model only explains the input; it never sets the level.
 */
function scoreEvidence(
  data: z.infer<typeof InputSchema>,
  unknownCount: number,
): { level: "Strong" | "Partial" | "Weak"; reason: string; signals: Signals; score: number } {
  const evidence = data.evidence.trim();
  const haystack = `${data.change} ${evidence} ${data.context}`;

  const signals: Signals = {
    // Both endpoints of the change are quantified.
    numbers: /\d/.test(data.before) && /\d/.test(data.after),
    // The change is located in time.
    timing: data.when.trim().length > 0,
    // Some substantive observation was supplied, not a one-liner.
    detail: evidence.length >= 80,
    // The change is narrowed to a slice of users/traffic.
    segment:
      /\b(android|ios|web|desktop|mobile|browser|safari|chrome|region|country|locale|device|segment|cohort|version|release|build|channel|campaign|source|plan|tier|new users|returning)\b/i.test(
        haystack,
      ),
    // Some diagnostic trace exists beyond the metric itself.
    diagnostic:
      /\b(error|errors|log|logs|ticket|tickets|support|crash|latency|timeout|spinner|failure|5\d\d|4\d\d|deploy|deployment|release|experiment|a\/b|test|survey|session recording|drop-?off|step)\b/i.test(
        `${evidence} ${data.change}`,
      ),
    // Enough product context to reason about mechanism.
    context: data.context.trim().length >= 40,
  };

  const present = Object.values(signals).filter(Boolean).length;
  const score = present;

  let level: "Strong" | "Partial" | "Weak";
  if (score >= 6 && unknownCount <= 1) level = "Strong";
  else if (score <= 2) level = "Weak";
  else level = "Partial";

  const missing = (Object.keys(signals) as (keyof Signals)[]).filter((k) => !signals[k]);
  const MISSING_LABEL: Record<keyof Signals, string> = {
    numbers: "before/after values",
    timing: "when the change happened",
    detail: "substantive observations",
    segment: "which segment is affected",
    diagnostic: "diagnostic traces (errors, tickets, funnel steps)",
    context: "product context",
  };

  const reason =
    `${present} of 6 evidence signals supplied and ${unknownCount} discriminating ${
      unknownCount === 1 ? "unknown" : "unknowns"
    } still open` +
    (missing.length
      ? `. Missing: ${missing.map((k) => MISSING_LABEL[k]).join(", ")}.`
      : ". No evidence signals missing.");

  return { level, reason, signals, score };
}

/** Depth floor: returns the reasons a response is too thin, or an empty array. */
function depthViolations(p: any): string[] {
  const v: string[] = [];
  const unknowns = Array.isArray(p.unknown) ? p.unknown : [];
  if (unknowns.length < 2) v.push("Provide at least 2 unknown items.");
  if (unknowns.some((u: any) => typeof u === "string" || !String(u?.why ?? "").trim()))
    v.push('Every unknown item needs a non-empty "why".');

  const hyps = Array.isArray(p.hypotheses) ? p.hypotheses : [];
  if (hyps.length < 2) v.push("Provide at least 2 genuinely competing hypotheses.");
  if (hyps.some((h: any) => !String(h?.falsified_if ?? "").trim()))
    v.push('Every hypothesis needs a concrete "falsified_if".');
  if (hyps.some((h: any) => !(Array.isArray(h?.evidence_for) && h.evidence_for.length)))
    v.push('Every hypothesis needs at least one "evidence_for" item.');
  if (hyps.some((h: any) => !(Array.isArray(h?.evidence_against) && h.evidence_against.length)))
    v.push('Every hypothesis needs "evidence_against" (use the no-contradiction sentence when none exists).');

  const nc = p.next_check ?? {};
  if (!(Array.isArray(nc.requires) && nc.requires.length))
    v.push('next_check needs a non-empty "requires" list.');
  if (!(Array.isArray(nc.tests) && nc.tests.length)) v.push('next_check needs a "tests" list.');
  if (!(Array.isArray(nc.unlocks) && nc.unlocks.length >= 2))
    v.push('next_check needs 2-3 "unlocks" lines.');

  return v;
}

function stripFences(text: string) {
  let clean = String(text).trim();
  if (clean.startsWith("```")) {
    clean = clean.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  }
  return clean;
}

/**
 * Reasoning model call on the gateway Responses API.
 * Always streamed: reasoning runs can take minutes, and a buffered request
 * would be severed by the platform request timeout.
 */
async function callModel(apiKey: string, userContent: string): Promise<string> {
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: MODEL,
      input: [
        { role: "system", content: [{ type: "input_text", text: PROMPT }] },
        { role: "user", content: [{ type: "input_text", text: userContent }] },
      ],
      stream: true,
      store: false,
      reasoning: { effort: "medium", summary: "auto" },
    }),
  });

  if (!resp.ok || !resp.body) {
    const text = await resp.text().catch(() => "");
    throw new Error(`AI gateway ${resp.status}: ${text.slice(0, 200)}`);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let out = "";
  let completed = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      for (const line of part.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const evt = JSON.parse(payload);
          if (evt.type === "response.output_text.delta" && typeof evt.delta === "string") {
            out += evt.delta;
          } else if (evt.type === "response.completed") {
            const texts = (evt.response?.output ?? [])
              .flatMap((item: any) => item?.content ?? [])
              .filter((c: any) => c?.type === "output_text")
              .map((c: any) => c.text)
              .join("");
            if (texts) completed = texts;
          }
        } catch {
          // ignore keep-alive / non-JSON frames
        }
      }
    }
  }

  return (out || completed).trim();
}

export const investigateMetricChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

    const { supabase, userId } = context;

    // Server-side entitlement gate: free runs, then a one-time unlock.
    const [{ count }, { data: purchases }] = await Promise.all([
      supabase
        .from("investigation_runs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
      supabase
        .from("purchases")
        .select("id")
        .eq("user_id", userId)
        .eq("environment", data.environment)
        .eq("status", "completed")
        .limit(1),
    ]);

    const unlocked = (purchases?.length ?? 0) > 0;
    if (!unlocked && (count ?? 0) >= FREE_RUN_LIMIT) {
      throw new Error("PAYMENT_REQUIRED");
    }

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

    const baseContent = `${lines}\n\nRespond with ONLY valid JSON. No other text.`;

    let parsed: any = null;
    let lastError = "";

    // One retry when the reply is malformed or thinner than the depth floor.
    for (let attempt = 0; attempt < 2; attempt++) {
      const content =
        attempt === 0
          ? baseContent
          : `${baseContent}\n\nYour previous response was rejected for insufficient depth. Fix these problems and return the full JSON again:\n- ${lastError}`;

      const text = await callModel(apiKey, content);
      if (!text) {
        lastError = "Empty response.";
        continue;
      }

      let candidate: any;
      try {
        candidate = JSON.parse(stripFences(text));
      } catch {
        lastError = "Response was not valid JSON.";
        continue;
      }

      if (!candidate.known || !candidate.hypotheses || !candidate.next_check) {
        lastError = "Missing known, hypotheses or next_check.";
        continue;
      }

      if (Array.isArray(candidate.hypotheses)) candidate.hypotheses = candidate.hypotheses.slice(0, 3);

      const violations = depthViolations(candidate);
      if (violations.length && attempt === 0) {
        lastError = violations.join("\n- ");
        parsed = candidate; // keep as fallback if the retry fails too
        continue;
      }

      parsed = candidate;
      break;
    }

    if (!parsed) throw new Error(`Incomplete AI response: ${lastError}`);

    // Evidence Readiness is computed in code, never taken from the model.
    const unknownCount = Array.isArray(parsed.unknown) ? parsed.unknown.length : 0;
    const scored = scoreEvidence(data, unknownCount);
    parsed.evidence_strength = {
      level: scored.level,
      reason: scored.reason,
      signals: scored.signals,
      signals_present: scored.score,
      signals_total: 6,
      computed: true,
    };

    // Only successful investigations consume an allowance.
    await supabase.from("investigation_runs").insert({ user_id: userId });

    return parsed;
  });
