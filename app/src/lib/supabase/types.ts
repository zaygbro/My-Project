// Hand-written to match supabase/migrations/0001_init.sql and
// 0002_phase2.sql. If you change the schema, update this alongside it (or
// swap to `supabase gen types` once the Supabase CLI is wired in).
//
// Each table needs `Relationships`, and the schema needs `Views` /
// `Functions`, to satisfy supabase-js's GenericSchema constraint — without
// them every row type silently collapses to `never`.

import type { ChangeLogEntry, DesignTokens, GeneratedPage } from "@/lib/generation/types";

/** One editable block of a site's content — a section-level rebuild targets one of these by `key`. */
export interface SiteSection {
  key: string;
  title: string;
  body: string;
}

/** Where a site is in the generation pipeline. Existing sites (and any
 * created before generation was wired in) are 'validated' — see
 * 0006_multipage_generation.sql. */
export type GenerationStatus = "pending" | "generating" | "validated" | "failed";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          created_at: string;
          is_dev: boolean;
        };
        Insert: {
          id: string;
          email: string;
          created_at?: string;
          is_dev?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      subscriptions: {
        Row: {
          user_id: string;
          plan: "spark" | "pro" | "studio";
          billing_period: "monthly" | "annual" | null;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          status:
            | "active"
            | "trialing"
            | "past_due"
            | "canceled"
            | "incomplete"
            | "incomplete_expired"
            | "unpaid"
            | "paused";
          current_period_end: string | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          plan?: "spark" | "pro" | "studio";
          billing_period?: "monthly" | "annual" | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          status?:
            | "active"
            | "trialing"
            | "past_due"
            | "canceled"
            | "incomplete"
            | "incomplete_expired"
            | "unpaid"
            | "paused";
          current_period_end?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["subscriptions"]["Insert"]>;
        Relationships: [];
      };
      sites: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          brief: string | null;
          subdomain: string | null;
          custom_domain: string | null;
          badge_enabled: boolean;
          /** Legacy flat content. Superseded by `pages` in 0006 — kept so the
           * migration is reversible, but nothing reads it any more. */
          content: SiteSection[];
          pages: GeneratedPage[];
          design_tokens: DesignTokens | null;
          generation_status: GenerationStatus;
          generation_error: string | null;
          change_log: ChangeLogEntry[];
          total_cost_usd: number;
          preferred_model: "claude-haiku-4-5" | "claude-sonnet-5" | "claude-opus-5" | "claude-fable-5";
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          brief?: string | null;
          subdomain?: string | null;
          custom_domain?: string | null;
          badge_enabled?: boolean;
          content?: SiteSection[];
          pages?: GeneratedPage[];
          design_tokens?: DesignTokens | null;
          generation_status?: GenerationStatus;
          generation_error?: string | null;
          change_log?: ChangeLogEntry[];
          total_cost_usd?: number;
          preferred_model?: "claude-haiku-4-5" | "claude-sonnet-5" | "claude-opus-5" | "claude-fable-5";
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["sites"]["Insert"]>;
        Relationships: [];
      };
      site_versions: {
        Row: {
          id: string;
          site_id: string;
          /** Legacy flat snapshot, superseded by `pages` — see 0006. */
          content: SiteSection[];
          pages: GeneratedPage[];
          design_tokens: DesignTokens | null;
          /** Entries are "pageSlug/sectionKey" for multi-page sites. */
          changed_sections: string[];
          kind: "create" | "edit" | "rollback";
          created_at: string;
        };
        Insert: {
          id?: string;
          site_id: string;
          content?: SiteSection[];
          pages?: GeneratedPage[];
          design_tokens?: DesignTokens | null;
          changed_sections?: string[];
          kind?: "create" | "edit" | "rollback";
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["site_versions"]["Insert"]>;
        Relationships: [];
      };
      site_messages: {
        Row: {
          id: string;
          site_id: string;
          page_slug: string;
          section_key: string;
          role: "user" | "assistant";
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          site_id: string;
          page_slug?: string;
          section_key: string;
          role: "user" | "assistant";
          content: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["site_messages"]["Insert"]>;
        Relationships: [];
      };
      site_events: {
        Row: {
          id: string;
          site_id: string;
          event_type: "view";
          path: string | null;
          referrer: string | null;
          occurred_at: string;
        };
        Insert: {
          id?: string;
          site_id: string;
          event_type?: "view";
          path?: string | null;
          referrer?: string | null;
          occurred_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["site_events"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
