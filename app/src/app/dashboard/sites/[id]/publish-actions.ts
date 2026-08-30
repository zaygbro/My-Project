"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { validateSubdomain } from "@/lib/publish";

export interface PublishState {
  error: string | null;
  success?: boolean;
}

/**
 * Publishes the site's current draft: snapshots `pages`, `design_tokens` and
 * `name` into their `published_*` counterparts and stamps `published_at`.
 *
 * The snapshot is the whole point — visitors keep seeing the last published
 * version while the owner edits, and the difference between the two is what
 * surfaces "you have unpublished changes".
 */
export async function publishSite(
  siteId: string,
  _prevState: PublishState,
  formData: FormData
): Promise<PublishState> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const requested = String(formData.get("subdomain") ?? "");
  const validated = validateSubdomain(requested);
  if (!validated.ok) return { error: validated.error };

  const { data: site } = await supabase
    .from("sites")
    .select("id, name, pages, design_tokens, generation_status")
    .eq("id", siteId)
    .eq("user_id", user.id)
    .single();
  if (!site) return { error: "Site not found." };

  // Never publish something that hasn't finished generating — that would put
  // an empty or unvalidated page on a public URL.
  if (site.generation_status !== "validated") {
    return { error: "This site hasn't finished building yet." };
  }
  if (site.pages.length === 0) {
    return { error: "There's nothing to publish yet." };
  }

  const { error } = await supabase
    .from("sites")
    .update({
      subdomain: validated.value,
      published_at: new Date().toISOString(),
      published_pages: site.pages,
      published_design_tokens: site.design_tokens,
      published_name: site.name,
    })
    .eq("id", siteId)
    .eq("user_id", user.id);

  if (error) {
    // 23505 = unique_violation: the address is taken by someone else's site.
    // Reported as a normal form error, and deliberately without saying whose.
    if (error.code === "23505") {
      return { error: "That address is already taken — try another." };
    }
    return { error: error.message };
  }

  revalidatePath(`/dashboard/sites/${siteId}`);
  revalidatePath(`/s/${validated.value}`);
  return { error: null, success: true };
}

/** Takes a site offline. The snapshot is deliberately left in place so
 * re-publishing restores exactly what was live before, and so the address
 * stays reserved to this site rather than being grabbed by someone else. */
export async function unpublishSite(
  siteId: string,
  _prevState: PublishState,
  _formData: FormData
): Promise<PublishState> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const { data: site } = await supabase
    .from("sites")
    .select("subdomain")
    .eq("id", siteId)
    .eq("user_id", user.id)
    .single();

  const { error } = await supabase
    .from("sites")
    .update({ published_at: null })
    .eq("id", siteId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/sites/${siteId}`);
  if (site?.subdomain) revalidatePath(`/s/${site.subdomain}`);
  return { error: null, success: true };
}
