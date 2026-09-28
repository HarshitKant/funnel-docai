import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computeAccess } from "./access.server";


const InputSchema = z.object({
  change: z.string().min(1).max(2000),
  context: z.string().max(2000).default(""),
  before: z.string().max(200).default(""),
  after: z.string().max(200).default(""),
  when: z.string().max(200).default(""),
  evidence: z.string().max(8000).default(""),
  userHypothesis: z.string().max(2000).default(""),
  environment: z.enum(["sandbox", "live"]).default("sandbox"),
  stages: z
    .array(z.object({ name: z.string().trim().min(1).max(80), count: z.number().nonnegative().max(1e9) }))
    .max(12)
    .default([]),
  leaks: z
    .array(z.object({ reason: z.string().trim().min(1).max(120), count: z.number().nonnegative().max(1e9) }))
    .max(20)
    .default([]),
});

type Input = z.infer<typeof InputSchema>;

const REPORT_EXTRAS = `
Additionally include in the JSON:
- "checklist": 4-6 short, concrete implementation steps for running the recommended next check (queries to run, data to pull, who to ask), each an investigation step, not a product fix.
- "roadmap": exactly 4 items {"week":"Week 1","focus":"..."} forming a 30-day investigation plan that sequences checks from cheapest/most discriminating to most expensive, with decision points.`;

/** Strip phone numbers and emails before anything leaves the server. */
function scrubPII(text: string) {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email removed]")
    .replace(/(?:\+?\d[\d\s-]{8,}\d)/g, "[number removed]");
}

function stageFacts(data: Input): string {
  const lines: string[] = [];
  const st = data.stages.filter((s) => s.count >= 0);
  if (st.length >= 2) {
    const top = st[0].count;
    lines.push("Calculated stage conversion (computed in code, treat as facts):");
    for (let i = 1; i < st.length; i++) {
      const prev = st[i - 1].count;
      const conv = prev > 0 ? ((st[i].count / prev) * 100).toFixed(1) : "n/a";
      const lost = Math.max(0, prev - st[i].count);
      lines.push(`- ${st[i - 1].name} -> ${st[i].name}: ${st[i].count}/${prev} (${conv}%), ${lost} lost`);
    }
    if (top > 0)
      lines.push(`- Overall ${st[0].name} -> ${st[st.length - 1].name}: ${((st[st.length - 1].count / top) * 100).toFixed(1)}%`);
  }
  const lk = data.leaks.filter((l) => l.count > 0);
  const total = lk.reduce((a, l) => a + l.count, 0);
  if (lk.length && total > 0) {
    lines.push("Tagged leak reasons (labels, not proven causes):");
    for (const l of [...lk].sort((a, b) => b.count - a.count))
      lines.push(`- ${l.reason}: ${l.count} (${((l.count / total) * 100).toFixed(1)}% of tagged leaks)`);
  }
  return lines.join("\n");
}

/** Remove the paid sections so they never reach a free user's browser. */
function redactForFree(r: any) {
  const hyps = Array.isArray(r.hypotheses) ? r.hypotheses : [];
  const unk = Array.isArray(r.unknown) ? r.unknown : [];
  return {
    summary: r.summary,
    evidence_strength: r.evidence_strength,
    user_hypothesis_verdict: r.user_hypothesis_verdict ?? null,
    known: r.known,
    assumed: [],
    unknown: unk.slice(0, 1),
    hypotheses: hyps.slice(0, 1).map((h: any) => ({ id: h.id, name: h.name })),
    next_check: null,
    alternative_check: null,
    checklist: [],
    roadmap: [],
    how_produced: r.how_produced,
    locked: {
      hypotheses: hyps.length,
      unknown: Math.max(0, unk.length - 1),
      assumed: Array.isArray(r.assumed) ? r.assumed.length : 0,
      checklist: Array.isArray(r.checklist) ? r.checklist.length : 0,
      roadmap: Array.isArray(r.roadmap) ? r.roadmap.length : 0,
    },
  };
}

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

USER HYPOTHESIS (applies when a "Your current hypothesis" is supplied):
- Treat it as H0 — the user's own belief, NEVER a fact. If the user appears to treat it as an explanation, it also appears in "assumed" with a caveat.
- Evaluate H0 explicitly: include it under "hypotheses" (id "H0") with evidence_for, evidence_against and falsified_if under the same rules (no invented contradictions).
- Always include at least 2 rival hypotheses besides H0 whenever the evidence permits any plausible alternative. H0 is a competitor, not the default answer.
- Set "user_hypothesis_verdict" based ONLY on supplied evidence: "Supported" means the supplied evidence genuinely raises H0's plausibility (never "proven"); "Undermined" means supplied evidence genuinely weakens it; "Not testable with current evidence" otherwise. reason is 1-2 sentences; settle is the concrete observation or check that would settle H0.
- If no user hypothesis is supplied, "user_hypothesis_verdict" MUST be exactly null.

DEPTH FLOOR (a response that misses any of these is invalid):
- At least 2 "unknown" items, each with a non-empty "why".
- At least 2 hypotheses whenever the supplied evidence permits more than one plausible explanation; each hypothesis MUST have a non-empty "falsified_if" and at least one item in both "evidence_for" and "evidence_against" (using the exact no-contradiction sentence from guardrail 6 when nothing genuinely weakens it).
- Hypotheses must be genuinely competing explanations, not restatements of each other.
- next_check MUST have a non-empty "requires" list, a "tests" list naming the hypothesis ids it discriminates between, and 2-3 "unlocks" lines.
- If a "Your current hypothesis" was supplied, "user_hypothesis_verdict" MUST be present with non-empty "verdict", "reason" and "settle". If none was supplied, it MUST be exactly null.

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
{"summary":"1-2 sentences restating strictly what changed, using only supplied facts","evidence_strength":{"level":"Strong|Partial|Weak","reason":"one sentence"},"known":["fact 1","fact 2"],"assumed":[{"claim":"claim the user treats as an explanation","caveat":"why the supplied evidence does not establish this"}],"unknown":[{"item":"missing evidence","why":"what it would distinguish"}],"hypotheses":[{"id":"H1","name":"short name","summary":"one sentence, tentative phrasing","evidence_for":["..."],"evidence_against":["..."],"falsified_if":"one concrete observation that would materially weaken or eliminate it"}],"next_check":{"action":"the single highest-value next investigation","why":"1-2 sentences","tests":["H1","H2"],"requires":["..."],"estimated_effort":"Low|Medium|High","unlocks":["If ... → H1 strengthens."]},"alternative_check":{"action":"one secondary check","why":"one sentence"},"user_hypothesis_verdict":null or {"verdict":"Supported|Undermined|Not testable with current evidence","reason":"1-2 sentences grounded in supplied evidence","settle":"the concrete observation or check that would settle H0"}}`;

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
  data: Input,
  unknownCount: number,
): { level: "Strong" | "Partial" | "Weak"; reason: string; signals: Signals; score: number } {
  const evidence = data.evidence.trim();
  const haystack = `${data.change} ${evidence} ${data.context}`;

  const signals: Signals = {
    // Both endpoints of the change are quantified.
    numbers: (/\d/.test(data.before) && /\d/.test(data.after)) || data.stages.length >= 2,
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
      ) || data.leaks.length > 0,
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
async function callModel(apiKey: string, userContent: string, systemPrompt: string): Promise<string> {
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
        { role: "system", content: [{ type: "input_text", text: systemPrompt }] },
        { role: "user", content: [{ type: "input_text", text: userContent }] },
      ],
      stream: true,
      store: false,
      reasoning: { effort: "high", summary: "auto" },
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

    // Plan + quota enforced on the server.
    const access = await computeAccess(context.supabase, context.userId, data.environment);
    if (!access.canRun) throw new Error("PAYMENT_REQUIRED");

    data = {
      ...data,
      change: scrubPII(data.change),
      context: scrubPII(data.context),
      evidence: scrubPII(data.evidence),
      userHypothesis: scrubPII(data.userHypothesis),
    };
    const systemPrompt = PROMPT + REPORT_EXTRAS;
    const facts = stageFacts(data);

    const lines = [
      ["What changed", data.change],
      ["Business / product context", data.context],
      ["Metric before", data.before],
      ["Metric after", data.after],
      ["When the change happened", data.when],
      ["Evidence / observations already available", data.evidence],
      ["Your current hypothesis (the user's own belief — treat as H0, never as fact)", data.userHypothesis],
      ["Funnel data", facts],
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

      const text = await callModel(apiKey, content, systemPrompt);
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

      if (data.userHypothesis.trim() && !candidate.user_hypothesis_verdict) {
        lastError = "Missing user_hypothesis_verdict.";
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

    parsed.how_produced = [
      "Evidence Readiness is calculated in code from 6 countable signals in your input — not judged by AI.",
      facts ? "Stage conversion and leak shares are calculated in code from the numbers you entered." : null,
      "Known / Assumed / Unknown, hypotheses and the next check are AI-generated (OpenAI reasoning model) under fixed rules that forbid stating causes as facts.",
      data.userHypothesis.trim()
        ? "The verdict on your hypothesis is AI-generated from the supplied evidence only — 'Supported' never means proven."
        : null,
      "Phone numbers and emails are removed before analysis. Your inputs are not stored.",
    ].filter(Boolean);

    // Count the run only after a successful answer.
    await context.supabase.from("investigation_runs").insert({ user_id: context.userId });

    const full = access.plan === "pro";
    return { ...(full ? { ...parsed, locked: null } : redactForFree(parsed)), plan: access.plan };
  });
