import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;

if (!secretKey) {
  // Thrown at request time (not at build time) — routes that import this
  // catch and surface a clear "billing isn't configured" error instead.
  console.warn("STRIPE_SECRET_KEY is not set — billing routes will fail until it is.");
}

export const stripe = new Stripe(secretKey ?? "sk_test_placeholder", {
  apiVersion: "2026-08-26.dahlia",
  typescript: true,
});

export const isStripeConfigured = Boolean(secretKey);
