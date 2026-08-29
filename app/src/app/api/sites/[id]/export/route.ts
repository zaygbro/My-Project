import { NextResponse } from "next/server";
import JSZip from "jszip";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { PLAN_LIMITS } from "@/lib/plans";
import { renderSiteToStaticFiles } from "@/lib/export";
import { getEffectivePlanForUser } from "@/lib/dev-mode";
import type { SiteSection } from "@/lib/supabase/types";

function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "site";
}

export async function GET(_req: Request, ctx: RouteContext<"/api/sites/[id]/export">) {
  const { id } = await ctx.params;

  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { data: site } = await supabase
    .from("sites")
    .select("id, name, content, badge_enabled")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!site) {
    return NextResponse.json({ error: "Site not found." }, { status: 404 });
  }

  const plan = await getEffectivePlanForUser(user.id);
  if (!PLAN_LIMITS[plan].exportEnabled) {
    return NextResponse.json(
      { error: "Exporting to code is a Pro/Studio feature — upgrade to download this site." },
      { status: 403 }
    );
  }

  const { html, css } = renderSiteToStaticFiles({
    name: site.name,
    content: site.content as SiteSection[],
    badgeEnabled: site.badge_enabled,
  });

  const zip = new JSZip();
  zip.file("index.html", html);
  zip.file("styles.css", css);
  const buffer = await zip.generateAsync({ type: "nodebuffer" });

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${slugify(site.name)}.zip"`,
    },
  });
}
