import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "FunnelDoc.ai — Diagnose your conversion funnel in 30 seconds" },
      { name: "description", content: "Paste your funnel steps. FunnelDoc.ai finds the biggest drop-off, generates hypotheses, and writes diagnostic SQL - in seconds." },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "FunnelDoc.ai — Diagnose your conversion funnel in 30 seconds" },
      { property: "og:description", content: "Paste your funnel steps. FunnelDoc.ai finds the biggest drop-off, generates hypotheses, and writes diagnostic SQL - in seconds." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "FunnelDoc.ai — Diagnose your conversion funnel in 30 seconds" },
      { name: "twitter:description", content: "Paste your funnel steps. FunnelDoc.ai finds the biggest drop-off, generates hypotheses, and writes diagnostic SQL - in seconds." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/ef1884d0-28ad-4a55-bf1b-e8b669341f86" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/ef1884d0-28ad-4a55-bf1b-e8b669341f86" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

const legalLinkStyle = {
  fontSize: 12,
  color: "#6B7280",
  textDecoration: "none",
} as const;

function LegalFooter() {
  return (
    <div
      style={{
        fontFamily: "system-ui, -apple-system, sans-serif",
        borderTop: "1px solid #E5E7EB",
        padding: "18px 24px 28px",
        display: "flex",
        flexWrap: "wrap",
        gap: 16,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <span style={{ fontSize: 12, color: "#9CA3AF" }}>© FunnelDoc.ai</span>
      <a href="/terms" style={legalLinkStyle}>
        Terms &amp; Conditions
      </a>
      <a href="/refunds" style={legalLinkStyle}>
        Refund Policy
      </a>
      <a href="/privacy" style={legalLinkStyle}>
        Privacy Notice
      </a>
    </div>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <LegalFooter />
    </QueryClientProvider>
  );
}
