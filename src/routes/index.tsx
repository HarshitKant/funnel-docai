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

type Analysis = {
  overall_conversion: string;
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

function generateFallback(data: FunnelPoint[]): Analysis {
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
  return {
    overall_conversion: overall,
    kill_zone: {
      from: killDrop.from,
      to: killDrop.to,
      drop_pct: killDrop.drop + "%",
      insight: `${killDrop.drop}% of users drop off between ${killDrop.from} and ${killDrop.to}. These are users who showed intent by reaching ${killDrop.from} but hit a wall. This is the highest-leverage fix in your funnel.`,
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
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);



  useEffect(() => {
    if (!loading) return;
    const iv = setInterval(() => setLoadIdx((p) => (p + 1) % LOADING_MSGS.length), 1500);
    return () => clearInterval(iv);
  }, [loading]);

  const addStep = () => setSteps((p) => [...p, { step: "", users: "" }]);
  const removeStep = (i: number) => setSteps((p) => p.filter((_, idx) => idx !== i));
  const updateStep = (i: number, f: keyof Step, v: string) =>
    setSteps((p) => p.map((s, idx) => (idx === i ? { ...s, [f]: v } : s)));
  const loadSample = () => setSteps(SAMPLE_FUNNEL.map((s) => ({ ...s })));

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
      const parsed = await analyzeFn({ data: { steps: funnelData } });
      setAnalysis(parsed as Analysis);
      setView("results");
    } catch (e) {
      console.error("AI error, using fallback:", e);
      setAnalysis(generateFallback(funnelData));
      setUsedFallback(true);
      setView("results");
    } finally {
      setLoading(false);
    }
  }, [funnelData, analyzeFn]);

  const submitFeedback = useCallback(() => {
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
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem("funneldoc-feedback") : null;
      const existing = raw ? JSON.parse(raw) : [];
      existing.push({ text: trimmed, createdAt: new Date().toISOString() });
      if (typeof window !== "undefined") {
        localStorage.setItem("funneldoc-feedback", JSON.stringify(existing));
      }
    } catch {
      // Ignore storage errors; the thank-you still shows.
    }
    setFeedbackSubmitted(true);
    setFeedback("");
  }, [feedback]);

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
          Paste your funnel. Find the leak. Fix the revenue. In 30 seconds, not 2 days.
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
            {loading ? "Diagnosing..." : "Diagnose this funnel"}
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
            <span style={{ fontWeight: 600 }}>Kill zone: </span>
            {analysis.kill_zone.insight}
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Step-by-step breakdown</div>
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
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Top 3 hypotheses</div>
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

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Recommended fixes</div>
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
                Thanks! Your feedback means a lot.
              </div>
            ) : (
              <>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="What worked? What didn't? What should we build next?"
                  rows={4}
                  maxLength={1000}
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
                    disabled={!feedback.trim()}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 6,
                      border: "none",
                      background: feedback.trim() ? "#6366F1" : "#F3F4F6",
                      color: feedback.trim() ? "#fff" : "#9CA3AF",
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: feedback.trim() ? "pointer" : "default",
                      fontFamily: "inherit",
                    }}
                  >
                    Send feedback
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
          </div>
        </div>
      )}
    </div>
  );
}
