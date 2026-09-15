import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, Section } from "@/components/LegalPage";

export const Route = createFileRoute("/refunds")({
  head: () => ({
    meta: [
      { title: "Refund Policy — FunnelDoc.ai" },
      {
        name: "description",
        content:
          "FunnelDoc.ai offers a 30-day money-back guarantee on the one-time unlock. Here is how to request a refund.",
      },
      { property: "og:title", content: "Refund Policy — FunnelDoc.ai" },
      {
        property: "og:description",
        content: "30-day money-back guarantee on the FunnelDoc.ai one-time unlock.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RefundsPage,
});

function RefundsPage() {
  return (
    <LegalPage title="Refund Policy" updated="16 September 2026">
      <Section heading="30-day money-back guarantee">
        <p>
          FunnelDoc.ai offers a 30-day money-back guarantee. If the one-time unlock is not useful to
          you, you can request a full refund within 30 days of your order date — no explanation
          needed.
        </p>
      </Section>

      <Section heading="How to request a refund">
        <p>
          Refunds are processed by our payment provider and Merchant of Record, Paddle. To request
          one, visit{" "}
          <a
            href="https://paddle.net"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#6366F1" }}
          >
            paddle.net
          </a>{" "}
          with the email address you used at checkout, or email{" "}
          <a href="mailto:support@funneldoc.ai" style={{ color: "#6366F1" }}>
            support@funneldoc.ai
          </a>{" "}
          and we will arrange it for you.
        </p>
        <p>
          Once a refund is approved, the money returns to your original payment method. Your
          bank or card issuer usually posts it within 5–10 business days.
        </p>
      </Section>

      <Section heading="After a refund">
        <p>
          When a purchase is refunded, the unlimited-investigation unlock is removed from your
          account and it returns to the free allowance. You are welcome to purchase again later.
        </p>
      </Section>

      <Section heading="Paddle's policy">
        <p>
          Paddle's own{" "}
          <a
            href="https://www.paddle.com/legal/refund-policy"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#6366F1" }}
          >
            refund policy
          </a>{" "}
          also applies to your purchase and, where it gives you more protection than this page, it
          takes precedence.
        </p>
      </Section>
    </LegalPage>
  );
}
