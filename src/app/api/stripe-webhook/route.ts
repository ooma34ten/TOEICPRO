// src/app/api/stripe-webhook/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin"; // サーバー権限用の Supabase client

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig!,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error) {
    console.error("Stripe webhook error:", error);
    return NextResponse.json(
      { error: "Webhook signature verification failed" },
      { status: 400 }
    );
  }


  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    const email = session.customer_email;
    if (email) {
      // ユーザーを Supabase から検索
      const { data: user } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (user) {
        await supabaseAdmin
          .from("subscriptions")
          .upsert({
            user_id: user.id,
            plan: "basic",
            is_active: true,
          });
      }
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;

    // subscription.customer は ID（string | Stripe.Customer）なので型に注意
    const customerId = subscription.customer as string;

    const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer;
    const email = customer.email;

    if (email) {
        const { data: user } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("email", email)
        .maybeSingle();

        if (user) {
        await supabaseAdmin
            .from("subscriptions")
            .update({ is_active: false })
            .eq("user_id", user.id);
        }
    }
    }


  return NextResponse.json({ received: true });
}
