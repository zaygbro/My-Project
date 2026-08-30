import Link from "next/link";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { isPromoteConfigured } from "@/lib/promote/generate";
import { PromoteClient } from "./PromoteClient";

export default async function PromotePage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data: sites } = await supabase
    .from("sites")
    .select("id, name, published_at, subdomain")
    .eq("user_id", user.id)
    // Only finished sites can be advertised — an ad is written from real copy.
    .eq("generation_status", "validated")
    .order("created_at", { ascending: false });

  return (
    <div className="fade-in-up space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-wide text-accent">Promote</p>
        <h1 className="font-display mt-1 text-2xl font-extrabold tracking-tight">Video ads</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-faint">
          Francisity writes the ad from your site&rsquo;s real copy — the script, the prompt to render it
          with, the caption, and how to post it. Rendering the video itself happens in your video tool;
          Francisity doesn&rsquo;t generate video.
        </p>
      </div>

      {!isPromoteConfigured ? (
        <p className="rounded-2xl border border-hairline bg-surface p-5 text-sm text-ink-faint">
          AI isn&rsquo;t configured yet — set <code className="font-mono text-ink-dim">ANTHROPIC_API_KEY</code>{" "}
          to write ads.
        </p>
      ) : !sites || sites.length === 0 ? (
        <div className="rounded-2xl border border-hairline bg-surface p-5">
          <p className="text-sm text-ink-dim">You don&rsquo;t have a finished site to advertise yet.</p>
          <Link
            href="/dashboard"
            className="press mt-3 inline-block rounded-full bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-accent-hover"
          >
            Build a site
          </Link>
        </div>
      ) : (
        <PromoteClient sites={sites} />
      )}
    </div>
  );
}
