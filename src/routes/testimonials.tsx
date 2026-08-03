import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { getTestimonials } from "@/lib/testimonials.functions";

const testimonialsQueryOptions = () =>
  queryOptions({
    queryKey: ["testimonials"],
    queryFn: () => getTestimonials(),
  });

export const Route = createFileRoute("/testimonials")({
  head: () => ({
    meta: [
      { title: "Testimonials — FunnelDoc.ai" },
      {
        name: "description",
        content: "See what visitors are saying about FunnelDoc.ai.",
      },
      { property: "og:title", content: "Testimonials — FunnelDoc.ai" },
      {
        property: "og:description",
        content: "See what visitors are saying about FunnelDoc.ai.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(testimonialsQueryOptions()),
  component: TestimonialsPage,
  errorComponent: ({ error }) => (
    <div role="alert" style={{ padding: 40, textAlign: "center" }}>
      Could not load testimonials: {error.message}
    </div>
  ),
  notFoundComponent: () => (
    <div style={{ padding: 40, textAlign: "center" }}>No testimonials yet.</div>
  ),
});

function StarRating({ rating }: { rating: number | null }) {
  if (!rating) return null;
  return (
    <div style={{ color: "#F59E0B", fontSize: 14, marginTop: 4 }}>
      {"★".repeat(rating)}
      {"☆".repeat(5 - rating)}
    </div>
  );
}

function TestimonialsPage() {
  const { data: testimonials } = useSuspenseQuery(testimonialsQueryOptions());

  return (
    <div
      style={{
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "#111827",
        maxWidth: 720,
        margin: "0 auto",
        padding: "40px 16px",
      }}
    >
      <div style={{ marginBottom: 24 }}>
        <Link
          to="/"
          style={{
            fontSize: 14,
            color: "#6366F1",
            textDecoration: "none",
            fontWeight: 500,
          }}
        >
          ← Back to FunnelDoc.ai
        </Link>
      </div>

      <h1 style={{ fontSize: 24, fontWeight: 600, margin: "0 0 8px" }}>Visitor feedback</h1>
      <p style={{ fontSize: 14, color: "#6B7280", margin: "0 0 24px" }}>
        Testimonials and ratings submitted by people who tried the diagnosis.
      </p>

      {testimonials.length === 0 ? (
        <div
          style={{
            padding: 32,
            textAlign: "center",
            border: "1px dashed #E5E7EB",
            borderRadius: 12,
            color: "#6B7280",
            fontSize: 14,
          }}
        >
          No testimonials yet. Submit the first one from the diagnosis page.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {testimonials.map((t) => (
            <div
              key={t.id}
              style={{
                border: "1px solid #E5E7EB",
                borderRadius: 12,
                padding: 20,
                background: "#FAFAFA",
              }}
            >
              <StarRating rating={t.rating} />
              <p
                style={{
                  fontSize: 15,
                  lineHeight: 1.5,
                  margin: "10px 0 0",
                  whiteSpace: "pre-wrap",
                }}
              >
                “{t.message}”
              </p>
              <div
                style={{
                  fontSize: 12,
                  color: "#9CA3AF",
                  marginTop: 12,
                }}
              >
                Submitted {t.created_at ? new Date(t.created_at).toLocaleString() : "recently"}
                {t.source ? ` · ${t.source}` : ""}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
