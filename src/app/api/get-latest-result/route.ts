import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  try {
    const userId = req.headers.get("x-user-id");
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

    if (error) {
      console.error("get-latest-result error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // data may be null if no results yet — return null result for frontend handling
    return NextResponse.json({ result: data ?? null });
  } catch (e) {
    console.error("get-latest-result unexpected error:", e);
    return NextResponse.json({ error: "internal server error" }, { status: 500 });
  }
}
