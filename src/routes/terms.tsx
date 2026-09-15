import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, Section, ulStyle } from "@/components/LegalPage";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Conditions — FunnelDoc.ai" },
      {
        name: "description",
        content:
          "The terms that govern your use of FunnelDoc.ai, the funnel preflight tool that separates evidence from assumptions.",
      },
      { property: "og:title", content: "Terms & Conditions — FunnelDoc.ai" },
      {
        property: "og:description",
        content: "The terms that govern your use of FunnelDoc.ai.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalPage title="Terms & Conditions" updated="16 September 2026">
      <Section heading="1. Who you are contracting with">
        <p>
          FunnelDoc.ai ("FunnelDoc", "we", "us") operates this website and the funnel preflight
          service available on it. By creating an account, running an investigation, or otherwise
          using the service, you enter into an agreement with FunnelDoc.ai on these terms.
        </p>
      </Section>

      <Section heading="2. Acceptance">
        <p>
          By continuing to use the service you agree to these terms. If you do not agree, please
          stop using the service. If you use FunnelDoc on behalf of a company, you confirm you have
          authority to bind that company; if you use it as an individual, you confirm you are of
          legal age in your country.
        </p>
      </Section>

      <Section heading="3. What the service does">
        <p>
          You describe a metric change and supply funnel numbers and business context. FunnelDoc
          separates what your data measurably shows from what it does not prove, lists competing
          hypotheses with the evidence for and against each, and suggests one investigation to run
          next. Deterministic calculations (such as measured drop-offs) are labelled separately from
          AI-generated hypotheses.
        </p>
      </Section>

      <Section heading="4. Accuracy and no professional advice">
        <p>
          FunnelDoc uses generative AI. Outputs may be incomplete, mistaken, or inapplicable to your
          situation, and hypotheses are explicitly not statements of fact. Outputs are for general
          and educational purposes only and are not financial, legal, tax, or other professional
          advice. You are responsible for verifying anything before you act on it, and for the
          business decisions you make.
        </p>
      </Section>

      <Section heading="5. Your inputs and outputs">
        <p>
          You are responsible for the prompts, metrics, and context you submit, for having the right
          to submit them, and for how you use the results. You grant us a limited licence to host
          and process your inputs solely to operate and improve the service. You keep whatever
          rights you already had in your inputs, and you may use the outputs generated for you.
        </p>
        <p>
          Do not submit personal data you are not permitted to share, confidential information you
          are not authorised to disclose, or content that infringes anyone's rights. If you believe
          content on the service infringes your rights, email us and we will investigate; repeated
          infringement leads to account termination.
        </p>
      </Section>

      <Section heading="6. Acceptable use">
        <p>You must not:</p>
        <ul style={ulStyle}>
          <li>use the service unlawfully, fraudulently, or to send spam;</li>
          <li>
            generate or seek illegal content, deepfakes, harassment, hate speech, malware, or
            content designed to deceive or defraud others;
          </li>
          <li>attempt to bypass safety filters, usage limits, or entitlement checks;</li>
          <li>infringe intellectual property or privacy rights;</li>
          <li>
            probe, scrape, overload, or otherwise interfere with the security or integrity of the
            service;
          </li>
          <li>reverse engineer the service, resell it, or redistribute it as your own.</li>
        </ul>
        <p>
          We may remove or restrict content, filter or refuse outputs, and moderate accounts to
          enforce this section.
        </p>
      </Section>

      <Section heading="7. Accounts">
        <p>
          You must provide accurate information, keep it current, and keep your login credentials
          confidential. You are responsible for activity under your account.
        </p>
      </Section>

      <Section heading="8. Intellectual property">
        <p>
          We own the service and everything in it other than your inputs — including the software,
          prompts, interface, documentation, and branding. You receive a limited, non-exclusive,
          non-transferable right to use the service for its intended purpose.
        </p>
      </Section>

      <Section heading="9. Service availability">
        <p>
          We work to keep FunnelDoc available, but we do not guarantee uninterrupted or error-free
          performance. Features may change, and maintenance or third-party outages may interrupt
          access. To the fullest extent permitted by law we disclaim all implied warranties,
          including merchantability and fitness for a particular purpose.
        </p>
      </Section>

      <Section heading="10. Payment, billing and cancellation">
        <p>
          Paid access is a one-time purchase that unlocks unlimited investigations on your account.
          There is no subscription and nothing renews automatically. Prices are shown before
          checkout and may include tax depending on your location.
        </p>
        <p>
          Payment, billing, tax, invoicing, cancellation and refund mechanics are handled by Paddle
          under its{" "}
          <a
            href="https://www.paddle.com/legal/checkout-buyer-terms"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#6366F1" }}
          >
            Buyer Terms
          </a>
          . See our <a href="/refunds" style={{ color: "#6366F1" }}>Refund Policy</a> for refunds.
        </p>
      </Section>

      <Section heading="11. Merchant of Record">
        <p>
          Our order process is conducted by our online reseller Paddle.com. Paddle.com is the
          Merchant of Record for all our orders. Paddle provides all customer service inquiries and
          handles returns.
        </p>
      </Section>

      <Section heading="12. Suspension and termination">
        <p>
          We may suspend or terminate your access for material breach of these terms, non-payment,
          security or fraud risk, or repeated or serious policy violations. You may stop using the
          service at any time. On termination your right to use the service ends; on request within
          30 days we will provide a copy of your investigation data, after which it may be deleted.
        </p>
      </Section>

      <Section heading="13. Liability">
        <p>
          To the fullest extent permitted by law, we are not liable for indirect, consequential or
          special damages, including lost profits, lost data, or lost goodwill. Our total liability
          for all claims is capped at the amount you paid us in the 12 months before the claim.
          Nothing in these terms limits liability for fraud, death, or personal injury where the law
          does not allow it.
        </p>
      </Section>

      <Section heading="14. Indemnity">
        <p>
          You will indemnify us against claims arising from your inputs, your unlawful use of the
          service, or your breach of these terms.
        </p>
      </Section>

      <Section heading="15. General">
        <p>
          You may not assign this agreement without our consent; we may assign it in connection with
          a merger, acquisition or sale of assets. Neither party is liable for delays caused by
          events beyond its reasonable control. If a provision is unenforceable, the rest remains in
          force. We may update these terms and will change the date at the top of this page;
          continued use after an update means you accept it. These terms are governed by the laws of
          India, and the courts of India have exclusive jurisdiction over disputes.
        </p>
      </Section>
    </LegalPage>
  );
}
