import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  const { userId } = await req.json();

  try {
    // 1. 関連データ削除
    const tables = [
      "user_word_history",
      "user_words",
      "subscriptions",
      "inquiries",
    ] as const;

    for (const table of tables) {
      const { error } = await supabaseAdmin
        .from(table)
        .delete()
        .eq("user_id", userId);

      if (error) throw error;
    }

    // 2. Auth ユーザー
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authError) throw authError;

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error(err);

    const message =
      err instanceof Error
        ? err.message
        : "削除に失敗しました";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
