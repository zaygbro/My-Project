export type PlanId = "spark" | "pro" | "studio";
export type BillingPeriod = "monthly" | "annual";

export interface PlanLimits {
  /** Max sites a user on this plan can create. `null` = unlimited. */
  siteLimit: number | null;
  /** Max rebuilds per month. `null` = unlimited. */
  rebuildLimit: number | null;
  /** Whether sites on this plan carry the "Built with Francisity" badge. */
  badge: boolean;
  /** Whether this plan can export a site's content as a static HTML/CSS bundle. */
  exportEnabled: boolean;
}

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  spark: { siteLimit: 3, rebuildLimit: 5, badge: true, exportEnabled: false },
  pro: { siteLimit: null, rebuildLimit: null, badge: false, exportEnabled: true },
  studio: { siteLimit: null, rebuildLimit: null, badge: false, exportEnabled: true },
};

export const PLAN_LABELS: Record<PlanId, string> = {
  spark: "Spark",
  pro: "Pro",
  studio: "Studio",
};

/**
 * Stripe Price IDs for each paid plan/period. Populate these in your
 * environment once the matching products/prices exist in Stripe — see
 * app/README.md for the exact setup steps. Spark has no price: it's free.
 */
export const STRIPE_PRICE_IDS: Record<"pro" | "studio", Record<BillingPeriod, string | undefined>> = {
  pro: {
    monthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
    annual: process.env.STRIPE_PRICE_PRO_ANNUAL,
  },
  studio: {
    monthly: process.env.STRIPE_PRICE_STUDIO_MONTHLY,
    annual: process.env.STRIPE_PRICE_STUDIO_ANNUAL,
  },
};
