// src/app/api/stripe-webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { getJSTISOString } from "@/lib/utils";

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
      current_period_end: number;
    }[];
  };
};

type SubscriptionUpdated = {
  id: string;
  cancel_at_period_end: boolean;
  current_period_end: number | null;
  items?: { data: { current_period_end: number }[] };
  trial_end?: number | null;
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

        const stripeSub = await stripe.subscriptions.retrieve(subscriptionId, {
          expand: ["items.data.price.product"],
        });

        const subData = stripeSub as unknown as SubscriptionCompleted;
        const productName = subData.items.data[0]?.price?.product?.name ?? "UNKNOWN";

        console.log("➡️ SubID:", subscriptionId, "CustomerID:", customerId, "Product:", productName);

        const { data: existing } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("stripe_customer", customerId)
          .single();

        const updateData = {
          stripe_subscription: subscriptionId,
          plan: productName,
          is_active: true,
          cancel_at_period_end: null,
          current_period_end: new Date(subData.items.data[0]?.current_period_end * 1000) ?? null,
          updated_at: getJSTISOString(),
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
            created_at: getJSTISOString(),
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

        // 安全に current_period_end を取得
        const currentPeriodEnd =
          subData.current_period_end ??
          subData.items?.data[0]?.current_period_end ??
          subData.trial_end ??
          null;

        const cancelAtPeriodEnd = subData.cancel_at_period_end;

        console.log("🗓️ Update Info:", {
          id: subData.id,
          cancelAtPeriodEnd,
          currentPeriodEnd,
        });

        await supabase
          .from("subscriptions")
          .update({
            cancel_at_period_end: cancelAtPeriodEnd,
            current_period_end: currentPeriodEnd ? new Date(currentPeriodEnd * 1000) : null,
            updated_at: getJSTISOString(),
          })
          .eq("stripe_subscription", subData.id);

        break;
      }

      // ------------------------------------------------------
      // ✅ サブスクリプション削除（完全キャンセル）
      // ------------------------------------------------------
      case "customer.subscription.deleted": {
        console.log("❌ Event: customer.subscription.deleted");
        const deletedSub = event.data.object as Stripe.Subscription;
        const subscriptionId = deletedSub.id;

        const { data: existing, error: fetchError } = await supabase
          .from("subscriptions")
          .select("user_id")
          .eq("stripe_subscription", subscriptionId)
          .maybeSingle();

        if (fetchError) {
          console.error("⚠️ Failed to fetch subscription record:", fetchError.message);
          break;
        }

        if (!existing || !existing.user_id) {
          console.warn("⚠️ No user_id found for this subscription");
          break;
        }

        const userId = existing.user_id;

        // ✅ ユーザーの単語取得
        const { data: words, error: wordsError } = await supabase
          .from("user_words")
          .select("id, registered_at")
          .eq("user_id", userId)
          .order("registered_at", { ascending: false });

        if (wordsError) {
          console.error("⚠️ Failed to fetch user words:", wordsError.message);
          break;
        }

        if (words && words.length > 200) {
          const oldIds = words.slice(200).map((w) => w.id);
          console.log(`🧹 Deleting ${oldIds.length} old words`);

          // ✅ 関連履歴削除 → 本体削除の順番に変更
          await supabase.from("user_word_history").delete().in("user_word_id", oldIds);
          await supabase.from("user_words").delete().in("id", oldIds);
        } else {
          console.log("ℹ️ Less than 200 words, no cleanup needed.");
        }

        // ✅ サブスクリプション無効化
        const { error: updateError } = await supabase
          .from("subscriptions")
          .update({
            is_active: false,
            stripe_subscription: null,
            plan: null,
            cancel_at_period_end: null,
            current_period_end: null,
            updated_at: getJSTISOString(),
          })
          .eq("stripe_subscription", subscriptionId);

        if (updateError) {
          console.error("⚠️ Failed to deactivate subscription:", updateError.message);
        } else {
          console.log("🧾 Subscription record deactivated successfully");
        }

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
