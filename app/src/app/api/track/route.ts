import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Public, unauthenticated ingestion endpoint — a published Francisity site
// calls this to record a view. Its caller is ViewBeacon, rendered by the
// published-site route in app/s/[subdomain]. Cross-origin by design, since
// a published site can be served from its own subdomain.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const siteId = typeof body?.site_id === "string" ? body.site_id : undefined;
  const path = typeof body?.path === "string" ? body.path.slice(0, 512) : null;
  const referrer = req.headers.get("referer");

  if (!siteId) {
    return NextResponse.json({ error: "site_id is required." }, { status: 400, headers: CORS_HEADERS });
  }

  const supabase = createAdminClient();

  const { data: site } = await supabase.from("sites").select("id").eq("id", siteId).maybeSingle();
  if (!site) {
    return NextResponse.json({ error: "Unknown site." }, { status: 404, headers: CORS_HEADERS });
  }

  await supabase.from("site_events").insert({ site_id: siteId, path, referrer });

  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}
