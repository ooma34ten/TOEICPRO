// src/app/api/test/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { email, userId } = body;

  console.log("userId=", userId);

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const priceId = process.env.STRIPE_PREMIUM_PRICE_ID!;

  try {
    // 顧客作成
    const customer = await stripe.customers.create({ email });
    console.log("created stripe customer:", customer.id);

    // Supabase の subscriptions テーブルに保存（暫定）
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    console.log("APP_URL:", process.env.NEXT_PUBLIC_APP_URL);


    const { error } = await supabase
      .from("subscriptions")
      .update({ stripe_customer: customer.id })
      .eq("user_id", userId);

    if (error) {
      console.error("更新エラー:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Checkout セッション作成（customer を渡すのが重要）
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
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
