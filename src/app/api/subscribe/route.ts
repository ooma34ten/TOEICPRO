// src/app/api/subscribe/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { email, userId, inviteCode } = body;

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2025-08-27.basil" });
  const priceId = process.env.STRIPE_STANDARD_PRICE_ID!;

  let invitedBy: string | null = null;
  let trialDays = 0; // デフォルトは無料期間なし

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
    trialDays = 30; // 招待コードで1か月無料

    // used_count 更新
    await supabase
      .from("invites")
      .update({ used_count: invite.used_count + 1 })
      .eq("id", invite.id);
  }

  // --- 既存顧客確認 ---
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

  try {
    const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: trialDays,
      metadata: { userId, invitedBy },
    },
    customer: customerId, // Stripeの型によってはここは ok
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/words/subscribe`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/words/subscribe`,
  });


    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Unknown error" }, { status: 500 });
  }
}
