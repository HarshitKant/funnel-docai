import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const StepSchema = z.object({ step: z.string().min(1), users: z.number().int().nonnegative() });
const InputSchema = z.object({ steps: z.array(StepSchema).min(2) });

const PROMPT = `You are FunnelDoc AI — an expert product analyst who diagnoses conversion funnel problems.
The user will provide funnel step data. Analyze it and respond ONLY with valid JSON. No markdown, no backticks, no explanation outside the JSON.

Rules:
- Calculate drop-off percentages between consecutive steps
- Identify the step transition with the highest drop-off as the "kill zone"
- Generate exactly 3 hypotheses ranked by likelihood
- Each hypothesis must have a TRUE and FALSE validation pattern
- Generate exactly 3 fixes, each linked to a hypothesis number
- Write one SQL query to validate the top hypothesis
- Overall conversion = last step users / first step users

JSON schema (follow exactly):
{"overall_conversion":"X.X%","kill_zone":{"from":"StepA","to":"StepB","drop_pct":"X.X%","insight":"why this matters in one sentence"},"steps":[{"from":"StepA","to":"StepB","drop_pct":"X.X%","severity":"low|medium|high|critical"}],"segments_to_check":["dim1","dim2","dim3","dim4","dim5"],"hypotheses":[{"rank":1,"title":"short title","detail":"2-3 sentences","true_pattern":"data pattern that confirms","false_pattern":"data pattern that rejects"},{"rank":2,"title":"short title","detail":"2-3 sentences","true_pattern":"confirms","false_pattern":"rejects"},{"rank":3,"title":"short title","detail":"2-3 sentences","true_pattern":"confirms","false_pattern":"rejects"}],"fixes":[{"title":"short title","detail":"specific actionable fix","hypothesis_link":1,"expected_impact":"X% improvement in Y"},{"title":"short title","detail":"specific fix","hypothesis_link":2,"expected_impact":"X% improvement"},{"title":"short title","detail":"specific fix","hypothesis_link":3,"expected_impact":"X% improvement"}],"sql_query":"SELECT ... FROM ... GROUP BY ...","sql_explanation":"what this query checks"}`;

export const analyzeFunnel = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

    const userMsg = `Analyze this conversion funnel:\n${data.steps
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
