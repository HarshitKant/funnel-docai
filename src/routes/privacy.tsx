import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, Section, ulStyle } from "@/components/LegalPage";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Notice — FunnelDoc.ai" },
      {
        name: "description",
        content:
          "How FunnelDoc.ai collects, uses, shares and retains personal data, and the rights you have over it.",
      },
      { property: "og:title", content: "Privacy Notice — FunnelDoc.ai" },
      {
        property: "og:description",
        content: "How FunnelDoc.ai handles your personal data.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalPage title="Privacy Notice" updated="16 September 2026">
      <Section heading="Who we are">
        <p>
          FunnelDoc.ai ("FunnelDoc", "we", "us") operates this website and service. We are the data
          controller for the personal data described here, which means we decide why and how it is
          used.
        </p>
      </Section>

      <Section heading="What we collect and why">
        <ul style={ulStyle}>
          <li>
            <strong>Account data</strong> — email address and login credentials, to create your
            account, sign you in, and link your purchase to you. Legal basis: performance of our
            contract with you.
          </li>
          <li>
            <strong>Investigation content</strong> — the metric change, funnel numbers and business
            context you enter, and the analysis produced, so we can deliver the service and show you
            your history. Legal basis: performance of our contract.
          </li>
          <li>
            <strong>Feedback and testimonials</strong> — the message and rating you choose to
            submit. Legal basis: consent, which you may withdraw by asking us to delete it.
          </li>
          <li>
            <strong>Purchase records</strong> — the identifiers Paddle sends us for a completed
            order, so we know your account is unlocked. Legal basis: performance of our contract.
          </li>
          <li>
            <strong>Technical and usage data</strong> — IP address, device and browser information,
            log and error data, and basic usage events, for security, fraud prevention,
            troubleshooting, and improving the product. Legal basis: legitimate interests in running
            a secure, working service.
          </li>
          <li>
            <strong>Support messages</strong> — what you send us when you ask for help, so we can
            answer. Legal basis: legitimate interests and performance of our contract.
          </li>
        </ul>
        <p>
          Payment card details are collected and processed by Paddle, our Merchant of Record. We
          never see or store them.
        </p>
      </Section>

      <Section heading="Who we share data with">
        <ul style={ulStyle}>
          <li>
            <strong>Service providers</strong> — hosting, database, authentication, and AI model
            providers that process data on our instructions to run the service.
          </li>
          <li>
            <strong>Paddle</strong>, our Merchant of Record, for the sale of the product, payments,
            invoicing, tax compliance, refunds, and buyer support.
          </li>
          <li>
            <strong>Professional advisers</strong> such as legal and accounting, where needed.
          </li>
          <li>
            <strong>Authorities</strong>, where we are required to disclose by law.
          </li>
        </ul>
        <p>We do not sell your personal data.</p>
      </Section>

      <Section heading="International transfers">
        <p>
          Our providers may process data outside your country, including in the United States and the
          European Union. Where data leaves the UK or EEA, we rely on appropriate safeguards such as
          Standard Contractual Clauses or an adequacy decision.
        </p>
      </Section>

      <Section heading="How long we keep it">
        <p>
          Account and purchase records are kept while your account exists and for as long as tax and
          accounting law requires afterwards. Investigation content and feedback are kept while your
          account is active, or until you ask us to delete them. Technical logs are kept for a short
          period for security and debugging. When data is no longer needed it is deleted or
          anonymised.
        </p>
      </Section>

      <Section heading="Your rights">
        <p>
          Depending on where you live, you may ask us to give you a copy of your data, correct it,
          delete it, restrict or object to how we use it, port it elsewhere, or withdraw consent you
          previously gave. Email{" "}
          <a href="mailto:support@funneldoc.ai" style={{ color: "#6366F1" }}>
            support@funneldoc.ai
          </a>{" "}
          and we will respond within one month. If you are in the UK or EEA you may also complain to
          your data protection supervisory authority.
        </p>
      </Section>

      <Section heading="Security">
        <p>
          We use appropriate technical and organisational measures, including encryption in transit,
          hashed credentials, access controls, and row-level database rules that keep your data
          visible only to your own account.
        </p>
      </Section>

      <Section heading="Cookies and local storage">
        <p>
          We use only essential cookies and browser storage — they keep you signed in and remember
          your session. We do not use advertising or cross-site tracking cookies. You can clear them
          in your browser settings, though doing so will sign you out.
        </p>
      </Section>
    </LegalPage>
  );
}
