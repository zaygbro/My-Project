import { NextRequest, NextResponse } from "next/server";
import { stripe, isStripeConfigured } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  if (!isStripeConfigured) {
    return NextResponse.json(
      { error: "Billing isn't configured yet. Set STRIPE_SECRET_KEY to enable the billing portal." },
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

  if (!subscription?.stripe_customer_id) {
    return NextResponse.json(
      { error: "No billing account yet — subscribe to a plan first." },
      { status: 400 }
    );
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? req.nextUrl.origin;

  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.stripe_customer_id,
    return_url: `${siteUrl}/dashboard`,
  });

  return NextResponse.json({ url: session.url });
}
