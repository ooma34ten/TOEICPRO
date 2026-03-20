import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  try {
    const userId = req.headers.get("x-user-id");
    console.log("[get-latest-result] userId:", userId);

    if (!userId) {
      return NextResponse.json({ error: "userId missing" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("test_results")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // 🔥 ここが重要（DBの結果を丸ごと表示）
    console.log("[get-latest-result] raw data:", data);
    console.log("[get-latest-result] error:", error);

    if (error) {
      console.error("get-latest-result error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 🔥 どの値が使われるか明示
    console.log("[get-latest-result] predicted_score:", data?.predicted_score);
    console.log("[get-latest-result] weak_categories:", data?.weak_categories);
    console.log("[get-latest-result] created_at:", data?.created_at);

    return NextResponse.json({ result: data ?? null });

  } catch (e) {
    console.error("get-latest-result unexpected error:", e);
    return NextResponse.json({ error: "internal server error" }, { status: 500 });
  }
}
