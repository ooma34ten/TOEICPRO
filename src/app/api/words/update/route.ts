import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

interface UpdateRequestBody {
  id: number;
  correct_count: number;
  correct_dates: string[]; // 日付配列を想定
}

// ===== 共通セッション取得 =====
async function getSessionUser() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message);
  const user = data.session?.user;
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, correct_count, correct_dates } = (await req.json()) as UpdateRequestBody;

    if (!id) throw new Error("id が指定されていません");

    const user = await getSessionUser();

    const { error } = await supabase
      .from("user_words")
      .update({ correct_count, correct_dates })
      .eq("id", id)
      .eq("user_id", user.id); // 自分の単語だけ更新可能

    if (error) throw error;

    return NextResponse.json({ message: "更新成功" });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
