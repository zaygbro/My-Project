import type { Metadata } from "next";
import "./marketing.css";

export const metadata: Metadata = {
  title: "Francisity — Multi-Engine Site Builder",
  description:
    "Francisity takes your brief and runs it through a council of specialist AI engines — structure, visual, copy, and assurance — then reconciles their output into one issued, production-ready site.",
  openGraph: {
    type: "website",
    title: "Francisity — Multi-Engine Site Builder",
    description:
      "Francisity takes your brief and runs it through a council of specialist AI engines — structure, visual, copy, and assurance — then reconciles their output into one issued, production-ready site.",
  },
  twitter: {
    card: "summary",
    title: "Francisity — Multi-Engine Site Builder",
    description:
      "Francisity takes your brief and runs it through a council of specialist AI engines — structure, visual, copy, and assurance — then reconciles their output into one issued, production-ready site.",
  },
};

/**
 * A second, independent root layout (see Next's route-groups docs on
 * multiple root layouts) — this is what makes the marketing site's own
 * unscoped CSS (body, h1, a, *…) safe to import as-is: it never shares a
 * document with the (app) group's globals.css, so nothing here can leak
 * into the dashboard or vice versa. Navigating between the two groups is a
 * full page load, which is the expected, normal cost of that isolation and
 * is fine for a marketing-site → app handoff.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800;900&family=Geist+Mono:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
