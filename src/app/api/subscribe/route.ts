// src/app/api/subscribe/route.ts
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  // cookies を関数として渡す
  const supabase = createServerComponentClient({ cookies: () => cookies() });

  const { plan } = await req.json();

  // サーバー側で安全にユーザー取得
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "ログインしてください" }, { status: 401 });
  }

  // 既存サブスク確認
  const { data: existing } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  let subscription;

  if (!existing) {
    // 新規作成
    const { data } = await supabase
      .from("subscriptions")
      .insert({ user_id: user.id, plan, is_active: true })
      .select()
      .maybeSingle();
    subscription = data;
  } else {
    // 状態切り替え
    const { data } = await supabase
      .from("subscriptions")
      .update({ is_active: !existing.is_active })
      .eq("id", existing.id)
      .select()
      .maybeSingle();
    subscription = data;
  }

  return NextResponse.json({ subscription });
}
// src/app/api/subscribe/route.ts
