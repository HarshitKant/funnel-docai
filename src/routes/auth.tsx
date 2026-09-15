import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — FunnelDoc.ai" },
      {
        name: "description",
        content:
          "Sign in to FunnelDoc.ai to run investigations, keep your history, and access your unlocked account.",
      },
      { property: "og:title", content: "Sign in — FunnelDoc.ai" },
      {
        property: "og:description",
        content: "Sign in to run investigations and keep your FunnelDoc access across devices.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

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
};

const label: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 500,
  color: "#6B7280",
  marginBottom: 4,
};

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  const submit = async () => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (mode === "signup") {
        const { data, error: e } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (e) throw e;
        if (!data.session) {
          setNotice("Check your inbox and click the confirmation link to finish signing up.");
          return;
        }
      } else {
        const { error: e } = await supabase.auth.signInWithPassword({ email, password });
        if (e) throw e;
      }
      navigate({ to: "/" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "#111827",
        maxWidth: 400,
        margin: "0 auto",
        padding: "48px 16px",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.5px" }}>
          <span style={{ color: "#6366F1" }}>Funnel</span>Doc
          <span style={{ color: "#6366F1" }}>.</span>ai
        </div>
        <div style={{ fontSize: 13, color: "#6B7280", marginTop: 6 }}>
          {mode === "signin" ? "Sign in to run investigations." : "Create an account — 3 investigations free."}
        </div>
      </div>

      <div style={{ border: "1px solid #E5E7EB", borderRadius: 10, padding: 18, background: "#fff" }}>
        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <label style={label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              style={field}
            />
          </div>
          <div>
            <label style={label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={field}
            />
          </div>
        </div>

        {error && <div style={{ color: "#EF4444", fontSize: 12.5, marginTop: 12 }}>{error}</div>}
        {notice && <div style={{ color: "#0F766E", fontSize: 12.5, marginTop: 12 }}>{notice}</div>}

        <button
          onClick={submit}
          disabled={busy || !email.trim() || !password.trim()}
          style={{
            width: "100%",
            padding: 11,
            borderRadius: 8,
            border: "none",
            fontSize: 14,
            fontWeight: 500,
            fontFamily: "inherit",
            marginTop: 16,
            cursor: busy ? "default" : "pointer",
            background: busy ? "#F3F4F6" : "#6366F1",
            color: busy ? "#9CA3AF" : "#fff",
          }}
        >
          {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>

        <button
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError("");
            setNotice("");
          }}
          style={{
            width: "100%",
            marginTop: 10,
            padding: 8,
            border: "none",
            background: "transparent",
            fontSize: 12.5,
            fontFamily: "inherit",
            color: "#6366F1",
            cursor: "pointer",
          }}
        >
          {mode === "signin" ? "No account? Create one" : "Already have an account? Sign in"}
        </button>
      </div>

      <div style={{ textAlign: "center", marginTop: 18 }}>
        <Link to="/" style={{ fontSize: 12, color: "#9CA3AF", textDecoration: "none" }}>
          ← Back to FunnelDoc
        </Link>
      </div>
    </div>
  );
}
