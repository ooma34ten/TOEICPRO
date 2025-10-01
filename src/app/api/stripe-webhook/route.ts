import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-08-27.basil",
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not defined");
    return NextResponse.json({ error: "Webhook secret not set" }, { status: 500 });
  }

  const body = await req.text();
  const signature = req.headers.get("stripe-signature")!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Webhook signature verification failed" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const subscriptionId = session.subscription as string;
        const customerId = session.customer as string;
        const userId = session.metadata?.userId;

        if (!userId) {
          console.error("No userId in metadata");
          break;
        }

        const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId, {
          expand: ["items.data.price.product"], // product 情報を展開する
        });

        const productName = (stripeSubscription.items.data[0].price.product as Stripe.Product).name;
        console.log(productName); // "スタンダード"

        await supabase
          .from("subscriptions")
          .upsert({
            user_id: userId,
            stripe_customer: customerId,
            stripe_subscription: subscriptionId,
            plan: productName,
            is_active: true,
          });

        console.log("Subscription added:", subscriptionId);
        break;
      }

      case "customer.subscription.deleted": {
        const deletedSub = event.data.object as Stripe.Subscription;
        await supabase
          .from("subscriptions")
          .update({ is_active: false, stripe_subscription: null, plan: null })
          .eq("stripe_subscription", deletedSub.id);

        console.log("Subscription deleted:", deletedSub.id);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Error handling webhook event:", err);
    return NextResponse.json({ error: "Webhook handling error" }, { status: 500 });
  }
}
// src/app/api/stripe-webhook/route.ts
