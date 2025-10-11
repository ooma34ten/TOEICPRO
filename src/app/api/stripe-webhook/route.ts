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

        const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId, {
          expand: ["items.data.price.product"], // product 情報を展開する
        });

        console.log("stripeSubscription:", stripeSubscription);

        const productName = (stripeSubscription.items.data[0].price.product as Stripe.Product).name;
        console.log(productName); // "スタンダード"
        console.log("カスタマーID:", customerId);
        //console.log("ユーザーID:", userId);
        // 既存行を検索
        const { data: existing, error: selectError } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("stripe_customer", customerId)
          .single(); // 1件だけ取得

        if (selectError) {
          console.error("Supabase select error:", selectError);
        } else if (!existing) {
          console.log("既存のサブスクリプションがないため更新せず終了");
        } else {
          // 更新
          const { data, error: updateError } = await supabase
            .from("subscriptions")
            .update({
              stripe_subscription: subscriptionId,
              plan: productName,
              is_active: true,
              cancel_at_period_end: null,
              current_period_end: null,
              updated_at: new Date().toISOString()
            })
            .eq("stripe_customer", customerId);

          if (updateError) console.error("Supabase update error:", updateError);
          else console.log("既存行を更新しました:", data);
        }

        console.log("Subscription added:", subscriptionId);
        break;
      }

      case "customer.subscription.deleted": {
        const deletedSub = event.data.object as Stripe.Subscription;

        console.log("deletedSub:", deletedSub);

        const { data: existing } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("stripe_subscription", deletedSub.id)
          .single();
        console.log("existing:", existing);
        if (!existing) return;;
        
        const { data, error } = await supabase
          .from("subscriptions")
          .update({ is_active: false,
                    stripe_subscription: null, 
                    plan: null,
                    cancel_at_period_end: null,
                    current_period_end: null,
                    updated_at: new Date().toISOString()
                 })
          .eq("stripe_subscription", deletedSub.id);
        console.log("update result:", data, error);

        console.log("Subscription deleted:", deletedSub.id);
        break;
      }

      case "customer.subscription.updated": {
        const updatedSub = event.data.object as Stripe.Subscription;
        const cancelAtPeriodEnd =  updatedSub.cancel_at_period_end;
        const current_period_end_unix = updatedSub.items.data[0].current_period_end;
        const current_period_end = new Date(current_period_end_unix * 1000);

        console.log("cancelAtPeriodEnd:", cancelAtPeriodEnd);
        console.log("current_period_end:", current_period_end);

        await supabase
          .from("subscriptions")
          .update({ 
                    cancel_at_period_end: cancelAtPeriodEnd,
                    current_period_end: current_period_end,
                    updated_at: new Date().toISOString()
                 })
          .eq("stripe_subscription", updatedSub.id);

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
