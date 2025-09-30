import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-08-27.basil",
});

// Supabase クライアント
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const body = await req.text(); // Webhook は raw text で受け取る必要あり
  const signature = req.headers.get("stripe-signature")!;

  try {
    // Webhook の署名を検証
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );

    switch (event.type) {
      case "checkout.session.completed":
        const session = event.data.object as Stripe.Checkout.Session;

        // subscription ID と customer ID を取得
        const subscriptionId = session.subscription as string;
        const customerId = session.customer as string;

        // checkout.session.completed の後に subscription を取得
        const stripeSubscription = await stripe.subscriptions.retrieve(
          session.subscription as string
        );
        const planName = stripeSubscription.items.data[0].price.nickname;

        // Supabase の subscriptions テーブルを更新
        await supabase
          .from("subscriptions")
          .upsert({
            stripe_customer: customerId,
            stripe_subscription: subscriptionId,
            user_id: session.metadata?.userId, // Checkout 作成時に metadata に userId を入れておく
            plan: planName,
            is_active: true,
          })
          .eq("user_id", session.metadata?.userId);

        console.log("サブスク加入完了:", subscriptionId);
        break;

      case "customer.subscription.deleted":
        const deletedSub = event.data.object as Stripe.Subscription;
        await supabase
          .from("subscriptions")
          .update({
            is_active: false,
            stripe_subscription: null,
            plan: null,
          })
          .eq("stripe_subscription", deletedSub.id);
        console.log("サブスク解約:", deletedSub.id);
        break;

      // 他のイベントも必要に応じて追加可能
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json({ error: "Webhook error" }, { status: 400 });
  }
}
// src/app/api/stripe-webhook/route.ts
