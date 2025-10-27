// src/app/api/stripe-webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

// ✅ Stripe & Supabase 設定
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-08-27.basil",
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ✅ 部分型定義（必要最小限のみ）
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

// ✅ Webhook エンドポイント
export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("❌ Missing STRIPE_WEBHOOK_SECRET environment variable");
    return NextResponse.json({ error: "Webhook secret not set" }, { status: 500 });
  }

  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    console.error("❌ Missing Stripe signature header");
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  // ✅ シグネチャ検証
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    console.log(`✅ Webhook event received: ${event.type}`);
  } catch (err) {
    console.error("❌ Stripe signature verification failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      // ------------------------------------------------------
      // ✅ 新規サブスクリプション作成
      // ------------------------------------------------------
      case "checkout.session.completed": {
        console.log("🆕 Event: checkout.session.completed");
        const session = event.data.object as Stripe.Checkout.Session;

        const subscriptionId = session.subscription as string;
        const customerId = session.customer as string;

        console.log("➡️ SubID:", subscriptionId, "CustomerID:", customerId);

        const stripeSub = await stripe.subscriptions.retrieve(subscriptionId, {
          expand: ["items.data.price.product"],
        });

        const subData = stripeSub as unknown as SubscriptionCompleted;
        const productName = subData.items.data[0]?.price?.product?.name ?? "UNKNOWN";

        console.log(`📦 Product: ${productName}`);

        const { data: existing, error: fetchError } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("stripe_customer", customerId)
          .single();

        if (fetchError) {
          console.error("⚠️ Supabase fetch error:", fetchError.message);
        }

        const updateData = {
          stripe_subscription: subscriptionId,
          plan: productName,
          is_active: true,
          cancel_at_period_end: null,
          current_period_end: null,
          updated_at: new Date().toISOString(),
        };

        if (existing) {
          console.log("🔁 Existing subscription found, updating record");
          await supabase.from("subscriptions").update(updateData).eq("stripe_customer", customerId);
        } else {
          console.log("🆕 No existing record found — inserting new subscription record");
          await supabase.from("subscriptions").insert({
            user_id: null,
            stripe_customer: customerId,
            ...updateData,
            created_at: new Date().toISOString(),
          });
        }

        break;
      }

      // ------------------------------------------------------
      // ✅ サブスクリプション更新
      // ------------------------------------------------------
      case "customer.subscription.updated": {
        console.log("🔄 Event: customer.subscription.updated");
        const updatedSub = event.data.object as Stripe.Subscription;
        const subData = updatedSub as unknown as SubscriptionUpdated;

        const cancelAtPeriodEnd = subData.cancel_at_period_end;
        const current_period_end = subData.current_period_end
          ? new Date(subData.current_period_end * 1000)
          : null;

        console.log("🗓️ Update Info:", {
          id: subData.id,
          cancelAtPeriodEnd,
          current_period_end,
        });

        const { error: updateError } = await supabase
          .from("subscriptions")
          .update({
            cancel_at_period_end: cancelAtPeriodEnd,
            current_period_end,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription", subData.id);

        if (updateError) console.error("⚠️ Supabase update error:", updateError.message);

        break;
      }

      // ------------------------------------------------------
      // ✅ サブスクリプション削除（完全キャンセル）
      // ------------------------------------------------------
      case "customer.subscription.deleted": {
        console.log("❌ Event: customer.subscription.deleted");
        const deletedSub = event.data.object as Stripe.Subscription;
        const subData = deletedSub as unknown as SubscriptionDeleted;
        const subscriptionId = subData.id;

        console.log("🧾 Deleting subscription:", subscriptionId);

        const { data: existing, error: fetchError } = await supabase
          .from("subscriptions")
          .select("user_id")
          .eq("stripe_subscription", subscriptionId)
          .single();

        if (fetchError) {
          console.error("⚠️ Supabase fetch error:", fetchError.message);
        }

        if (!existing) {
          console.warn("⚠️ No existing record found for deletion");
          break;
        }

        const userId = existing.user_id;

        // 古い単語削除ロジック
        const { data: words } = await supabase
          .from("user_words")
          .select("id, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (words && words.length > 200) {
          const oldIds = words.slice(200).map((w) => w.id);
          console.log(`🧹 Deleting ${oldIds.length} old words`);

          await supabase.from("user_words").delete().in("id", oldIds);
          await supabase.from("user_word_history").delete().in("user_word_id", oldIds);
        }

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

        console.log("🧾 Subscription record deactivated successfully");
        break;
      }

      // ------------------------------------------------------
      // ⚙️ 未対応イベント
      // ------------------------------------------------------
      default:
        console.log(`⚙️ Unhandled event type: ${event.type}`);
    }

    console.log("✅ Webhook processed successfully:", event.type);
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("💥 Error during webhook processing:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Webhook handling error" }, { status: 500 });
  }
}
