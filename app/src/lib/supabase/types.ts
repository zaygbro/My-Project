// Hand-written to match supabase/migrations/0001_init.sql and
// 0002_phase2.sql. If you change the schema, update this alongside it (or
// swap to `supabase gen types` once the Supabase CLI is wired in).
//
// Each table needs `Relationships`, and the schema needs `Views` /
// `Functions`, to satisfy supabase-js's GenericSchema constraint — without
// them every row type silently collapses to `never`.

/** One editable block of a site's content — a section-level rebuild targets one of these by `key`. */
export interface SiteSection {
  key: string;
  title: string;
  body: string;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          created_at?: string;
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
          content: SiteSection[];
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
          content: SiteSection[];
          changed_sections: string[];
          kind: "create" | "edit" | "rollback";
          created_at: string;
        };
        Insert: {
          id?: string;
          site_id: string;
          content: SiteSection[];
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
          section_key: string;
          role: "user" | "assistant";
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          site_id: string;
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
