/**
 * Sanitizes a caller-supplied post-auth redirect target.
 *
 * `?next=` is attacker-controllable (it rides in on links people click), and
 * `new URL(next, requestUrl)` happily resolves an absolute or
 * protocol-relative value to another origin. On an authentication endpoint
 * that's a real phishing vector: a link that genuinely signs someone in to
 * Francisity and then drops them on a look-alike site asking them to
 * "confirm" their details.
 *
 * Only same-site absolute paths are allowed through; anything else falls
 * back to the dashboard.
 */
export const DEFAULT_REDIRECT = "/dashboard";

const CONTROL_OR_SPACE = /[\x00-\x20\x7f]/;
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

export function safeNextPath(next: string | null | undefined): string {
  if (!next) return DEFAULT_REDIRECT;

  // Must be a rooted path. "//host" is protocol-relative in browsers despite
  // starting with a slash, so it's rejected explicitly.
  if (!next.startsWith("/")) return DEFAULT_REDIRECT;
  if (next.startsWith("//")) return DEFAULT_REDIRECT;

  // Backslashes and control/space characters can be normalized into an
  // authority by some parsers ("/\\evil.com" becomes "//evil.com"). Hyphens
  // are deliberately fine — "/sign-in" and "/dashboard/new-build" are real
  // destinations.
  if (next.includes("\\")) return DEFAULT_REDIRECT;
  if (CONTROL_OR_SPACE.test(next)) return DEFAULT_REDIRECT;
  if (HAS_SCHEME.test(next.slice(1))) return DEFAULT_REDIRECT;

  return next;
}
