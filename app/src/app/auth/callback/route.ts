import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/redirects";

// Supabase redirects the magic-link click here with a `code` param; we
// exchange it for a session, then send the user on to where they meant
// to go (or the dashboard by default). Also where password-recovery links
// land, forwarding to /auth/reset once the session exists.
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  // `next` arrives inside a link someone clicks, so it's attacker-supplied:
  // sanitized to a same-site path, since new URL() would otherwise resolve
  // an absolute value to another origin and turn this into an open redirect.
  const next = safeNextPath(req.nextUrl.searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, req.url));
    }
  }

  return NextResponse.redirect(new URL("/sign-in?error=auth", req.url));
}
