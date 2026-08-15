import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const StepSchema = z.object({ step: z.string().min(1), users: z.number().int().nonnegative() });
const ContextSchema = z.object({
  business: z.string().max(2000).default(""),
  customer: z.string().max(2000).default(""),
  model: z.string().max(500).default(""),
  goal: z.string().max(500).default(""),
  cycle: z.string().max(500).default(""),
  extra: z.string().max(2000).default(""),
});
const InputSchema = z.object({
  steps: z.array(StepSchema).min(2),
  context: ContextSchema.optional(),
});

const PROMPT = `You are FunnelDoc AI — an expert product analyst who diagnoses conversion funnel problems.
The user will provide funnel step data plus business context. Analyze it and respond ONLY with valid JSON. No markdown, no backticks, no explanation outside the JSON.

Rules:
- Calculate drop-off percentages between consecutive steps
- Identify the step transition with the highest drop-off as the "kill zone"
- Generate exactly 3 hypotheses ranked by likelihood
- Hypotheses are POSSIBILITIES, never facts — phrase them tentatively ("may", "could", "one plausible explanation")
- Each hypothesis must have a TRUE and FALSE validation pattern
- Generate exactly 3 fixes, each linked to a hypothesis number
- Write one SQL query to validate the top hypothesis
- Overall conversion = last step users / first step users
- Explicitly state assumptions you had to make, and what information is missing that would improve the diagnosis
- Set confidence to "Low", "Medium" or "High" based on how much business context and data detail you were given

JSON schema (follow exactly):
{"overall_conversion":"X.X%","observation":"2-3 sentences describing strictly what the funnel numbers show, no speculation","business_context_considered":"2-3 sentences on how the provided business context shaped this preflight (say if little context was given)","evidence_readiness":{"level":"Strong|Partial|Weak","reason":"one sentence explaining the readiness level"},"data_shows":["conclusion directly supported by the numbers 1","conclusion 2","conclusion 3"],"data_does_not_prove":["causal/business conclusion that cannot yet be justified 1","cannot prove 2","cannot prove 3"],"kill_zone":{"from":"StepA","to":"StepB","drop_pct":"X.X%","insight":"one sentence describing the largest measured drop, explicitly noting it is not automatically the biggest business problem"},"steps":[{"from":"StepA","to":"StepB","drop_pct":"X.X%","severity":"low|medium|high|critical"}],"segments_to_check":["dim1","dim2","dim3","dim4","dim5"],"hypotheses":[{"rank":1,"title":"short title","detail":"2-3 sentences, tentative phrasing","true_pattern":"data pattern that confirms","false_pattern":"data pattern that rejects"},{"rank":2,"title":"short title","detail":"2-3 sentences","true_pattern":"confirms","false_pattern":"rejects"},{"rank":3,"title":"short title","detail":"2-3 sentences","true_pattern":"confirms","false_pattern":"rejects"}],"assumptions":["assumption 1","assumption 2","assumption 3"],"missing_evidence":["missing evidence 1","missing 2","missing 3"],"investigate_first":"the single highest-priority analysis or question to answer before changing the product, and what it would prove or disprove","fixes":[{"title":"short title","detail":"specific actionable fix, conditional on the hypothesis being validated","hypothesis_link":1,"expected_impact":"X% improvement in Y"},{"title":"short title","detail":"specific fix","hypothesis_link":2,"expected_impact":"X% improvement"},{"title":"short title","detail":"specific fix","hypothesis_link":3,"expected_impact":"X% improvement"}],"sql_query":"SELECT ... FROM ... GROUP BY ...","sql_explanation":"what this query checks"}`;

export const analyzeFunnel = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

    const c = data.context;
    const ctxLines = c
      ? [
          ["Product / business", c.business],
          ["Target customer", c.customer],
          ["Business model", c.model],
          ["Primary conversion goal", c.goal],
          ["Typical conversion cycle", c.cycle],
          ["Additional context", c.extra],
        ]
          .filter(([, v]) => String(v).trim())
          .map(([k, v]) => `${k}: ${v}`)
          .join("\n")
      : "";

    const userMsg = `Business context:\n${ctxLines || "(none provided)"}\n\nAnalyze this conversion funnel:\n${data.steps
      .map((s, i) => `Step ${i + 1}: "${s.step}" — ${s.users.toLocaleString()} users`)
      .join("\n")}\n\nRespond with ONLY valid JSON. No other text.`;


    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
          { role: "system", content: PROMPT },
          { role: "user", content: userMsg },
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
    if (!parsed.kill_zone || !parsed.hypotheses || !parsed.steps) {
      throw new Error("Incomplete AI response");
    }
    return parsed;
  });
