// src/app/api/stripe-webhook/route.ts
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

// 部分型定義（Webhookで必要なプロパティのみ）
type SubscriptionCompleted = {
  id: string;
  customer: string;
  items: {
    data: {
      price: {
        product: {
          name: string;
        };
      };
    }[];
  };
};

type SubscriptionDeleted = {
  id: string;
};

type SubscriptionUpdated = {
  id: string;
  cancel_at_period_end: boolean;
  current_period_end: number | null;
};

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) return NextResponse.json({ error: "Webhook secret not set" }, { status: 500 });

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
      // ✅ 新規サブスクリプション作成
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const subscriptionId = session.subscription as string;
        const customerId = session.customer as string;

        // Stripe subscription取得
        const stripeSub = await stripe.subscriptions.retrieve(subscriptionId, {
          expand: ["items.data.price.product"],
        });

        const subData = stripeSub as unknown as SubscriptionCompleted;
        const productName = subData.items.data[0].price.product.name;

        const { data: existing } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("stripe_customer", customerId)
          .single();

        if (existing) {
          await supabase
            .from("subscriptions")
            .update({
              stripe_subscription: subscriptionId,
              plan: productName,
              is_active: true,
              cancel_at_period_end: null,
              current_period_end: null,
              updated_at: new Date().toISOString(),
            })
            .eq("stripe_customer", customerId);
        }

        break;
      }

      // ✅ 解約（削除）イベント
      case "customer.subscription.deleted": {
        const deletedSub = event.data.object as Stripe.Subscription;
        const subData = deletedSub as unknown as SubscriptionDeleted;
        const subscriptionId = subData.id;

        const { data: existing } = await supabase
          .from("subscriptions")
          .select("user_id")
          .eq("stripe_subscription", subscriptionId)
          .single();

        if (!existing) break;
        const userId = existing.user_id;

        // user_words整理
        const { data: words } = await supabase
          .from("user_words")
          .select("id, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (words && words.length > 200) {
          const oldIds = words.slice(200).map((w) => w.id);

          await supabase.from("user_words").delete().in("id", oldIds);
          await supabase.from("user_word_history").delete().in("user_word_id", oldIds);
        }

        // subscriptions 更新
        await supabase
          .from("subscriptions")
          .update({
            is_active: false,
            stripe_subscription: null,
            plan: null,
            cancel_at_period_end: null,
            current_period_end: null,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription", subscriptionId);

        break;
      }

      // ✅ 更新イベント（キャンセル予約など）
      case "customer.subscription.updated": {
        const updatedSub = event.data.object as Stripe.Subscription;
        const subData = updatedSub as unknown as SubscriptionUpdated;

        const cancelAtPeriodEnd = subData.cancel_at_period_end;
        const current_period_end = subData.current_period_end
          ? new Date(subData.current_period_end * 1000)
          : null;

        await supabase
          .from("subscriptions")
          .update({
            cancel_at_period_end: cancelAtPeriodEnd,
            current_period_end,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription", subData.id);

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
