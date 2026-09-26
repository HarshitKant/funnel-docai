import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — FunnelDoc.ai" },
      { name: "description", content: "Sign in to FunnelDoc to run investigation reports." },
      { property: "og:title", content: "Sign in — FunnelDoc.ai" },
      { property: "og:description", content: "Sign in to FunnelDoc to run investigation reports." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const field: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 6,
  border: "1px solid #E5E7EB",
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
};

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: "/" });
    });
    supabase.auth.getSession().then(({ data: d }) => {
      if (d.session) navigate({ to: "/" });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setMsg("");
    const cleanEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || cleanEmail.length > 255) {
      setErr("Enter a valid email address.");
      return;
    }
    if (password.length < 8 || password.length > 72) {
      setErr("Password must be 8–72 characters.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        setMsg("Check your inbox to confirm your email, then sign in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
        if (error) throw error;
      }
    } catch (e: any) {
      setErr(e?.message ?? "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setErr("");
    const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (res && "error" in res && res.error) setErr(String((res.error as any).message ?? res.error));
  };

  return (
    <div
      style={{
        fontFamily: "system-ui, -apple-system, sans-serif",
        maxWidth: 380,
        margin: "0 auto",
        padding: "56px 16px",
        color: "#111827",
      }}
    >
      <a href="/" style={{ fontSize: 13, color: "#6366F1", textDecoration: "none" }}>
        ← Back to FunnelDoc
      </a>
      <h1 style={{ fontSize: 24, fontWeight: 600, margin: "18px 0 4px" }}>
        {mode === "signin" ? "Sign in" : "Create your account"}
      </h1>
      <p style={{ fontSize: 13, color: "#6B7280", margin: "0 0 20px" }}>
        Free plan: 3 reports per month. Upgrade to Pro anytime.
      </p>

      <button
        onClick={google}
        style={{
          width: "100%",
          padding: 11,
          borderRadius: 8,
          border: "1px solid #E5E7EB",
          background: "#fff",
          fontSize: 14,
          fontFamily: "inherit",
          cursor: "pointer",
        }}
      >
        Continue with Google
      </button>
      <div style={{ textAlign: "center", fontSize: 12, color: "#9CA3AF", margin: "14px 0" }}>or</div>

      <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={field} maxLength={255} />
        <input
          type="password"
          placeholder="Password (8+ characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={field}
          maxLength={72}
        />
        <button
          type="submit"
          disabled={busy}
          style={{
            padding: 11,
            borderRadius: 8,
            border: "none",
            background: "#6366F1",
            color: "#fff",
            fontSize: 14,
            fontWeight: 500,
            fontFamily: "inherit",
            cursor: busy ? "default" : "pointer",
            opacity: busy ? 0.7 : 1,
          }}
        >
          {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>
      {err && <div style={{ color: "#DC2626", fontSize: 13, marginTop: 10 }}>{err}</div>}
      {msg && <div style={{ color: "#16A34A", fontSize: 13, marginTop: 10 }}>{msg}</div>}
      <div style={{ fontSize: 13, color: "#6B7280", marginTop: 18 }}>
        {mode === "signin" ? "New here? " : "Already have an account? "}
        <button
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          style={{ border: "none", background: "none", color: "#6366F1", cursor: "pointer", fontSize: 13, padding: 0 }}
        >
          {mode === "signin" ? "Create an account" : "Sign in"}
        </button>
      </div>
    </div>
  );
}
