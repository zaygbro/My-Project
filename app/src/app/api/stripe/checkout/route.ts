import { NextRequest, NextResponse } from "next/server";
import { stripe, isStripeConfigured } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { STRIPE_PRICE_IDS, type BillingPeriod } from "@/lib/plans";

export async function POST(req: NextRequest) {
  if (!isStripeConfigured) {
    return NextResponse.json(
      { error: "Billing isn't configured yet. Set STRIPE_SECRET_KEY to enable checkout." },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => null);
  const plan = body?.plan as "pro" | "studio" | undefined;
  const period = body?.period as BillingPeriod | undefined;

  if (plan !== "pro" && plan !== "studio") {
    return NextResponse.json({ error: "Unknown plan." }, { status: 400 });
  }
  if (period !== "monthly" && period !== "annual") {
    return NextResponse.json({ error: "Unknown billing period." }, { status: 400 });
  }

  const priceId = STRIPE_PRICE_IDS[plan][period];
  if (!priceId) {
    return NextResponse.json(
      { error: `No Stripe price configured for ${plan}/${period}. See app/README.md.` },
      { status: 500 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .single();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? req.nextUrl.origin;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: subscription?.stripe_customer_id ?? undefined,
    customer_email: subscription?.stripe_customer_id ? undefined : (user.email ?? undefined),
    client_reference_id: user.id,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${siteUrl}/dashboard?checkout=success`,
    cancel_url: `${siteUrl}/dashboard?checkout=cancelled`,
    metadata: { user_id: user.id, plan },
    subscription_data: { metadata: { user_id: user.id, plan } },
  });

  if (!session.url) {
    return NextResponse.json({ error: "Stripe did not return a checkout URL." }, { status: 500 });
  }

  return NextResponse.json({ url: session.url });
}
