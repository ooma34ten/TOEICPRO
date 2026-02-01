import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// =============================
// 型定義
// =============================
type RequestBody = {
  estimatedScore: number;
  weakCategories: string[];
  count: number;
};

type ToeicQuestion = {
  id: string;
  word_id: string | null;
  question: string;
  translation: string | null;
  options: string[];
  answer: string;
  explanation: string | null;
  example_sentence: string | null;
  part_of_speech: string | null;
  category: string | null;
  importance: number | null;
  synonyms: string[] | null;
  level: number;
};

type AiQueueItem = {
  level: number;
  category: string | null;
  word_id: string | null;
};

// =============================
// スコア → レベル変換（自由に調整可）
// =============================
function scoreToLevel(score: number): number {
  if (score < 400) return 1; // Beginner
  if (score < 600) return 2; // Basic
  if (score < 800) return 3; // Intermediate
  return 4;                 // Advanced
}

// =============================
// クエリ用のプレースホルダ生成
// =============================
function placeholders(count: number): string {
  return Array.from({ length: count }, () => "?").join(",");
}

// =============================
// 出題API本体
// =============================
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestBody;

    const estimatedScore = body.estimatedScore ?? 450;
    const weakCategories = Array.isArray(body.weakCategories)
      ? body.weakCategories
      : [];
    const count = Math.min(50, Math.max(1, body.count ?? 10));

    const level = scoreToLevel(estimatedScore);

    // ----------------------------
    // レベル + カテゴリに合う問題を取得
    // ----------------------------
    const { data: questions } = await supabase
      .from("toeic_questions")
      .select("*")
      .eq("level", level)
      .order("created_at", { ascending: false });

    if (!questions) {
      return NextResponse.json(
        { questions: [], generated: 0, level },
        { status: 200 }
      );
    }

    // 1. 苦手カテゴリ優先
    const weakPool: ToeicQuestion[] = questions.filter((q) =>
      weakCategories.includes(q.category ?? "")
    );

    // 2. 通常カテゴリ
    const normalPool: ToeicQuestion[] = questions.filter(
      (q) => !weakCategories.includes(q.category ?? "")
    );

    const selected: ToeicQuestion[] = [];

    // 半分は苦手カテゴリ
    const weakCount = Math.floor(count / 2);

    // ----------------------------
    // 苦手カテゴリから選択
    // ----------------------------
    for (let i = 0; i < weakCount && weakPool.length > 0; i++) {
      const index = Math.floor(Math.random() * weakPool.length);
      selected.push(weakPool.splice(index, 1)[0]);
    }

    // ----------------------------
    // 残りは通常カテゴリから選択
    // ----------------------------
    for (let i = selected.length; i < count && normalPool.length > 0; i++) {
      const index = Math.floor(Math.random() * normalPool.length);
      selected.push(normalPool.splice(index, 1)[0]);
    }

    // ----------------------------
    // 不足があった場合、AI生成キューに入れる
    // ----------------------------
    const missing = count - selected.length;
    let queued = 0;

    if (missing > 0) {
      const queueItems: AiQueueItem[] = [];

      for (let i = 0; i < missing; i++) {
        const category =
          weakCategories[i % weakCategories.length] ?? null;

        queueItems.push({
          level,
          category,
          word_id: null,
        });
      }

      const inserted = await supabase
        .from("ai_generated_questions_queue")
        .insert(
            queueItems.map((q) => ({
            level: q.level,
            category: q.category,
            word_id: q.word_id,
            }))
        )
        .select("*");

        const queued = inserted.data ? inserted.data.length : 0;

    }

    // ----------------------------
    // レスポンス
    // ----------------------------
    return NextResponse.json(
      {
        questions: selected,
        generated: queued,
        level,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error(err);

    return NextResponse.json(
      {
        questions: [],
        generated: 0,
        level: null,
        error: "server error",
      },
      { status: 500 }
    );
  }
}
