import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { email, userId, inviteCode } = await req.json();

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2025-08-27.basil" });
  const priceId = process.env.STRIPE_STANDARD_PRICE_ID!;
  let trialDays = 0;
  let invitedBy: string | null = null;

  // --- 招待コード確認 ---
  if (inviteCode) {
    const { data: invite, error: inviteError } = await supabase
      .from("invites")
      .select("*")
      .eq("code", inviteCode)
      .single();

    if (inviteError || !invite) {
      return NextResponse.json({ error: "無効な招待コードです。" }, { status: 400 });
    }

    if (invite.max_uses && invite.used_count >= invite.max_uses) {
      return NextResponse.json({ error: "招待コードは使用上限に達しています。" }, { status: 400 });
    }

    invitedBy = invite.inviter_user_id;
    trialDays = 30;

    // 使用回数更新
    await supabase
      .from("invites")
      .update({ used_count: invite.used_count + 1 })
      .eq("id", invite.id);
  }

  // --- 既存 Stripe 顧客確認 ---
  const { data: userData } = await supabase
    .from("subscriptions")
    .select("stripe_customer")
    .eq("user_id", userId)
    .maybeSingle();

  let customerId: string;
  if (userData?.stripe_customer) {
    customerId = userData.stripe_customer;
  } else {
    const customer = await stripe.customers.create({ email });
    customerId = customer.id;

    await supabase.from("subscriptions").upsert({
      user_id: userId,
      stripe_customer: customerId,
      invite_code: inviteCode || null,
      invited_by: invitedBy,
    });
  }

  // --- Checkout セッション作成 ---
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: trialDays,
        metadata: { userId, invitedBy },
      },
      customer: customerId,
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/words/subscribe`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/words/subscribe`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
  console.error("Stripe Checkout Error:", err);

  if (err instanceof Error) {
    return NextResponse.json(
      {
        error: err.message,
        stack: err.stack,            // 追加：スタックトレース
        name: err.name,              // 追加：エラー名
        type: "StripeError",         // 追加：識別子
      },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { error: "Unknown error", detail: err },
    { status: 500 }
  );
}

}
