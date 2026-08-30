// Subdomain rules for published sites. Pure logic, so it's unit-testable
// without a database — and it has to be exactly right, because a subdomain
// becomes a public hostname and is unique across every account.

/** Hostnames that must never become a customer subdomain: they'd either
 * shadow a real app route once wildcard DNS is pointed at this app, or
 * impersonate Francisity itself. */
const RESERVED = new Set([
  "www",
  "app",
  "api",
  "admin",
  "dashboard",
  "auth",
  "login",
  "signin",
  "sign-in",
  "signup",
  "sign-up",
  "try",
  "s",
  "static",
  "assets",
  "cdn",
  "mail",
  "email",
  "smtp",
  "ftp",
  "ns",
  "ns1",
  "ns2",
  "blog",
  "docs",
  "help",
  "support",
  "status",
  "billing",
  "stripe",
  "webhook",
  "webhooks",
  "internal",
  "staging",
  "dev",
  "test",
  "francisity",
]);

export const SUBDOMAIN_MIN = 3;
export const SUBDOMAIN_MAX = 63; // DNS label limit.

/** Lowercases and strips characters that can't appear in a DNS label, so a
 * site name can be offered as a starting suggestion. Does not guarantee
 * validity — always run the result through validateSubdomain. */
export function normalizeSubdomain(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function suggestSubdomain(siteName: string): string {
  const base = normalizeSubdomain(siteName).slice(0, SUBDOMAIN_MAX);
  // Pad a too-short suggestion rather than proposing something invalid.
  return base.length >= SUBDOMAIN_MIN ? base : `${base || "site"}-site`;
}

export type SubdomainError =
  | { ok: false; error: string }
  | { ok: true; value: string };

export function validateSubdomain(input: string): SubdomainError {
  const value = input.toLowerCase().trim();

  if (!value) return { ok: false, error: "Pick an address for your site." };
  if (value.length < SUBDOMAIN_MIN) {
    return { ok: false, error: `Addresses need at least ${SUBDOMAIN_MIN} characters.` };
  }
  if (value.length > SUBDOMAIN_MAX) {
    return { ok: false, error: `Addresses can be at most ${SUBDOMAIN_MAX} characters.` };
  }
  if (!/^[a-z0-9-]+$/.test(value)) {
    return { ok: false, error: "Use only lowercase letters, numbers, and hyphens." };
  }
  if (value.startsWith("-") || value.endsWith("-")) {
    return { ok: false, error: "Addresses can't start or end with a hyphen." };
  }
  if (value.includes("--")) {
    return { ok: false, error: "Addresses can't contain two hyphens in a row." };
  }
  if (RESERVED.has(value)) {
    return { ok: false, error: "That address is reserved — try another." };
  }

  return { ok: true, value };
}

/** The public origin a published site is served from.
 *
 * With a wildcard domain configured (NEXT_PUBLIC_PUBLISH_ROOT_DOMAIN, plus
 * matching wildcard DNS) sites get a real subdomain. Without one they're
 * still genuinely published — just on a path under the app's own origin,
 * which needs no DNS setup at all. Returning a working URL either way is
 * the point: publishing should never be blocked on infrastructure the app
 * can't verify from here. */
export function publishedUrl(subdomain: string, appOrigin: string): string {
  const root = process.env.NEXT_PUBLIC_PUBLISH_ROOT_DOMAIN?.trim();
  if (root) {
    const scheme = root.startsWith("localhost") || root.startsWith("127.") ? "http" : "https";
    return `${scheme}://${subdomain}.${root}`;
  }
  return `${appOrigin.replace(/\/+$/, "")}/s/${subdomain}`;
}
