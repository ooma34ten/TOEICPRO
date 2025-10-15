import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { userId } = body;
  
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // Supabase から stripe_customer を取得
    const { data: subs, error } = await supabase
      .from("subscriptions")
      .select("stripe_subscription")
      .eq("user_id", userId)
      .single();

    if (error || !subs?.stripe_subscription) {
      return NextResponse.json(
        { error: "サブスクリプション情報が見つかりません" },
        { status: 400 }
      );
    }

    // Stripe 側で解約予約
    await stripe.subscriptions.update(subs.stripe_subscription, {
      cancel_at_period_end: true,
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Unknown error" }, { status: 500 });
  }
}
// src/app/api/cancel/route.ts
