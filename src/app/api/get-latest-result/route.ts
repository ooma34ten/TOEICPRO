import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// GET メソッドとしてエクスポート
export async function GET(req: Request) {
  try {
    const userId = req.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json({ error: "userId missing" }, { status: 400 });
    }

    // 最新の結果を取得
    const { data, error } = await supabaseAdmin
      .from("test_results")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();


    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ result: data });
  } catch 
  {
    return NextResponse.json( { status: 500 });
  }
}
