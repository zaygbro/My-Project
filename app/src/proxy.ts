import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/dashboard"];

/**
 * Maps `acme.example.com` to the published site at `/s/acme`.
 *
 * Only active when NEXT_PUBLIC_PUBLISH_ROOT_DOMAIN is set AND wildcard DNS
 * for it actually points here — neither of which this app can verify. With
 * it unset, published sites are still fully reachable at `/s/<subdomain>`
 * on the app's own origin, which needs no DNS setup at all.
 */
function publishedSiteRewrite(request: NextRequest): URL | null {
  const root = process.env.NEXT_PUBLIC_PUBLISH_ROOT_DOMAIN?.trim().toLowerCase();
  if (!root) return null;

  const host = request.headers.get("host")?.toLowerCase().split(":")[0];
  if (!host || host === root || !host.endsWith(`.${root}`)) return null;

  const label = host.slice(0, -(root.length + 1));
  // Only a single label is a site address; "a.b.example.com" is not.
  if (!label || label.includes(".") || !/^[a-z0-9-]{1,63}$/.test(label)) return null;
  if (label === "www") return null;

  const url = request.nextUrl.clone();
  url.pathname = `/s/${label}${request.nextUrl.pathname === "/" ? "" : request.nextUrl.pathname}`;
  return url;
}

export async function proxy(request: NextRequest) {
  // Published sites are public, so this runs before any auth work: a visitor
  // needs no session, and refreshing one on a customer's own hostname would
  // set Francisity's auth cookies on a domain that has no business holding
  // them.
  const rewrite = publishedSiteRewrite(request);
  if (rewrite) return NextResponse.rewrite(rewrite);

  // Same reasoning for the path-based form of a published site.
  if (request.nextUrl.pathname.startsWith("/s/")) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    request.nextUrl.pathname.startsWith(prefix)
  );

  if (isProtected && !user) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
