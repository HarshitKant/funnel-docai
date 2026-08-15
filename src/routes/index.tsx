import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer } from "recharts";
import { analyzeFunnel } from "@/lib/funnel-analyze.functions";
import { submitTestimonial } from "@/lib/testimonials.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FunnelDoc.ai — Diagnose your conversion funnel in 30 seconds" },
      {
        name: "description",
        content:
          "Paste your funnel steps. FunnelDoc.ai finds the biggest drop-off, generates hypotheses, and writes diagnostic SQL - in seconds.",
      },
      { property: "og:title", content: "FunnelDoc.ai — Diagnose your conversion funnel in 30 seconds" },
      {
        property: "og:description",
        content:
          "Paste your funnel steps. FunnelDoc.ai finds the biggest drop-off, generates hypotheses, and writes diagnostic SQL - in seconds.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FunnelDoc,
});

type Step = { step: string; users: string };
type FunnelPoint = { step: string; users: number };
type BizContext = {
  business: string;
  customer: string;
  model: string;
  goal: string;
  cycle: string;
  extra: string;
};

const EMPTY_CONTEXT: BizContext = {
  business: "",
  customer: "",
  model: "",
  goal: "",
  cycle: "",
  extra: "",
};

type Analysis = {
  overall_conversion: string;
  observation?: string;
  business_context_considered?: string;
  kill_zone: { from: string; to: string; drop_pct: string; insight: string };
  steps: { from: string; to: string; drop_pct: string; severity: string }[];
  segments_to_check: string[];
  hypotheses: {
    rank: number;
    title: string;
    detail: string;
    true_pattern: string;
    false_pattern: string;
  }[];
  assumptions?: string[];
  missing_information?: string[];
  missing_evidence?: string[];
  confidence?: { level: string; reason: string };
  evidence_readiness?: { level: string; reason: string };
  data_shows?: string[];
  data_does_not_prove?: string[];
  next_investigation?: string;
  investigate_first?: string;
  fixes: { title: string; detail: string; hypothesis_link: number; expected_impact: string }[];
  sql_query: string;
  sql_explanation: string;
};

const SAMPLE_FUNNEL: Step[] = [
  { step: "Landing Page", users: "10000" },
  { step: "Sign Up Started", users: "6400" },
  { step: "Email Verified", users: "3800" },
  { step: "KYC Started", users: "2900" },
  { step: "KYC Completed", users: "1200" },
  { step: "First Transaction", users: "580" },
];

const SAMPLE_CONTEXT: BizContext = {
  business: "A consumer fintech app for sending money abroad with low fees.",
  customer: "Migrant workers aged 25-45 sending money home monthly.",
  model: "",
  goal: "Complete first transaction",
  cycle: "",
  extra: "",
};

const CONTEXT_FIELDS: {
  key: keyof BizContext;
  label: string;
  placeholder: string;
  multiline?: boolean;
  optional?: boolean;
}[] = [
  {
    key: "business",
    label: "What does your product/business do?",
    placeholder: "e.g. A consumer fintech app for sending money abroad with low fees",
    multiline: true,
  },
  {
    key: "customer",
    label: "Who is the target customer?",
    placeholder: "e.g. Migrant workers aged 25-45 sending money home monthly",
    multiline: true,
  },
  {
    key: "goal",
    label: "What is the primary conversion goal?",
    placeholder: "e.g. Complete first transaction",
  },
  {
    key: "extra",
    label: "Add more context (optional)",
    placeholder: "Anything else worth knowing — seasonality, regulation, recent changes…",
    multiline: true,
    optional: true,
  },
];

const factTag = {
  padding: "2px 8px",
  borderRadius: 10,
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: "0.3px",
  textTransform: "uppercase" as const,
  color: "#0F766E",
  background: "#CCFBF1",
  border: "1px solid #99F6E4",
};

const aiTag = {
  ...factTag,
  color: "#6D28D9",
  background: "#EDE9FE",
  border: "1px solid #DDD6FE",
};

const confColor = (l: string) =>
  l === "High" || l === "Strong" ? "#16A34A" : l === "Medium" || l === "Partial" ? "#B45309" : "#DC2626";
const confBg = (l: string) =>
  l === "High" || l === "Strong" ? "#DCFCE7" : l === "Medium" || l === "Partial" ? "#FEF3C7" : "#FEE2E2";


function computeDropoffs(d: FunnelPoint[]) {
  return d.slice(1).map((s, i) => {
    const p = d[i].users;
    const c = s.users;
    const dr = p > 0 ? ((p - c) / p) * 100 : 0;
    return { from: d[i].step, to: s.step, drop: dr.toFixed(1) };
  });
}

function findKillZone(d: FunnelPoint[]) {
  const dr = computeDropoffs(d);
  return dr.length ? dr.reduce((m, x) => (parseFloat(x.drop) > parseFloat(m.drop) ? x : m), dr[0]) : null;
}

function generateFallback(data: FunnelPoint[], ctx: BizContext): Analysis {
  const drops = computeDropoffs(data);
  const killDrop = drops.reduce((m, x) => (parseFloat(x.drop) > parseFloat(m.drop) ? x : m), drops[0]);
  const overall =
    data.length >= 2 ? ((data[data.length - 1].users / data[0].users) * 100).toFixed(1) + "%" : "N/A";
  const stepsAnalysis = drops.map((d) => ({
    from: d.from,
    to: d.to,
    drop_pct: d.drop + "%",
    severity:
      parseFloat(d.drop) > 50
        ? "critical"
        : parseFloat(d.drop) > 35
          ? "high"
          : parseFloat(d.drop) > 20
            ? "medium"
            : "low",
  }));
  const provided = Object.values(ctx).filter((v) => v.trim()).length;
  return {
    overall_conversion: overall,
    observation: `Across ${data.length} recorded steps, ${data[0].users.toLocaleString()} users entered at "${data[0].step}" and ${data[data.length - 1].users.toLocaleString()} reached "${data[data.length - 1].step}" (${overall} end-to-end). The largest single-step loss is ${killDrop.from} → ${killDrop.to}, where ${killDrop.drop}% of users are lost. These figures are calculated directly from the numbers you entered.`,
    business_context_considered:
      provided === 0
        ? "No business context was provided, so this diagnosis is based only on the raw funnel numbers. Adding context would materially sharpen the hypotheses."
        : `Context used: ${[ctx.business && `product — ${ctx.business}`, ctx.customer && `customer — ${ctx.customer}`, ctx.model && `model — ${ctx.model}`, ctx.goal && `goal — ${ctx.goal}`, ctx.cycle && `cycle — ${ctx.cycle}`, ctx.extra && `notes — ${ctx.extra}`]
            .filter(Boolean)
            .join("; ")}.`,
    assumptions: [
      "The step counts represent unique users, not sessions or events.",
      "All steps are sequential and users must pass each step in order.",
      "The data covers a single, representative time period with no tracking gaps.",
      "No step is intentionally restrictive (e.g. eligibility or compliance gating) unless stated in your context.",
    ],
    missing_evidence: [
      "Time period covered and whether volumes are seasonal or campaign-driven.",
      "Segment breakdowns (device, geography, traffic source, new vs returning).",
      "Instrumentation quality — whether any step is under- or double-counted.",
      "Qualitative signals: session recordings, support tickets or survey responses at the drop-off step.",
    ],
    evidence_readiness: {
      level: provided >= 4 ? "Partial" : "Weak",
      reason:
        provided >= 4
          ? "Business context was supplied, but the analysis still rests on aggregate counts with no segment-level, time-series or behavioural data to test against."
          : "Only aggregate step counts were available, with little or no business context, so nothing here is yet strong enough to act on.",
    },
    data_shows: [
      `${data[0].users.toLocaleString()} users entered at "${data[0].step}" and ${data[data.length - 1].users.toLocaleString()} reached "${data[data.length - 1].step}" — ${overall} end-to-end.`,
      `The largest measured single-step loss is ${killDrop.from} → ${killDrop.to} at ${killDrop.drop}%.`,
      `Counts decline monotonically across the ${data.length} steps you entered, so no step gains users.`,
      `Each transition's pass-through rate is fixed by the numbers supplied: ${stepsAnalysis.map((s) => `${s.from}→${s.to} -${s.drop_pct}`).join(", ")}.`,
    ],
    data_does_not_prove: [
      `That ${killDrop.from} → ${killDrop.to} is the biggest business problem — the largest percentage drop is not automatically the largest revenue or value loss.`,
      "Any cause for the drop-offs: friction, pricing, technical failure and audience mismatch are all still equally unproven.",
      "That the users lost were qualified or intended to convert at all.",
      "That the pattern is stable over time — a single snapshot cannot separate a trend from a one-off.",
    ],
    investigate_first: `Before changing anything, check whether the ${killDrop.from} → ${killDrop.to} loss is concentrated or uniform: segment that pass-through rate by device, traffic source and geography over the last 14 days, and compare it against the previous period. A concentrated loss points to a technical or audience-specific cause; a uniform, stable loss suggests the step is doing what the business intends and the leverage lies elsewhere.`,
    kill_zone: {
      from: killDrop.from,
      to: killDrop.to,
      drop_pct: killDrop.drop + "%",
      insight: `${killDrop.drop}% of users are lost between ${killDrop.from} and ${killDrop.to} — the largest measured drop in this funnel. That makes it the first place to look, not automatically the biggest business problem: this step may be gating users intentionally.`,
    },
    steps: stepsAnalysis,

    segments_to_check: [
      "Device type (mobile vs desktop)",
      "Geography / region",
      "Traffic source (organic vs paid)",
      "User cohort (new vs returning)",
      "Time of day / day of week",
    ],
    hypotheses: [
      {
        rank: 1,
        title: `${killDrop.to} has too much friction`,
        detail: `Users who reached ${killDrop.from} showed clear intent. A ${killDrop.drop}% drop to ${killDrop.to} suggests the step itself introduces friction — too many fields, confusing UI, unclear value proposition, or a trust barrier that wasn't present in earlier steps.`,
        true_pattern: `Session recordings show users spending 3x longer on ${killDrop.to} than other steps. Form abandonment or back-button rate spikes at this step.`,
        false_pattern: `Time-on-step is consistent with other steps, and rage clicks / back-button rates are normal.`,
      },
      {
        rank: 2,
        title: "Technical failure or performance degradation",
        detail: `The ${killDrop.from} → ${killDrop.to} transition may involve an API call, page load, or third-party integration that fails silently or loads slowly. Users see a blank screen, spinner, or error and leave without the system logging it as a failure.`,
        true_pattern: `Error rates or timeout rates for this step are above 5%. p95 latency for this page/API is 3x higher than other steps. The drop is worse on slower network connections.`,
        false_pattern: `Page load times and error rates for this step are comparable to other steps.`,
      },
      {
        rank: 3,
        title: "Expectation mismatch from previous step",
        detail: `Users arriving at ${killDrop.to} expected something different based on what ${killDrop.from} promised. The content, pricing, requirements, or ask at ${killDrop.to} doesn't match what users thought they were getting into.`,
        true_pattern: `Users who came through a specific entry point or campaign have a much higher drop rate at this step than organic users.`,
        false_pattern: `Drop rate at ${killDrop.to} is consistent regardless of how users arrived at ${killDrop.from}.`,
      },
    ],
    fixes: [
      {
        title: `Simplify ${killDrop.to} to reduce friction`,
        detail: `Audit every field, click, and decision required at ${killDrop.to}. Remove anything that isn't essential for this step. Move optional inputs to later in the journey. Add progress indicators if this is a multi-part process.`,
        hypothesis_link: 1,
        expected_impact: `15-25% improvement in ${killDrop.from} → ${killDrop.to} conversion`,
      },
      {
        title: "Add performance monitoring and error fallbacks",
        detail: `Instrument this step with detailed latency tracking and error logging. Add retry logic for API failures. Show a clear loading state instead of a blank screen. Implement a graceful fallback if a third-party service is slow.`,
        hypothesis_link: 2,
        expected_impact: "5-10% improvement by recovering users who currently hit silent failures",
      },
      {
        title: `Align expectations between ${killDrop.from} and ${killDrop.to}`,
        detail: `Review the messaging, pricing, and requirements shown at ${killDrop.from}. Ensure ${killDrop.to} delivers exactly what was promised. If ${killDrop.to} requires something new (documents, payment, personal info), preview that requirement at ${killDrop.from} so users aren't surprised.`,
        hypothesis_link: 3,
        expected_impact: "8-15% improvement by reducing surprise-driven abandonment",
      },
    ],
    sql_query: `SELECT\n  device_type,\n  traffic_source,\n  COUNT(*) AS reached_prev,\n  COUNT(CASE WHEN reached_next THEN 1 END) AS reached_next,\n  ROUND(COUNT(CASE WHEN reached_next THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 2) AS pass_through_rate\nFROM user_funnel_events\nWHERE step = '${killDrop.from}'\n  AND created_at >= CURRENT_DATE - INTERVAL '14 days'\nGROUP BY device_type, traffic_source\nORDER BY pass_through_rate ASC;`,
    sql_explanation: `This query segments the ${killDrop.from} → ${killDrop.to} pass-through rate by device type and traffic source over the last 14 days. If one segment has a dramatically lower pass-through rate, it isolates where the problem is concentrated.`,
  };
}

const LOADING_MSGS = [
  "Reading your funnel data...",
  "Identifying drop-off patterns...",
  "Generating hypotheses...",
  "Writing diagnostic SQL...",
  "Preparing your diagnosis...",
];

function FunnelDoc() {
  const analyzeFn = useServerFn(analyzeFunnel);
  const submitFeedbackFn = useServerFn(submitTestimonial);
  const [steps, setSteps] = useState<Step[]>([
    { step: "", users: "" },
    { step: "", users: "" },
    { step: "", users: "" },
  ]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"input" | "results">("input");
  const [usedFallback, setUsedFallback] = useState(false);
  const [loadIdx, setLoadIdx] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [feedbackRating, setFeedbackRating] = useState<number | null>(null);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [ctx, setCtx] = useState<BizContext>({ ...EMPTY_CONTEXT });
  const [ctxOpen, setCtxOpen] = useState(true);

  const updateCtx = (k: keyof BizContext, v: string) => setCtx((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!loading) return;
    const iv = setInterval(() => setLoadIdx((p) => (p + 1) % LOADING_MSGS.length), 1500);
    return () => clearInterval(iv);
  }, [loading]);

  const addStep = () => setSteps((p) => [...p, { step: "", users: "" }]);
  const removeStep = (i: number) => setSteps((p) => p.filter((_, idx) => idx !== i));
  const updateStep = (i: number, f: keyof Step, v: string) =>
    setSteps((p) => p.map((s, idx) => (idx === i ? { ...s, [f]: v } : s)));
  const loadSample = () => {
    setSteps(SAMPLE_FUNNEL.map((s) => ({ ...s })));
    setCtx({ ...SAMPLE_CONTEXT });
  };

  const funnelData: FunnelPoint[] = steps
    .filter((s) => s.step && s.users)
    .map((s) => ({ step: s.step, users: parseInt(s.users) || 0 }))
    .filter((s) => s.users > 0);

  const analyze = useCallback(async () => {
    if (funnelData.length < 2) {
      setError("Need at least 2 steps with numbers");
      return;
    }
    setLoading(true);
    setError(null);
    setUsedFallback(false);
    try {
      const parsed = await analyzeFn({ data: { steps: funnelData, context: ctx } });
      setAnalysis(parsed as Analysis);
      setView("results");
    } catch (e) {
      console.error("AI error, using fallback:", e);
      setAnalysis(generateFallback(funnelData, ctx));
      setUsedFallback(true);
      setView("results");
    } finally {
      setLoading(false);
    }
  }, [funnelData, analyzeFn, ctx]);


  const submitFeedback = useCallback(async () => {
    const trimmed = feedback.trim();
    if (!trimmed) {
      setFeedbackError("Please share a few words before sending.");
      return;
    }
    if (trimmed.length > 1000) {
      setFeedbackError("Feedback must be under 1000 characters.");
      return;
    }
    setFeedbackError(null);
    setFeedbackSubmitting(true);
    try {
      await submitFeedbackFn({
        data: {
          message: trimmed,
          rating: feedbackRating ?? undefined,
          pageUrl: typeof window !== "undefined" ? window.location.href : undefined,
        },
      });
      setFeedbackSubmitted(true);
      setFeedback("");
      setFeedbackRating(null);
    } catch (e) {
      setFeedbackError(e instanceof Error ? e.message : "Could not submit feedback. Try again?");
    } finally {
      setFeedbackSubmitting(false);
    }
  }, [feedback, feedbackRating, submitFeedbackFn]);

  const sevColor = (s: string) =>

    s === "critical" ? "#EF4444" : s === "high" ? "#F97316" : s === "medium" ? "#EAB308" : "#22C55E";

  const kz = findKillZone(funnelData);
  const previewDrops = computeDropoffs(funnelData);

  return (
    <div
      style={{
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "#111827",
        maxWidth: 800,
        margin: "0 auto",
        padding: "0 16px 40px",
      }}
    >
      <div style={{ textAlign: "center", padding: "24px 0 8px" }}>
        <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.5px" }}>
          <span style={{ color: "#6366F1" }}>Funnel</span>Doc
          <span style={{ color: "#6366F1" }}>.</span>ai
        </div>
        <div style={{ fontSize: 14, color: "#6B7280", marginTop: 6, maxWidth: 500, margin: "6px auto 0" }}>
          FunnelDoc separates what your data shows from what it doesn’t prove.
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: 6, margin: "16px 0" }}>
        {([
          ["input", "Enter funnel"],
          ["results", "Diagnosis"],
        ] as const).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setView(k)}
            disabled={k === "results" && !analysis}
            style={{
              padding: "6px 16px",
              borderRadius: 20,
              fontSize: 13,
              fontFamily: "inherit",
              cursor: k === "results" && !analysis ? "default" : "pointer",
              border: "1px solid",
              borderColor: view === k ? "#6366F1" : "#E5E7EB",
              background: view === k ? "#EEF2FF" : "transparent",
              color:
                view === k ? "#4338CA" : k === "results" && !analysis ? "#D1D5DB" : "#6B7280",
              fontWeight: view === k ? 500 : 400,
            }}
          >
            {l}
          </button>
        ))}
      </div>

      {view === "input" && (
        <div>
          <div
            style={{
              border: "1px solid #E5E7EB",
              borderRadius: 10,
              marginBottom: 20,
              overflow: "hidden",
            }}
          >
            <button
              onClick={() => setCtxOpen((p) => !p)}
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 14px",
                background: "#F9FAFB",
                border: "none",
                borderBottom: ctxOpen ? "1px solid #E5E7EB" : "none",
                cursor: "pointer",
                fontFamily: "inherit",
                textAlign: "left",
              }}
            >
              <span>
                <span style={{ fontSize: 15, fontWeight: 500, color: "#111827" }}>
                  Business Context
                </span>
                <span style={{ fontSize: 12, color: "#9CA3AF", marginLeft: 8 }}>
                  Help FunnelDoc understand what these numbers actually mean.
                </span>
              </span>
              <span style={{ fontSize: 12, color: "#6366F1" }}>{ctxOpen ? "Hide" : "Show"}</span>
            </button>

            {ctxOpen && (
              <div style={{ padding: 14, display: "grid", gap: 12 }}>
                {CONTEXT_FIELDS.map((f) => (
                  <div key={f.key}>
                    <label
                      style={{
                        display: "block",
                        fontSize: 12,
                        fontWeight: 500,
                        color: "#6B7280",
                        marginBottom: 4,
                      }}
                    >
                      {f.label}
                    </label>
                    {f.multiline ? (
                      <textarea
                        value={ctx[f.key]}
                        onChange={(e) => updateCtx(f.key, e.target.value)}
                        placeholder={f.placeholder}
                        rows={2}
                        style={{
                          width: "100%",
                          padding: "8px 10px",
                          borderRadius: 6,
                          border: "1px solid #E5E7EB",
                          fontSize: 13,
                          fontFamily: "inherit",
                          resize: "vertical",
                          outline: "none",
                          color: "#111827",
                          background: "#fff",
                        }}
                      />
                    ) : (
                      <input
                        value={ctx[f.key]}
                        onChange={(e) => updateCtx(f.key, e.target.value)}
                        placeholder={f.placeholder}
                        style={{
                          width: "100%",
                          padding: "8px 10px",
                          borderRadius: 6,
                          border: "1px solid #E5E7EB",
                          fontSize: 13,
                          fontFamily: "inherit",
                          outline: "none",
                          color: "#111827",
                          background: "#fff",
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 500 }}>Enter your funnel steps</div>
            <button
              onClick={loadSample}
              style={{
                padding: "5px 12px",
                borderRadius: 6,
                border: "1px solid #E5E7EB",
                background: "transparent",
                fontSize: 12,
                cursor: "pointer",
                fontFamily: "inherit",
                color: "#6366F1",
              }}
            >
              Load sample data
            </button>
          </div>

          <div style={{ border: "1px solid #E5E7EB", borderRadius: 10, overflow: "hidden" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "36px 1fr 120px 36px",
                padding: "8px 12px",
                background: "#F9FAFB",
                fontSize: 12,
                fontWeight: 500,
                color: "#6B7280",
              }}
            >
              <div>#</div>
              <div>Step name</div>
              <div>Users</div>
              <div></div>
            </div>
            {steps.map((s, i) => (
              <div
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "36px 1fr 120px 36px",
                  padding: "6px 12px",
                  borderTop: "1px solid #E5E7EB",
                  alignItems: "center",
                }}
              >
                <div style={{ fontSize: 12, color: "#9CA3AF" }}>{i + 1}</div>
                <input
                  value={s.step}
                  onChange={(e) => updateStep(i, "step", e.target.value)}
                  placeholder={
                    i === 0 ? "e.g. Landing Page" : i === 1 ? "e.g. Sign Up" : "e.g. First Purchase"
                  }
                  style={{
                    border: "none",
                    outline: "none",
                    fontSize: 13,
                    padding: "6px 8px",
                    background: "transparent",
                    fontFamily: "inherit",
                    width: "100%",
                  }}
                />
                <input
                  value={s.users}
                  onChange={(e) => updateStep(i, "users", e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="10000"
                  type="text"
                  style={{
                    border: "none",
                    outline: "none",
                    fontSize: 13,
                    padding: "6px 8px",
                    background: "transparent",
                    fontFamily: "inherit",
                    textAlign: "right",
                    width: "100%",
                  }}
                />
                <button
                  onClick={() => removeStep(i)}
                  disabled={steps.length <= 2}
                  style={{
                    border: "none",
                    background: "transparent",
                    cursor: steps.length <= 2 ? "default" : "pointer",
                    fontSize: 16,
                    color: steps.length <= 2 ? "#E5E7EB" : "#9CA3AF",
                    padding: 0,
                    fontFamily: "inherit",
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button
              onClick={addStep}
              style={{
                padding: "7px 14px",
                borderRadius: 6,
                border: "1px dashed #E5E7EB",
                background: "transparent",
                fontSize: 12,
                cursor: "pointer",
                fontFamily: "inherit",
                color: "#6B7280",
              }}
            >
              + Add step
            </button>
          </div>

          {funnelData.length >= 2 && (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8, color: "#6B7280" }}>
                Preview
              </div>
              <div style={{ height: Math.max(140, funnelData.length * 36) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={funnelData} layout="vertical" margin={{ left: 10, right: 30 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="step" width={130} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => v.toLocaleString()} />
                    <Bar dataKey="users" radius={[0, 4, 4, 0]}>
                      {funnelData.map((_, i) => {
                        const isKill = kz && i > 0 && previewDrops[i - 1]?.to === kz.to;
                        return (
                          <Cell key={i} fill={isKill ? "#EF4444" : i === 0 ? "#6366F1" : "#A5B4FC"} />
                        );
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {kz && (
                <div style={{ fontSize: 12, color: "#EF4444", marginTop: 4, textAlign: "center" }}>
                  Biggest drop: {kz.from} → {kz.to} ({kz.drop}% lost)
                </div>
              )}
            </div>
          )}

          {error && <div style={{ color: "#EF4444", fontSize: 13, marginTop: 12 }}>{error}</div>}

          <button
            onClick={analyze}
            disabled={loading || funnelData.length < 2}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: 8,
              border: "none",
              fontSize: 14,
              fontWeight: 500,
              fontFamily: "inherit",
              cursor: loading || funnelData.length < 2 ? "default" : "pointer",
              marginTop: 16,
              background: loading || funnelData.length < 2 ? "#F3F4F6" : "#6366F1",
              color: loading || funnelData.length < 2 ? "#9CA3AF" : "#fff",
            }}
          >
            {loading ? "Running Preflight..." : "Run Funnel Preflight"}
          </button>

          {loading && (
            <div style={{ textAlign: "center", fontSize: 12, color: "#6366F1", marginTop: 8, minHeight: 20 }}>
              {LOADING_MSGS[loadIdx]}
            </div>
          )}
        </div>
      )}

      {view === "results" && analysis && (
        <div>
          {usedFallback && (
            <div
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                background: "#FFFBEB",
                border: "1px solid #FDE68A",
                marginBottom: 12,
                fontSize: 12,
                color: "#92400E",
              }}
            >
              Using local analysis engine. AI diagnosis failed — check console for details.
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
            {[
              { label: "Overall conversion", value: analysis.overall_conversion, color: "#6366F1" },
              {
                label: "Kill zone",
                value: `${analysis.kill_zone.from} → ${analysis.kill_zone.to}`,
                color: "#EF4444",
              },
              { label: "Biggest drop", value: analysis.kill_zone.drop_pct, color: "#F97316" },
            ].map((s, i) => (
              <div
                key={i}
                style={{
                  padding: "12px 14px",
                  borderRadius: 8,
                  border: "1px solid #E5E7EB",
                  background: "#F9FAFB",
                }}
              >
                <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: i === 1 ? 12 : 16, fontWeight: 600, color: s.color }}>
                  {s.value}
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              background: "#FEF2F2",
              border: "1px solid #FECACA",
              marginBottom: 16,
              fontSize: 13,
              color: "#991B1B",
              lineHeight: 1.6,
            }}
          >
            <span style={{ fontWeight: 600 }}>Largest measured drop: </span>
            {analysis.kill_zone.insight}
          </div>

          {(() => {
            const readiness =
              analysis.evidence_readiness ??
              (analysis.confidence
                ? {
                    level:
                      analysis.confidence.level === "High"
                        ? "Strong"
                        : analysis.confidence.level === "Medium"
                          ? "Partial"
                          : "Weak",
                    reason: analysis.confidence.reason,
                  }
                : null);
            if (!readiness) return null;
            return (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1px solid #E5E7EB",
                  background: "#F9FAFB",
                  marginBottom: 16,
                }}
              >
                <span
                  style={{
                    padding: "3px 10px",
                    borderRadius: 12,
                    fontSize: 11,
                    fontWeight: 600,
                    color: confColor(readiness.level),
                    background: confBg(readiness.level),
                    flexShrink: 0,
                  }}
                >
                  Evidence readiness: {readiness.level}
                </span>
                <span style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.6 }}>
                  {readiness.reason}
                </span>
              </div>
            );
          })()}

          {analysis.data_shows?.length ? (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>What the data shows</div>
                <span style={factTag}>Calculated</span>
              </div>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: 16,
                  fontSize: 13,
                  color: "#6B7280",
                  lineHeight: 1.7,
                }}
              >
                {analysis.data_shows.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>
          ) : analysis.observation ? (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>What the data shows</div>
                <span style={factTag}>Calculated</span>
              </div>
              <div style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.7 }}>
                {analysis.observation}
              </div>
            </div>
          ) : null}

          {analysis.data_does_not_prove?.length ? (
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 8,
                border: "1px solid #FECACA",
                background: "#FEF2F2",
                marginBottom: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: "#991B1B" }}>
                  What the data does NOT prove
                </div>
              </div>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: 16,
                  fontSize: 13,
                  color: "#991B1B",
                  lineHeight: 1.7,
                }}
              >
                {analysis.data_does_not_prove.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {analysis.business_context_considered && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>
                Business context considered
              </div>
              <div style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.7 }}>
                {analysis.business_context_considered}
              </div>
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>Step-by-step breakdown</div>
              <span style={factTag}>Calculated</span>
            </div>

            <div style={{ border: "1px solid #E5E7EB", borderRadius: 8, overflow: "hidden" }}>
              {analysis.steps.map((s, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 14px",
                    borderTop: i > 0 ? "1px solid #E5E7EB" : "none",
                    fontSize: 13,
                  }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: sevColor(s.severity),
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    {s.from} → {s.to}
                  </div>
                  <div style={{ fontWeight: 500, color: sevColor(s.severity) }}>-{s.drop_pct}</div>
                  <div style={{ fontSize: 11, color: "#9CA3AF", width: 50, textAlign: "right" }}>
                    {s.severity}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Funnel visualization</div>
            <div style={{ height: Math.max(160, funnelData.length * 36) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnelData} layout="vertical" margin={{ left: 10, right: 30 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="step" width={130} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => v.toLocaleString()} />
                  <Bar dataKey="users" radius={[0, 4, 4, 0]}>
                    {funnelData.map((s, i) => {
                      const isKill = analysis.kill_zone && s.step === analysis.kill_zone.to;
                      return <Cell key={i} fill={isKill ? "#EF4444" : i === 0 ? "#6366F1" : "#A5B4FC"} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
              Segment by these dimensions first
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {analysis.segments_to_check.map((s, i) => (
                <span
                  key={i}
                  style={{
                    padding: "5px 12px",
                    borderRadius: 16,
                    fontSize: 12,
                    background: "#EEF2FF",
                    color: "#4338CA",
                    border: "1px solid #C7D2FE",
                  }}
                >
                  {s}
                </span>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>Top 3 hypotheses</div>
              <span style={aiTag}>AI-generated</span>
            </div>
            <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 8, lineHeight: 1.6 }}>
              These are possible explanations, not findings. Validate each one against your data
              before acting.
            </div>

            {analysis.hypotheses.map((h, i) => (
              <div
                key={i}
                style={{
                  border: "1px solid #E5E7EB",
                  borderRadius: 8,
                  padding: "12px 16px",
                  marginBottom: 8,
                }}
              >
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: i === 0 ? "#6366F1" : i === 1 ? "#8B5CF6" : "#A78BFA",
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      fontWeight: 500,
                      flexShrink: 0,
                    }}
                  >
                    {h.rank}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{h.title}</div>
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "#6B7280",
                    lineHeight: 1.7,
                    marginBottom: 8,
                    paddingLeft: 30,
                  }}
                >
                  {h.detail}
                </div>
                <div style={{ paddingLeft: 30 }}>
                  <div style={{ fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: "#16A34A", fontWeight: 500 }}>If TRUE: </span>
                    <span style={{ color: "#6B7280" }}>{h.true_pattern}</span>
                  </div>
                  <div style={{ fontSize: 12 }}>
                    <span style={{ color: "#DC2626", fontWeight: 500 }}>If FALSE: </span>
                    <span style={{ color: "#6B7280" }}>{h.false_pattern}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {(() => {
            const assumptions = (analysis.assumptions ?? []).slice(0, 4);
            const missing = (analysis.missing_evidence ?? analysis.missing_information ?? []).slice(0, 4);
            if (!assumptions.length && !missing.length) return null;
            return (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                  marginBottom: 16,
                }}
              >
                {assumptions.length ? (
                  <div
                    style={{
                      padding: "12px 14px",
                      borderRadius: 8,
                      border: "1px solid #E5E7EB",
                      background: "#F9FAFB",
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Assumptions</div>
                    <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: "#6B7280", lineHeight: 1.7 }}>
                      {assumptions.map((a, i) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {missing.length ? (
                  <div
                    style={{
                      padding: "12px 14px",
                      borderRadius: 8,
                      border: "1px solid #FDE68A",
                      background: "#FFFBEB",
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, color: "#92400E" }}>
                      Missing evidence
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: "#92400E", lineHeight: 1.7 }}>
                      {missing.map((m, i) => (
                        <li key={i}>{m}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            );
          })()}

          {(analysis.investigate_first || analysis.next_investigation) && (
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 8,
                border: "1px solid #C7D2FE",
                background: "#EEF2FF",
                marginBottom: 16,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: "#4338CA", marginBottom: 4 }}>
                Investigate this first
              </div>
              <div style={{ fontSize: 13, color: "#4338CA", lineHeight: 1.7 }}>
                {analysis.investigate_first ?? analysis.next_investigation}
              </div>
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>Recommended fixes</div>
              <span style={aiTag}>AI-generated</span>
            </div>

            {analysis.fixes.map((f, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: 10,
                  padding: "10px 14px",
                  borderRadius: 8,
                  marginBottom: 6,
                  background: "#F9FAFB",
                  border: "1px solid #E5E7EB",
                }}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 4,
                    background: "#DCFCE7",
                    color: "#16A34A",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{f.title}</div>
                  <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.6, marginBottom: 4 }}>
                    {f.detail}
                  </div>
                  <div style={{ display: "flex", gap: 12, fontSize: 11 }}>
                    <span style={{ color: "#6366F1" }}>Tests H{f.hypothesis_link}</span>
                    <span style={{ color: "#16A34A" }}>{f.expected_impact}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Diagnostic SQL query</div>
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 8,
                background: "#F9FAFB",
                border: "1px solid #E5E7EB",
                marginBottom: 6,
                overflow: "auto",
              }}
            >
              <pre
                style={{
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  fontSize: 12,
                  lineHeight: 1.8,
                  whiteSpace: "pre-wrap",
                  margin: 0,
                  color: "#111827",
                }}
              >
                {analysis.sql_query}
              </pre>
            </div>
            <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.6 }}>
              {analysis.sql_explanation}
            </div>
          </div>

          <div
            style={{
              marginBottom: 24,
              padding: "20px",
              borderRadius: 12,
              border: "1px solid #E5E7EB",
              background: "#FAFBFF",
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 600, color: "#4338CA", marginBottom: 4 }}>
              Loved the diagnosis? (Or hated it?)
            </div>
            <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 14 }}>
              Your feedback shapes FunnelDoc.ai. Drop a quick testimonial below.
            </div>
            {feedbackSubmitted ? (
              <div
                style={{
                  fontSize: 14,
                  color: "#16A34A",
                  padding: "12px 0",
                }}
              >
                Thanks! Your testimonial has been saved.
              </div>
            ) : (
              <>
                <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setFeedbackRating(star)}
                      onMouseEnter={() => {}}
                      onMouseLeave={() => {}}
                      style={{
                        background: "transparent",
                        border: "none",
                        padding: 0,
                        fontSize: 24,
                        cursor: "pointer",
                        lineHeight: 1,
                        color: feedbackRating && star <= feedbackRating ? "#F59E0B" : "#E5E7EB",
                      }}
                      aria-label={`Rate ${star} out of 5`}
                    >
                      ★
                    </button>
                  ))}
                </div>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="What worked? What didn't? What should we build next?"
                  rows={4}
                  maxLength={1000}
                  disabled={feedbackSubmitting}
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: 8,
                    border: "1px solid #E5E7EB",
                    fontSize: 13,
                    fontFamily: "inherit",
                    resize: "vertical",
                    outline: "none",
                    color: "#111827",
                    background: "#fff",
                  }}
                />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: 10,
                  }}
                >
                  <div style={{ fontSize: 11, color: "#9CA3AF" }}>{feedback.length}/1000</div>
                  <button
                    onClick={submitFeedback}
                    disabled={!feedback.trim() || feedbackSubmitting}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 6,
                      border: "none",
                      background: feedback.trim() && !feedbackSubmitting ? "#6366F1" : "#F3F4F6",
                      color: feedback.trim() && !feedbackSubmitting ? "#fff" : "#9CA3AF",
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: feedback.trim() && !feedbackSubmitting ? "pointer" : "default",
                      fontFamily: "inherit",
                    }}
                  >
                    {feedbackSubmitting ? "Saving..." : "Send feedback"}
                  </button>
                </div>
                {feedbackError && (
                  <div style={{ color: "#EF4444", fontSize: 12, marginTop: 8 }}>{feedbackError}</div>
                )}
              </>
            )}
          </div>

          <button

            onClick={() => {
              setView("input");
              setAnalysis(null);
              setUsedFallback(false);
            }}
            style={{
              padding: "10px 20px",
              borderRadius: 8,
              border: "1px solid #E5E7EB",
              background: "transparent",
              fontSize: 13,
              cursor: "pointer",
              fontFamily: "inherit",
              color: "#6B7280",
            }}
          >
            ← Analyze another funnel
          </button>

          <div
            style={{
              textAlign: "center",
              marginTop: 24,
              padding: "16px 0",
              borderTop: "1px solid #E5E7EB",
            }}
          >
            <div style={{ fontSize: 13, color: "#6B7280" }}>
              Built by <span style={{ fontWeight: 500, color: "#111827" }}>Harshit Kant</span>
            </div>
            <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>
              I've been the human version of this tool. Now it runs in 30 seconds instead of 2 days.
            </div>
            <div style={{ marginTop: 12 }}>
              <a
                href="/testimonials"
                style={{
                  fontSize: 12,
                  color: "#6366F1",
                  textDecoration: "none",
                  fontWeight: 500,
                }}
              >
                View testimonials →
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
