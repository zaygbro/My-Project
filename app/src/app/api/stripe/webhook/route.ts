import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BillingPeriod, PlanId } from "@/lib/plans";
import type { Database } from "@/lib/supabase/types";

// Route Handlers don't parse the body for us, so `req.text()` below gives
// the raw bytes Stripe signed — required for signature verification.

type DbSubscriptionStatus = Database["public"]["Tables"]["subscriptions"]["Row"]["status"];

const KNOWN_STATUSES: readonly DbSubscriptionStatus[] = [
  "active",
  "trialing",
  "past_due",
  "canceled",
  "incomplete",
  "incomplete_expired",
  "unpaid",
  "paused",
];

// Stripe's Status type includes a forward-compat catch-all for statuses it
// might add later; fall back rather than let an unrecognized one reject
// the whole webhook write against our stricter DB check constraint.
function toDbStatus(status: Stripe.Subscription.Status): DbSubscriptionStatus {
  if ((KNOWN_STATUSES as readonly string[]).includes(status)) {
    return status as DbSubscriptionStatus;
  }
  console.warn(`Unrecognized Stripe subscription status "${status}" — storing as "incomplete".`);
  return "incomplete";
}

function periodFromSubscription(subscription: Stripe.Subscription): BillingPeriod {
  const interval = subscription.items.data[0]?.price.recurring?.interval;
  return interval === "year" ? "annual" : "monthly";
}

function currentPeriodEndOf(subscription: Stripe.Subscription): string | null {
  const seconds = subscription.items.data[0]?.current_period_end;
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers.get("stripe-signature");

  if (!webhookSecret || !signature) {
    return NextResponse.json({ error: "Webhook is not configured." }, { status: 400 });
  }

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: `Webhook signature verification failed: ${message}` }, { status: 400 });
  }

  const supabase = createAdminClient();

  switch (event.type) {
    // A checkout finished — attach the Stripe customer/subscription to the
    // user who started it and record their new plan.
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id ?? session.metadata?.user_id;
      const plan = session.metadata?.plan as PlanId | undefined;

      if (userId && plan && session.subscription && session.customer) {
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);

        await supabase
          .from("subscriptions")
          .update({
            plan,
            billing_period: periodFromSubscription(subscription),
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: subscription.id,
            status: toDbStatus(subscription.status),
            current_period_end: currentPeriodEndOf(subscription),
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId);
      }
      break;
    }

    // Plan changes, renewals, and payment-failure status updates.
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const plan = subscription.metadata?.plan as PlanId | undefined;

      await supabase
        .from("subscriptions")
        .update({
          status: toDbStatus(subscription.status),
          billing_period: periodFromSubscription(subscription),
          current_period_end: currentPeriodEndOf(subscription),
          updated_at: new Date().toISOString(),
          ...(plan ? { plan } : {}),
        })
        .eq("stripe_subscription_id", subscription.id);
      break;
    }

    // Cancellation — downgrade back to the free plan.
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;

      await supabase
        .from("subscriptions")
        .update({
          plan: "spark",
          status: "canceled",
          current_period_end: currentPeriodEndOf(subscription),
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_subscription_id", subscription.id);
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
