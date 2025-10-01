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
  const { email, userId } = body;

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const priceId = process.env.STRIPE_STANDARD_PRICE_ID!;

  console.log("userId=", userId);

  // --- 既存の顧客を確認 ---
  const { data: userData, error: userError } = await supabase
    .from("subscriptions") // 顧客IDは users に保存する想定
    .select("stripe_customer")
    .eq("user_id", userId)
    .maybeSingle();
  let customerId: string;

  if (userData?.stripe_customer) {
    // 既存の Stripe 顧客ID を再利用
    customerId = userData.stripe_customer;
  } else {
    // 新規に Stripe 顧客を作成
    const customer = await stripe.customers.create({ email });
    customerId = customer.id;

    // 存在しなければ新規作成、存在すれば更新
    const { error: upsertError } = await supabase
      .from("subscriptions")
      .upsert({
        user_id: userId,             // userId を主キーにして upsert
        stripe_customer: customerId,
      });

    if (upsertError) {
      console.error("顧客ID保存エラー:", upsertError);
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }
  }


  try {
    // --- Checkout セッション作成 ---
    const session = await stripe.checkout.sessions.create({
      customer: customerId, // 既存 or 新規
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/words/subscribe`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/words/subscribe`,
      metadata: { userId },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Stripe Checkout error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Unknown error" }, { status: 500 });
  }
}
//src/app/api/subscribe/route.ts
