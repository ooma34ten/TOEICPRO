// src/app/api/self-delete/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin"; // service_role を使う

export async function POST(req: Request) {
  const { userId } = await req.json();

  try {
    // 1. 関連データ削除
    const tables = [
      "user_word_history",
      "user_words",
      "subscriptions",
      "inquiries",
    ];

    for (const table of tables) {
      const { error } = await supabaseAdmin
        .from(table)
        .delete()
        .eq("user_id", userId);

      if (error) throw error;
    }

    // 2. Auth ユーザー削除
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authError) throw authError;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message || "削除に失敗しました" }, { status: 400 });
  }
}
