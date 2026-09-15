import type { ReactNode } from "react";

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "#111827",
        maxWidth: 720,
        margin: "0 auto",
        padding: "48px 24px 80px",
        lineHeight: 1.65,
        fontSize: 15,
      }}
    >
      <a
        href="/"
        style={{ fontSize: 13, color: "#6366F1", textDecoration: "none", fontWeight: 500 }}
      >
        ← Back to FunnelDoc
      </a>
      <h1 style={{ fontSize: 28, fontWeight: 700, margin: "20px 0 6px", letterSpacing: -0.4 }}>
        {title}
      </h1>
      <p style={{ fontSize: 13, color: "#6B7280", margin: "0 0 28px" }}>Last updated: {updated}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>{children}</div>
      <p style={{ fontSize: 13, color: "#6B7280", marginTop: 40 }}>
        Questions about this page? Email{" "}
        <a href="mailto:support@funneldoc.ai" style={{ color: "#6366F1" }}>
          support@funneldoc.ai
        </a>
        .
      </p>
    </div>
  );
}

export function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h2 style={{ fontSize: 17, fontWeight: 600, margin: "0 0 8px" }}>{heading}</h2>
      <div style={{ color: "#374151", display: "flex", flexDirection: "column", gap: 10 }}>
        {children}
      </div>
    </section>
  );
}

export const ulStyle = { margin: 0, paddingLeft: 20, display: "grid", gap: 6 } as const;
