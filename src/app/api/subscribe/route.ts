import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { createSupabaseCookies } from "@/lib/supabaseCookies";
import { cookies } from "next/headers";

// Stripe 初期化
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-08-27.basil",
});

export async function POST(req: NextRequest) {
  try {
    const query = req.nextUrl.searchParams.get("API_ROUTE_SECRET");
    if (query !== process.env.API_ROUTE_SECRET) {
      return NextResponse.json({
        message: "APIをたたく権限がありません", 
      });
    }
    // Supabase Client 作成（Cookie ラッパーで安全）
    const supabase = createServerComponentClient({
      cookies: () => Promise.resolve(cookies()),
    });

    // ログインユーザーの取得
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session?.user) {
      return NextResponse.json({ error: "ログインしてください" }, { status: 401 });
    }

    const { plan } = await req.json();

    // Stripe Checkout セッション作成
    const checkoutSession = await stripe.checkout.sessions.create({
      customer_email: session.user.email ?? undefined,
      payment_method_types: ["card"],
      line_items: [
        {
          price: plan === "basic"
            ? process.env.STRIPE_BASIC_PRICE_ID!
            : process.env.STRIPE_PREMIUM_PRICE_ID!,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/words/subscribe?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/words/subscribe?canceled=true`,
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    console.error("Stripe Checkout セッション作成エラー:", err);
    return NextResponse.json({ error: "セッション作成に失敗しました" }, { status: 500 });
  }
}
