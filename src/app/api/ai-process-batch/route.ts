import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// =============================
// 型定義
// =============================
type QueueRow = {
  id: string;
  level: number;
  category: string | null;
  word_id: string | null;
};

type GeneratedQuestion = {
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

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// =============================
// プロンプト生成
// =============================
function buildPrompt(item: QueueRow): string {
  return `
TOEIC 四択問題を 1 件だけ JSON のみで生成してください。

- レベル: ${item.level}
- カテゴリ: ${item.category ?? "なし"}
- options は 4 つ
- explanation と example_sentence は短く
- 出力は JSON のみ（前後の文章禁止）

出力形式:
{
  "question": "...",
  "translation": "...",
  "options": ["A","B","C","D"],
  "answer": "...",
  "explanation": "...",
  "example_sentence": "...",
  "part_of_speech": "...",
  "category": "${item.category ?? ""}",
  "importance": 3,
  "synonyms": ["..."],
  "level": ${item.level}
}
`;
}

// =============================
// JSON抽出（前後の余分な文字を除去）
// =============================
function extractJson(raw: string): string | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  return raw.slice(start, end + 1);
}

// =============================
// AI で 1 件生成
// =============================
async function processOne(item: QueueRow): Promise<GeneratedQuestion | null> {
  try {
    const prompt = buildPrompt(item);

    const model = genAI.getGenerativeModel({
      model: "models/gemini-2.5-flash"
    });

    const result = await model.generateContent(prompt);
    const raw = result.response.text();

    const jsonText = extractJson(raw);
    if (!jsonText) return null;

    const parsed = JSON.parse(jsonText) as GeneratedQuestion;

    if (!Array.isArray(parsed.options) || parsed.options.length !== 4) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

// =============================
// メイン API（10 件バッチ）
// =============================
export async function POST() {
  try {
    const { data: queue } = await supabase
      .from("ai_generated_questions_queue")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(10);

    if (!queue || queue.length === 0) {
      return NextResponse.json(
        { message: "no queue", processed: 0, saved: 0 },
        { status: 200 }
      );
    }

    let processedCount = 0;
    let savedCount = 0;
    const deleteIds: string[] = [];

    for (const raw of queue) {
      const item: QueueRow = raw;
      processedCount += 1;

      const generated = await processOne(item);
      if (!generated) continue;

      const insert = await supabase
        .from("toeic_questions")
        .insert(generated)
        .select("id");

      if (!insert.data || insert.data.length === 0) continue;

      savedCount += 1;
      deleteIds.push(item.id);
    }

    if (deleteIds.length > 0) {
      await supabase
        .from("ai_generated_questions_queue")
        .delete()
        .in("id", deleteIds);
    }

    return NextResponse.json(
      {
        message: "ok",
        processed: processedCount,
        saved: savedCount
      },
      { status: 200 }
    );
  } catch (err) {
    console.error(err);

    return NextResponse.json(
      { message: "server error", processed: 0, saved: 0 },
      { status: 500 }
    );
  }
}
