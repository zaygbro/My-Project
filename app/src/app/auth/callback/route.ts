import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Supabase redirects the magic-link click here with a `code` param; we
// exchange it for a session, then send the user on to where they meant
// to go (or the dashboard by default).
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const next = req.nextUrl.searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, req.url));
    }
  }

  return NextResponse.redirect(new URL("/sign-in?error=auth", req.url));
}
