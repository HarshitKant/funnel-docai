import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { investigateMetricChange } from "@/lib/investigate.functions";
import { submitTestimonial } from "@/lib/testimonials.functions";
import { getAccess, type AccessState } from "@/lib/access.functions";
import { getCustomerPortalUrl } from "@/utils/payments.functions";
import { supabase } from "@/integrations/supabase/client";
import { getPaddleEnvironment, PRO_PRICE_ID } from "@/lib/paddle";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FunnelDoc.ai — Decide what to investigate next" },
      {
        name: "description",
        content:
          "Describe a metric change and the evidence you have. FunnelDoc separates what's known from what's assumed, keeps competing hypotheses honest, and tells you what to check next.",
      },
      { property: "og:title", content: "FunnelDoc.ai — Decide what to investigate next" },
      {
        property: "og:description",
        content:
          "Describe a metric change and the evidence you have. FunnelDoc separates what's known from what's assumed and tells you what to check next.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FunnelDoc,
});

type Investigation = {
  change: string;
  context: string;
  before: string;
  after: string;
  when: string;
  evidence: string;
};

type Result = {
  summary?: string;
  evidence_strength?: {
    level: string;
    reason: string;
    signals_present?: number;
    signals_total?: number;
    computed?: boolean;
  };
  known: string[];
  assumed: { claim: string; caveat?: string }[];
  unknown: (string | { item: string; why?: string })[];
  hypotheses: {
    id?: string;
    name: string;
    summary?: string;
    evidence_for?: string[];
    evidence_against?: string[];
    falsified_if?: string;
  }[];
  next_check: null | {
    action: string;
    why?: string;
    tests?: string[];
    requires?: string[];
    estimated_effort?: string;
    unlocks?: string[];
  };
  alternative_check?: { action: string; why?: string } | null;
  checklist?: string[];
  roadmap?: { week: string; focus: string }[];
  how_produced?: string[];
  plan?: "free" | "pro";
  locked?: null | { hypotheses: number; unknown: number; assumed: number; checklist: number; roadmap: number };
};

function Locked({ title, lines, onUnlock }: { title: string; lines: string; onUnlock: () => void }) {
  return (
    <div style={{ position: "relative", border: "1px dashed #C7D2FE", borderRadius: 10, padding: 16, background: "#FAFAFF", overflow: "hidden" }}>
      <div aria-hidden style={{ filter: "blur(5px)", userSelect: "none", pointerEvents: "none", display: "grid", gap: 8 }}>
        {[88, 72, 94, 60].map((w, i) => (
          <div key={i} style={{ height: 10, width: `${w}%`, background: "#D1D5DB", borderRadius: 4 }} />
        ))}
      </div>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, textAlign: "center", padding: 12 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>🔒 {title}</div>
        <div style={{ fontSize: 12, color: "#6B7280" }}>{lines}</div>
        <button onClick={onUnlock} style={{ marginTop: 4, padding: "7px 14px", borderRadius: 6, border: "none", background: "#6366F1", color: "#fff", fontSize: 12.5, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
          Unlock full report — Pro $10/month
        </button>
      </div>
    </div>
  );
}

const EMPTY: Investigation = { change: "", context: "", before: "", after: "", when: "", evidence: "" };

const SAMPLE: Investigation = {
  change: "KYC completion fell from 61% to 43% shortly after a new KYC flow was released.",
  context:
    "Cross-border fintech app. Users must complete KYC before sending their first international transfer.",
  before: "61%",
  after: "43%",
  when: "Decline began around the release, two days after it shipped",
  evidence: [
    "KYC starts remained roughly stable.",
    "KYC completion declined.",
    "Android declined more than iOS.",
    "A new KYC flow was released two days before the decline.",
    "No KYC vendor failure/latency data has been checked yet.",
    "No rejection-reason breakdown has been checked yet.",
    "Acquisition volume increased during the same period.",
  ].join("\n"),
};

const LOADING_MSGS = [
  "Reading your evidence…",
  "Separating facts from interpretations…",
  "Challenging each hypothesis…",
  "Ranking the next check by information value…",
];

const levelColor = (l?: string) =>
  l === "Strong" || l === "High" ? "#16A34A" : l === "Partial" || l === "Medium" ? "#B45309" : "#DC2626";
const levelBg = (l?: string) =>
  l === "Strong" || l === "High" ? "#DCFCE7" : l === "Partial" || l === "Medium" ? "#FEF3C7" : "#FEE2E2";

const READINESS_MEANING: Record<string, string> = {
  Strong:
    "Evidence is strong enough to support a more specific recommendation, while remaining explicit about the remaining uncertainty.",
  Partial:
    "Enough evidence to prioritize the next investigation. Not enough evidence to determine root cause.",
  Weak: "Not enough evidence to prioritize a root cause. Collect additional evidence before acting.",
};



const label: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 500,
  color: "#6B7280",
  marginBottom: 4,
};

const field: React.CSSProperties = {
  width: "100%",
  padding: "9px 11px",
  borderRadius: 6,
  border: "1px solid #E5E7EB",
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
  color: "#111827",
  background: "#fff",
  resize: "vertical",
};

const card: React.CSSProperties = {
  border: "1px solid #E5E7EB",
  borderRadius: 10,
  padding: 16,
  background: "#fff",
};

const sectionTitle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  color: "#111827",
};

const sectionSub: React.CSSProperties = { fontSize: 12, color: "#9CA3AF", marginTop: 2 };

const linkBtn: React.CSSProperties = {
  border: "none",
  background: "none",
  padding: 0,
  color: "#6366F1",
  fontSize: 12.5,
  fontWeight: 500,
  cursor: "pointer",
  fontFamily: "inherit",
};

function FunnelDoc() {
  const [form, setForm] = useState<Investigation>(EMPTY);
  const [view, setView] = useState<"input" | "results">("input");
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadIdx, setLoadIdx] = useState(0);
  const [error, setError] = useState("");

  const [changedAnswer, setChangedAnswer] = useState<"Yes" | "Partly" | "No" | null>(null);
  const [counterfactual, setCounterfactual] = useState("");
  const [fbSubmitting, setFbSubmitting] = useState(false);
  const [fbDone, setFbDone] = useState(false);
  const [fbError, setFbError] = useState("");

  const run = useServerFn(investigateMetricChange);
  const sendFeedback = useServerFn(submitTestimonial);
  const fetchAccess = useServerFn(getAccess);
  const fetchPortal = useServerFn(getCustomerPortalUrl);
  const { openCheckout, loading: checkoutLoading } = usePaddleCheckout();
  const env = getPaddleEnvironment();

  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [access, setAccess] = useState<AccessState | null>(null);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ? { id: session.user.id, email: session.user.email } : null);
      setAuthReady(true);
    });
    supabase.auth.getSession().then(({ data: d }) => {
      const u = d.session?.user;
      setUser(u ? { id: u.id, email: u.email } : null);
      setAuthReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const refreshAccess = useCallback(async () => {
    try {
      const a = await fetchAccess({ data: { environment: env } });
      setAccess(a);
      return a;
    } catch {
      return null;
    }
  }, [fetchAccess, env]);

  useEffect(() => {
    if (!user) {
      setAccess(null);
      return;
    }
    refreshAccess();
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("checkout") === "success") {
      let tries = 0;
      const t = setInterval(async () => {
        tries++;
        const a = await refreshAccess();
        if (a?.plan === "pro" || tries >= 10) clearInterval(t);
      }, 2500);
      return () => clearInterval(t);
    }
  }, [user, refreshAccess]);

  const upgrade = useCallback(() => {
    if (!user) {
      window.location.href = "/auth";
      return;
    }
    openCheckout({
      priceId: PRO_PRICE_ID,
      customerEmail: user.email,
      customData: { userId: user.id },
      successUrl: `${window.location.origin}/?checkout=success`,
    });
  }, [user, openCheckout]);

  const manage = useCallback(async () => {
    try {
      const url = await fetchPortal({ data: { environment: env } });
      window.open(url, "_blank", "noopener");
    } catch {
      setError("Could not open subscription settings. Please try again.");
    }
  }, [fetchPortal, env]);

  const outOfRuns = !!access && !access.canRun;

  useEffect(() => {
    if (!loading) return;
    const t = setInterval(() => setLoadIdx((i) => (i + 1) % LOADING_MSGS.length), 1800);
    return () => clearInterval(t);
  }, [loading]);

  const set = (k: keyof Investigation, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const analyze = useCallback(async () => {
    if (!form.change.trim()) {
      setError("Describe what changed to start an investigation.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const r = (await run({
        data: {
          ...form,
          environment: env,
        },
      })) as Result;
      refreshAccess();
      setResult(r);
      setView("results");
      setChangedAnswer(null);
      setCounterfactual("");
      setFbDone(false);
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("PAYMENT_REQUIRED")) setError("You've used your 3 free reports this month. Upgrade to Pro for unlimited reports.");
      else if (/unauthori/i.test(msg)) setError("Please sign in to run a report.");
      else setError(msg ? `Analysis failed: ${msg}` : "Analysis failed. Please try again.");
    }
    finally {
      setLoading(false);
    }
  }, [form, run, env, mode, stages, leaks, refreshAccess]);

  const submitValidation = useCallback(async () => {
    if (!changedAnswer) return;
    setFbSubmitting(true);
    setFbError("");
    try {
      const message = [
        `Did this change what you would investigate next? ${changedAnswer}`,
        counterfactual.trim() ? `Without FunnelDoc I would have investigated: ${counterfactual.trim()}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      await sendFeedback({
        data: {
          message,
          pageUrl: typeof window !== "undefined" ? window.location.href : undefined,
        },
      });
      setFbDone(true);
    } catch (e) {
      console.error(e);
      setFbError("Could not save your feedback. Please try again.");
    } finally {
      setFbSubmitting(false);
    }
  }, [changedAnswer, counterfactual, sendFeedback]);


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
      <div className="no-print" style={{ margin: "0 -16px" }}>
        <PaymentTestModeBanner />
      </div>
      <div className="no-print" style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10, padding: "10px 0", fontSize: 12.5, color: "#6B7280", flexWrap: "wrap" }}>
        {authReady && user ? (
          <>
            <span>{user.email}</span>
            {access && (
              <span style={{ padding: "2px 8px", borderRadius: 10, fontWeight: 600, fontSize: 11, background: access.plan === "pro" ? "#EEF2FF" : "#F3F4F6", color: access.plan === "pro" ? "#4338CA" : "#6B7280" }}>
                {access.plan === "pro" ? "PRO" : `FREE · ${access.runsLeft}/${access.freeLimit} left this month`}
              </span>
            )}
            {access?.plan === "pro" ? (
              <button onClick={manage} style={linkBtn}>Manage subscription</button>
            ) : (
              <button onClick={upgrade} disabled={checkoutLoading} style={linkBtn}>Upgrade — $10/mo</button>
            )}
            <button onClick={() => supabase.auth.signOut()} style={linkBtn}>Sign out</button>
          </>
        ) : authReady ? (
          <a href="/auth" style={{ color: "#6366F1", textDecoration: "none", fontWeight: 500 }}>Sign in</a>
        ) : null}
      </div>
      {access?.pastDue && (
        <div className="no-print" style={{ fontSize: 12.5, color: "#92400E", background: "#FEF3C7", borderRadius: 8, padding: "8px 12px", marginBottom: 8 }}>
          Your last payment failed. Paddle will retry automatically — <button onClick={manage} style={linkBtn}>update your card</button>.
        </div>
      )}
      {access?.plan === "pro" && access.cancelAtPeriodEnd && access.periodEnd && (
        <div className="no-print" style={{ fontSize: 12.5, color: "#6B7280", marginBottom: 8, textAlign: "right" }}>
          Pro ends on {new Date(access.periodEnd).toLocaleDateString()}.
        </div>
      )}

      <div style={{ textAlign: "center", padding: "12px 0 8px" }}>
        <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.5px" }}>
          <span style={{ color: "#6366F1" }}>Funnel</span>Doc
          <span style={{ color: "#6366F1" }}>.</span>ai
        </div>
        <div style={{ fontSize: 14, color: "#6B7280", marginTop: 6, maxWidth: 520, margin: "6px auto 0" }}>
          FunnelDoc separates what your data shows from what it doesn’t prove.
        </div>
      </div>

      <div className="no-print" style={{ display: "flex", justifyContent: "center", gap: 6, margin: "16px 0 20px" }}>
        {([
          ["input", "Investigation"],
          ["results", "Evidence"],
        ] as const).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setView(k)}
            disabled={k === "results" && !result}
            style={{
              padding: "6px 16px",
              borderRadius: 20,
              fontSize: 13,
              fontFamily: "inherit",
              cursor: k === "results" && !result ? "default" : "pointer",
              border: "1px solid",
              borderColor: view === k ? "#6366F1" : "#E5E7EB",
              background: view === k ? "#EEF2FF" : "transparent",
              color: view === k ? "#4338CA" : k === "results" && !result ? "#D1D5DB" : "#6B7280",
              fontWeight: view === k ? 500 : 400,
            }}
          >
            {l}
          </button>
        ))}
      </div>

      {view === "input" && (
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={sectionTitle}>Investigate a metric change</div>
              <div style={sectionSub}>Tell FunnelDoc what changed and what evidence you already have.</div>
            </div>
            <button
              onClick={() => setForm(SAMPLE)}
              style={{
                padding: "5px 12px",
                borderRadius: 6,
                border: "1px solid #E5E7EB",
                background: "transparent",
                fontSize: 12,
                cursor: "pointer",
                fontFamily: "inherit",
                color: "#6366F1",
                whiteSpace: "nowrap",
              }}
            >
              Load sample investigation
            </button>
          </div>

          <div style={{ display: "grid", gap: 14, marginTop: 18 }}>
            <div>
              <label style={label}>What changed?</label>
              <textarea
                value={form.change}
                onChange={(e) => set("change", e.target.value)}
                rows={2}
                placeholder="e.g. Checkout conversion fell from 31% to 24% after August 20."
                style={{ ...field, fontSize: 14 }}
              />
            </div>

            <div>
              <label style={label}>Business / product context</label>
              <textarea
                value={form.context}
                onChange={(e) => set("context", e.target.value)}
                rows={2}
                placeholder="e.g. B2C fintech app. Primary goal is first successful transaction."
                style={field}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <div>
                <label style={label}>Metric before (optional)</label>
                <input value={form.before} onChange={(e) => set("before", e.target.value)} placeholder="31%" style={field} />
              </div>
              <div>
                <label style={label}>Metric after (optional)</label>
                <input value={form.after} onChange={(e) => set("after", e.target.value)} placeholder="24%" style={field} />
              </div>
              <div>
                <label style={label}>When did it happen?</label>
                <input value={form.when} onChange={(e) => set("when", e.target.value)} placeholder="August 20" style={field} />
              </div>
            </div>

            <div>
              <label style={label}>Evidence / observations you already have</label>
              <textarea
                value={form.evidence}
                onChange={(e) => set("evidence", e.target.value)}
                rows={6}
                placeholder="Paste any observations, funnel numbers, segment breakdowns, experiment notes, release information, SQL results, or other evidence you already have."
                style={field}
              />
            </div>
          </div>

          <div style={{ fontSize: 11.5, color: "#92400E", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 6, padding: "7px 10px", marginTop: 12, lineHeight: 1.5 }}>
            Remove customer names before submitting. Phone numbers and emails are stripped automatically, and nothing you enter is stored. FunnelDoc suggests investigations only — never medical, legal or financial advice.
          </div>

          {error && <div style={{ color: "#EF4444", fontSize: 13, marginTop: 12 }}>{error}</div>}

          {authReady && !user ? (
            <a
              href="/auth"
              style={{ display: "block", textAlign: "center", padding: 12, borderRadius: 8, background: "#6366F1", color: "#fff", fontSize: 14, fontWeight: 500, textDecoration: "none", marginTop: 18 }}
            >
              Sign in to run a report — 3 free per month
            </a>
          ) : outOfRuns ? (
            <button
              onClick={upgrade}
              disabled={checkoutLoading}
              style={{ width: "100%", padding: 12, borderRadius: 8, border: "none", fontSize: 14, fontWeight: 500, fontFamily: "inherit", cursor: "pointer", marginTop: 18, background: "#6366F1", color: "#fff" }}
            >
              You've used your free reports — Upgrade for $10/month
            </button>
          ) : (
          <button
            onClick={analyze}
            disabled={loading || !form.change.trim()}
            style={{
              width: "100%",
              padding: 12,
              borderRadius: 8,
              border: "none",
              fontSize: 14,
              fontWeight: 500,
              fontFamily: "inherit",
              cursor: loading || !form.change.trim() ? "default" : "pointer",
              marginTop: 18,
              background: loading || !form.change.trim() ? "#F3F4F6" : "#6366F1",
              color: loading || !form.change.trim() ? "#9CA3AF" : "#fff",
            }}
          >
            {loading ? "Analyzing evidence…" : "Analyze evidence"}
          </button>
          )}

          {loading && (
            <div style={{ textAlign: "center", fontSize: 12, color: "#6366F1", marginTop: 8 }}>
              {LOADING_MSGS[loadIdx]}
            </div>
          )}
        </div>
      )}

      {view === "results" && result && (
        <div style={{ display: "grid", gap: 22 }}>
          {/* Summary + evidence strength */}
          <div style={card}>
            {result.evidence_strength && (
              <span
                style={{
                  display: "inline-block",
                  padding: "3px 10px",
                  borderRadius: 12,
                  fontSize: 11,
                  fontWeight: 600,
                  marginBottom: 10,
                  color: levelColor(result.evidence_strength.level),
                  background: levelBg(result.evidence_strength.level),
                }}
              >
                Evidence: {result.evidence_strength.level}
              </span>
            )}
            {result.summary && (
              <div style={{ fontSize: 14, lineHeight: 1.6, color: "#111827" }}>{result.summary}</div>
            )}
            {result.evidence_strength?.reason && (
              <div style={{ fontSize: 12.5, color: "#6B7280", marginTop: 8, lineHeight: 1.5 }}>
                {result.evidence_strength.reason}
              </div>
            )}
            {result.evidence_strength && READINESS_MEANING[result.evidence_strength.level] && (
              <div style={{ fontSize: 12.5, color: "#374151", marginTop: 8, lineHeight: 1.5 }}>
                {READINESS_MEANING[result.evidence_strength.level]}
              </div>
            )}
          </div>

          {/* Evidence ledger */}
          <div>
            <div style={sectionTitle}>Evidence Ledger</div>
            <div style={{ ...sectionSub, marginBottom: 12 }}>
              Separate what the evidence supports from what it doesn’t.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              {[
                {
                  key: "known",
                  title: "Known",
                  sub: "Supported by evidence",
                  color: "#0F766E",
                  bg: "#F0FDFA",
                  border: "#99F6E4",
                },
                {
                  key: "assumed",
                  title: "Assumed",
                  sub: "Plausible, not proven",
                  color: "#B45309",
                  bg: "#FFFBEB",
                  border: "#FDE68A",
                },
                {
                  key: "unknown",
                  title: "Unknown",
                  sub: "Evidence still needed",
                  color: "#4338CA",
                  bg: "#F5F3FF",
                  border: "#DDD6FE",
                },
              ].map((col) => (
                <div
                  key={col.key}
                  style={{
                    border: `1px solid ${col.border}`,
                    background: col.bg,
                    borderRadius: 10,
                    padding: 14,
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.4px", color: col.color }}>
                    {col.title.toUpperCase()}
                  </div>
                  <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2, marginBottom: 10 }}>{col.sub}</div>
                  <div style={{ display: "grid", gap: 9 }}>
                    {col.key === "assumed"
                      ? (result.assumed ?? []).map((a, i) => (
                          <div key={i}>
                            <div style={{ fontSize: 12.5, lineHeight: 1.45, color: "#111827" }}>• {a.claim}</div>
                            {a.caveat && (
                              <div style={{ fontSize: 11, color: "#92400E", marginTop: 3, paddingLeft: 10, lineHeight: 1.45 }}>
                                {a.caveat}
                              </div>
                            )}
                          </div>
                        ))
                      : col.key === "unknown"
                        ? (result.unknown ?? []).map((u, i) => {
                            const item = typeof u === "string" ? u : u.item;
                            const why = typeof u === "string" ? undefined : u.why;
                            return (
                              <div key={i}>
                                <div style={{ fontSize: 12.5, lineHeight: 1.45, color: "#111827" }}>• {item}</div>
                                {why && (
                                  <div
                                    style={{
                                      fontSize: 11,
                                      color: "#4338CA",
                                      marginTop: 3,
                                      paddingLeft: 10,
                                      lineHeight: 1.45,
                                    }}
                                  >
                                    {why}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        : (result.known ?? []).map((t, i) => (
                            <div key={i} style={{ fontSize: 12.5, lineHeight: 1.45, color: "#111827" }}>
                              • {t}
                            </div>
                          ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {result.locked && (
            <Locked
              title="Full assumptions & missing-evidence list"
              lines={`${result.locked.assumed} assumptions and ${result.locked.unknown} more missing-evidence items, each with why it matters.`}
              onUnlock={upgrade}
            />
          )}

          {/* Competing hypotheses */}
          <div>
            <div style={sectionTitle}>Competing hypotheses</div>
            <div style={{ ...sectionSub, marginBottom: 12 }}>Possible explanations — not findings.</div>
            <div style={{ display: "grid", gap: 10 }}>
              {result.locked &&
                result.hypotheses.slice(0, 1).map((h, i) => (
                  <div key={i} style={card}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#6366F1" }}>{h.id ?? "H1"}</span>{" "}
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{h.name}</span>
                  </div>
                ))}
              {result.locked && (
                <Locked
                  title="Evidence for / against and what would disprove each explanation"
                  lines={`${result.locked.hypotheses} competing explanations analysed.`}
                  onUnlock={upgrade}
                />
              )}
              {!result.locked && result.hypotheses.slice(0, 3).map((h, i) => (
                <div key={i} style={card}>
                  <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#6366F1" }}>{h.id ?? `H${i + 1}`}</span>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{h.name}</span>
                  </div>
                  {h.summary && (
                    <div style={{ fontSize: 13, color: "#4B5563", marginTop: 6, lineHeight: 1.55 }}>{h.summary}</div>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginTop: 12 }}>
                    <div>
                      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.4px", color: "#15803D" }}>
                        EVIDENCE FOR
                      </div>
                      <div style={{ marginTop: 5, display: "grid", gap: 4 }}>
                        {(h.evidence_for?.length ? h.evidence_for : ["No supporting evidence supplied yet."]).map((e, j) => (
                          <div key={j} style={{ fontSize: 12.5, color: "#111827", lineHeight: 1.45 }}>• {e}</div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.4px", color: "#B91C1C" }}>
                        EVIDENCE AGAINST
                      </div>
                      <div style={{ marginTop: 5, display: "grid", gap: 4 }}>
                        {(h.evidence_against?.length ? h.evidence_against : ["No contradictory evidence supplied yet."]).map(
                          (e, j) => (
                            <div key={j} style={{ fontSize: 12.5, color: "#111827", lineHeight: 1.45 }}>• {e}</div>
                          ),
                        )}
                      </div>
                    </div>
                  </div>
                  {h.falsified_if && (
                    <div
                      style={{
                        marginTop: 12,
                        padding: "9px 11px",
                        borderRadius: 8,
                        background: "#F9FAFB",
                        border: "1px solid #E5E7EB",
                      }}
                    >
                      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.4px", color: "#6B7280" }}>
                        WOULD BE FALSIFIED IF
                      </div>
                      <div style={{ fontSize: 12.5, color: "#111827", marginTop: 4, lineHeight: 1.45 }}>
                        {h.falsified_if}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Hero: check this next */}
          {!result.next_check ? (
            <Locked title="Check this next — exact steps, data to pull, effort" lines="The single highest-value next investigation for your case." onUnlock={upgrade} />
          ) : (
          <div
            style={{
              border: "1px solid #C7D2FE",
              background: "linear-gradient(180deg,#EEF2FF 0%,#FFFFFF 80%)",
              borderRadius: 14,
              padding: 22,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.6px", color: "#4338CA" }}>
              CHECK THIS NEXT
            </div>
            <div style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.4, marginTop: 8, letterSpacing: "-0.2px" }}>
              {result.next_check.action}
            </div>
            {result.next_check.why && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.4px", color: "#6B7280" }}>
                  WHY THIS FIRST
                </div>
                <div style={{ fontSize: 13.5, color: "#374151", marginTop: 4, lineHeight: 1.6 }}>
                  {result.next_check.why}
                </div>
              </div>
            )}
            {!!result.next_check.unlocks?.length && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.4px", color: "#6B7280" }}>
                  WHAT THIS DECISION UNLOCKS
                </div>
                <div style={{ marginTop: 5, display: "grid", gap: 4 }}>
                  {result.next_check.unlocks.map((u, i) => (
                    <div key={i} style={{ fontSize: 12.5, color: "#374151", lineHeight: 1.5 }}>
                      • {u}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
              {[
                { l: "Tests", v: result.next_check.tests?.join(", ") },
                { l: "Requires", v: result.next_check.requires?.join(" + ") },
                { l: "Estimated effort", v: result.next_check.estimated_effort },
              ]
                .filter((x) => x.v)
                .map((x, i) => (
                  <div
                    key={i}
                    style={{
                      border: "1px solid #E5E7EB",
                      background: "#fff",
                      borderRadius: 8,
                      padding: "7px 11px",
                    }}
                  >
                    <div style={{ fontSize: 10, color: "#9CA3AF", letterSpacing: "0.3px" }}>{x.l}</div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 2 }}>{x.v}</div>
                  </div>
                ))}
            </div>
          </div>
          )}

          {!!result.checklist?.length && (
            <div style={card}>
              <div style={sectionTitle}>Implementation checklist</div>
              <div style={{ ...sectionSub, marginBottom: 10 }}>AI-generated · how to run the next check</div>
              <ol style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 5 }}>
                {result.checklist.map((c, i) => (
                  <li key={i} style={{ fontSize: 13, color: "#374151", lineHeight: 1.5 }}>{c}</li>
                ))}
              </ol>
            </div>
          )}

          {!!result.roadmap?.length && (
            <div style={card}>
              <div style={sectionTitle}>30-day investigation roadmap</div>
              <div style={{ ...sectionSub, marginBottom: 10 }}>AI-generated · cheapest, most decisive checks first</div>
              <div style={{ display: "grid", gap: 8 }}>
                {result.roadmap.map((r, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "72px 1fr", gap: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#4338CA" }}>{r.week}</div>
                    <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.5 }}>{r.focus}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.locked && (
            <Locked title="Implementation checklist, 30-day roadmap & PDF download" lines="Step-by-step plan to run the investigation." onUnlock={upgrade} />
          )}

          {!result.locked && (
            <div className="no-print">
              <button
                onClick={() => window.print()}
                style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid #C7D2FE", background: "#EEF2FF", color: "#4338CA", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
              >
                Download PDF report
              </button>
            </div>
          )}

          {!!result.how_produced?.length && (
            <div style={{ ...card, background: "#F9FAFB" }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.4px", color: "#6B7280" }}>HOW THIS REPORT WAS PRODUCED</div>
              <div style={{ display: "grid", gap: 4, marginTop: 6 }}>
                {result.how_produced.map((h, i) => (
                  <div key={i} style={{ fontSize: 12, color: "#4B5563", lineHeight: 1.5 }}>• {h}</div>
                ))}
              </div>
              <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 8 }}>
                AI-assisted output. Not professional, medical, legal or financial advice — verify before acting.
              </div>
            </div>
          )}

          {result.alternative_check?.action && (
            <div style={{ ...card, background: "#FAFAFA" }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.4px", color: "#9CA3AF" }}>
                ALTERNATIVE CHECK
              </div>
              <div style={{ fontSize: 13, marginTop: 5, color: "#374151", lineHeight: 1.5 }}>
                {result.alternative_check.action}
              </div>
              {result.alternative_check.why && (
                <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 4, lineHeight: 1.5 }}>
                  {result.alternative_check.why}
                </div>
              )}
            </div>
          )}

          {/* Validation */}
          <div className="no-print" style={{ ...card, background: "#F9FAFB" }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Did this change what you would investigate next?</div>
            {fbDone ? (
              <div style={{ fontSize: 13, color: "#16A34A", marginTop: 10 }}>
                Thanks — that helps us test whether FunnelDoc actually changes decisions.
              </div>
            ) : (
              <>
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  {(["Yes", "Partly", "No"] as const).map((a) => (
                    <button
                      key={a}
                      onClick={() => setChangedAnswer(a)}
                      style={{
                        padding: "7px 18px",
                        borderRadius: 20,
                        fontSize: 13,
                        fontFamily: "inherit",
                        cursor: "pointer",
                        border: "1px solid",
                        borderColor: changedAnswer === a ? "#6366F1" : "#E5E7EB",
                        background: changedAnswer === a ? "#EEF2FF" : "#fff",
                        color: changedAnswer === a ? "#4338CA" : "#6B7280",
                        fontWeight: changedAnswer === a ? 500 : 400,
                      }}
                    >
                      {a}
                    </button>
                  ))}
                </div>

                {changedAnswer && (
                  <div style={{ marginTop: 14 }}>
                    <label style={label}>What would you have investigated first without FunnelDoc?</label>
                    <input
                      value={counterfactual}
                      onChange={(e) => setCounterfactual(e.target.value)}
                      maxLength={500}
                      placeholder="Optional — one line is enough"
                      style={field}
                    />
                    <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 5 }}>
                      This helps us understand whether the investigation changed your decision.
                    </div>
                    <button
                      onClick={submitValidation}
                      disabled={fbSubmitting}
                      style={{
                        marginTop: 10,
                        padding: "8px 16px",
                        borderRadius: 6,
                        border: "none",
                        background: fbSubmitting ? "#F3F4F6" : "#6366F1",
                        color: fbSubmitting ? "#9CA3AF" : "#fff",
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: fbSubmitting ? "default" : "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      {fbSubmitting ? "Saving…" : "Submit feedback"}
                    </button>
                    {fbError && <div style={{ color: "#EF4444", fontSize: 12, marginTop: 8 }}>{fbError}</div>}
                  </div>
                )}
              </>
            )}
          </div>

          <div>
            <button
              onClick={() => {
                setView("input");
                setResult(null);
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
              ← Start another investigation
            </button>
          </div>

          <div style={{ textAlign: "center", padding: "16px 0", borderTop: "1px solid #E5E7EB" }}>
            <div style={{ fontSize: 13, color: "#6B7280" }}>
              Built by <span style={{ fontWeight: 500, color: "#111827" }}>Harshit Kant</span>
            </div>
            <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>
              An experiment in deciding what to investigate before deciding what to fix.
            </div>
            <div style={{ marginTop: 12 }}>
              <a href="/testimonials" style={{ fontSize: 12, color: "#6366F1", textDecoration: "none", fontWeight: 500 }}>
                View testimonials →
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
