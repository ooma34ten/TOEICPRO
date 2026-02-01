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
あなたは TOEIC 試験対策教材を作成する専門家です。

以下の条件をすべて厳守して、TOEIC 四択問題を **1 問だけ** 生成してください。

【重要ルール】
- プレースホルダ（"string", "...", "example" など）は絶対に使用しない
- 実際に TOEIC で出題されそうな自然な英文を作成する
- 出力は **JSON のみ**
- \`\`\` や説明文、前置き、後書きは禁止
- JSON はそのまま JSON.parse できる形式にする

【問題条件】
- レベル: ${item.level}
- カテゴリ: ${item.category ?? "vocabulary"}
- 選択肢は必ず 4 つ
- options は "A. xxx" 形式
- answer は options の中の文字列と完全一致させる

【出力フォーマット（厳守）】
{
  "question": "英語の空欄補充問題文（1文）",
  "translation": "上記英文の自然な日本語訳",
  "options": [
    "A. ...",
    "B. ...",
    "C. ...",
    "D. ..."
  ],
  "answer": "A. ...",
  "explanation": "なぜその選択肢が正解かを日本語で説明",
  "example_sentence": "正解語を使った別の例文（英語）",
  "part_of_speech": "品詞（名詞 / 動詞 / 形容詞 / 副詞 など）",
  "category": "${item.category ?? "vocabulary"}",
  "importance": "1~5 の数字で、TOEIC 頻出度を表す",
  "synonyms": ["類義語1", "類義語2"],
  "level": ${item.level}
}
`;
}



// =============================
// AI で 1 件処理（gemini-2.5-flash）
// =============================
async function processOne(item: QueueRow): Promise<GeneratedQuestion | null> {
  try {
    const prompt = buildPrompt(item);

    const model = genAI.getGenerativeModel({
      model: "models/gemini-2.5-flash"
    });

    const result = await model.generateContent(prompt);
    const text: string = result.response.text();

    const parsed: GeneratedQuestion = JSON.parse(text);

    if (!Array.isArray(parsed.options) || parsed.options.length !== 4) {
      return null;
    }

    return parsed;
  } catch (err) {
    console.error("AI JSON error:", err);
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
        .insert({
          question: generated.question,
          translation: generated.translation,
          options: generated.options,
          answer: generated.answer,
          explanation: generated.explanation,
          example_sentence: generated.example_sentence,
          part_of_speech: generated.part_of_speech,
          category: generated.category,
          importance: generated.importance,
          synonyms: generated.synonyms,
          level: generated.level
        })
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
    console.error("server error", err);
    return NextResponse.json(
      { message: "server error", processed: 0, saved: 0 },
      { status: 500 }
    );
  }
}
