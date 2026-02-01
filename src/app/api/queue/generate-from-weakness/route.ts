import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// =============================
// 型定義
// =============================
type TestResultRow = {
  level: number | null;
  weak_categories: string[];
};

type QueueInsertRow = {
  level: number;
  category: string;
  status: "pending";
};

// =============================
// POST
// =============================
export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();

    if (
      typeof body !== "object" ||
      body === null ||
      !("user_id" in body) ||
      typeof (body as { user_id: unknown }).user_id !== "string"
    ) {
      return NextResponse.json(
        { message: "invalid body" },
        { status: 400 }
      );
    }

    const userId: string = (body as { user_id: string }).user_id;

    // -----------------------------
    // 最新のテスト結果を取得
    // -----------------------------
    const { data: testResult } = await supabase
      .from("test_results")
      .select("level, weak_categories")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single<TestResultRow>();

    if (!testResult || !testResult.level) {
      return NextResponse.json(
        { message: "no test result" },
        { status: 200 }
      );
    }

    if (
      !Array.isArray(testResult.weak_categories) ||
      testResult.weak_categories.length === 0
    ) {
      return NextResponse.json(
        { message: "no weak categories" },
        { status: 200 }
      );
    }

    // -----------------------------
    // キュー用データ生成
    // -----------------------------
    const queueRows: QueueInsertRow[] =
      testResult.weak_categories.slice(0, 5).map((category) => ({
        level: testResult.level as number,
        category,
        status: "pending"
      }));

    // -----------------------------
    // INSERT
    // -----------------------------
    const { error } = await supabase
      .from("ai_generated_questions_queue")
      .insert(queueRows);

    if (error) {
      console.error("insert error", error);
      return NextResponse.json(
        { message: "insert failed" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: "queued",
        count: queueRows.length
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("server error", err);
    return NextResponse.json(
      { message: "server error" },
      { status: 500 }
    );
  }
}
