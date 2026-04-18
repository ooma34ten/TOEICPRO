import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  const { userId } = await req.json();

  try {
    // 1. 関連データ削除（FK制約のある順で削除）
    const tables = [
      "user_word_history",
      "user_words",
      "test_results",
      // "ai_generated_questions_queue", // user_idカラムが存在しないため除外
      "race_participants",
      "race_history",
      "user_activity_logs",
      "user_stats",
      "subscriptions",
      "inquiries",
      "question_answer_history",
      "user_question_history",
      "learning_sessions",
      "ai_usage_log",
      "word_reports",
      "invites"
    ] as const;

    for (const table of tables) {
      const { error } = await supabaseAdmin
        .from(table)
        .delete()
        .eq("user_id", userId);

      // テーブルが存在しない場合や user_id がない場合でもエラーで中断しないようにする
      if (error) {
        console.warn(`[self-delete] Failed to delete from ${table}:`, error.message);
      }
    }

    // 2. Auth ユーザー
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authError) throw authError;

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    // エラー内容を詳細に出力
    if (err instanceof Error) {
      console.error("[self-delete] Error:", err.message, err.stack, err);
    } else {
      console.error("[self-delete] Unknown error:", err);
    }

    const message =
      err instanceof Error
        ? err.message + (err.stack ? "\n" + err.stack : "")
        : JSON.stringify(err);

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
