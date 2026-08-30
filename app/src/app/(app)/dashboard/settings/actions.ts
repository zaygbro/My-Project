"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { VIEW_AS_REGULAR_COOKIE } from "@/lib/dev-mode";

/** Lets a dev account preview the app as a regular user would see it. Only
 * ever narrows that account's own privileges — never grants anything to a
 * non-dev account, since it's a no-op unless `profiles.is_dev` is already true. */
export async function setDevViewMode(viewAsRegular: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: profile } = await supabase.from("profiles").select("is_dev").eq("id", user.id).single();
  if (!profile?.is_dev) return;

  const store = await cookies();
  if (viewAsRegular) {
    store.set(VIEW_AS_REGULAR_COOKIE, "1", { path: "/", sameSite: "lax" });
  } else {
    store.delete(VIEW_AS_REGULAR_COOKIE);
  }

  revalidatePath("/dashboard");
}
