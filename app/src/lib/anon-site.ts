// A site built before signing up lives only in the visitor's own browser —
// nothing here ever touches Supabase. `claimAnonymousSite` (in
// `app/try/actions.ts`) is what turns this into a real, saved site once
// they sign in.

import type { SiteSection } from "./supabase/types";
import type { AiModelId } from "./ai/models";

const STORAGE_KEY = "francisity_anon_site";

export interface AnonSite {
  name: string;
  brief: string;
  preferredModel: AiModelId;
  content: SiteSection[];
}

export function loadAnonSite(): AnonSite | null {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AnonSite;
  } catch {
    return null;
  }
}

export function saveAnonSite(site: AnonSite) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(site));
}

export function clearAnonSite() {
  window.localStorage.removeItem(STORAGE_KEY);
}
