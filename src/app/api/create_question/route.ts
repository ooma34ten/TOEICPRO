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
type categoryRow = {
  id: number;
  level1: string | null;
  level2: string | null;
  description: string | null;
};

type GeneratedQuestion = {
  question: string;
  translation: string | null;
  options: string[];
  answer: string;
  explanation: string | null;
  example_sentence: string | null;
  part_of_speech: string | null;
  category: number | null;
  importance: number | null;
  synonyms: string[] | null;
  level: number;
};

function randomImportance(): number {
  return Math.floor(Math.random() * 5) + 1;
}

function randomLevel(): number {
  const levels: number[] = [400, 500, 600, 700, 800, 900];
  return levels[Math.floor(Math.random() * levels.length)];
}


const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// =============================
// プロンプト生成
// =============================
function buildPrompt(item: categoryRow): string {
  return `
あなたは TOEIC 試験対策教材を作成する専門家です。

以下の条件をすべて厳守して、TOEIC 四択問題を **1 問だけ** 生成してください。

【重要ルール】
- プレースホルダ（"string", "...", "example" など）は絶対に使用しない
- 実際に TOEIC で出題されそうな自然な英文を作成する
- 出力は JSON オブジェクトそのもののみを返す
- バッククォートやコード記号、説明文、前置き、後書きは禁止
- JSON はそのまま JSON.parse できる形式にする
- **重要: 以下のフィールドは必ず「日本語」で出力すること**
  - translation (問題文の和訳。英語の単語を含めないこと)
  - explanation (正解の解説)
  - synonyms (類義語)
  - part_of_speech (品詞名)
- **重要: options の配列には (A) や 1. などの記号を含めないこと**

【問題条件】
- レベル: 400 ～ 900 点の間でランダムに設定(100 点刻み)
- カテゴリ　大分類: ${item.level1}
- カテゴリ　中分類: ${item.level2}
- 説明: ${item.description}
- 選択肢は必ず 4 つ
- options は "xxx" 形式(Abc. をつけない)
- answer は options の中の文字列と完全一致させる

【出力フォーマット（厳守）】
{
  "question": "英語の空欄補充問題文（1文）",
  "translation": "上記英文の自然な日本語訳（※必ず日本語で、(A) ... などの英語を含めない）",
  "options": [
    "word1",
    "word2",
    "word3",
    "word4"
  ],
  "answer": "...",
  "explanation": "なぜその選択肢が正解かを**日本語**で詳しく説明",
  "example_sentence": "正解語を使った別の例文（英語）",
  "part_of_speech": "品詞（名詞, 動詞, 形容詞, 副詞, 前置詞, 接続詞, 代名詞, 冠詞, 助動詞, 間投詞, 熟語・フレーズ, その他 のいずれか完全一致）",
  "category": ${item.id},
  "importance": "1~5 の数字で、TOEIC 頻出度を表す（5が頻出度が高い）",
  "synonyms": ["類義語1(日本語)", "類義語2(日本語)"],
  "level": [TOEIC レベル点数（整数：100～990）]
}
`;
}


// JSON 抽出ユーティリティ
function extractJson(text: string): string {
  // ```json ～ ``` を除去
  const fenceRemoved = text
    .replace(/```json\s*/i, "")
    .replace(/```/g, "")
    .trim();

  // 最初の { から最後の } までを抽出
  const start = fenceRemoved.indexOf("{");
  const end = fenceRemoved.lastIndexOf("}");

  if (start === -1 || end === -1) {
    throw new Error("No JSON object found");
  }

  return fenceRemoved.slice(start, end + 1);
}



// =============================
// AI で 1 件処理（gemini-2.5-flash）
// =============================
async function processOne(item: categoryRow): Promise<GeneratedQuestion | null> {
  try {
    const prompt = buildPrompt(item);

    const model = genAI.getGenerativeModel({
      model: "models/gemini-2.5-flash"
    });

    const result = await model.generateContent(prompt);
    const rawText: string = result.response.text();

    const jsonText = extractJson(rawText);
    const parsed: GeneratedQuestion = JSON.parse(jsonText);

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
// メイン API（バッチ生成対応）
// =============================
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const batchCount = Math.min(Math.max(body.count ?? 1, 1), 10); // 1〜10問

    const { data: queue, error } = await supabase
      .from("categories")
      .select("id, level1, level2, description")

    console.log("SUPABASE ERROR:", error);
    console.log("CATEGORIES RAW:", queue);

    if (!queue || queue.length === 0) {
      console.log("❌ NO CATEGORY FOUND");
      return NextResponse.json(
        { message: "NG", processed: 0, saved: 0 },
        { status: 200 }
      );
    }

    // バッチ: ランダムにカテゴリを選んで並列生成
    const selectedItems: categoryRow[] = [];
    for (let i = 0; i < batchCount; i++) {
      selectedItems.push(queue[Math.floor(Math.random() * queue.length)]);
    }

    console.log(`BATCH: generating ${batchCount} questions from ${selectedItems.length} categories`);

    const results = await Promise.allSettled(
      selectedItems.map((item) => processOne(item))
    );

    let processedCount = 0;
    let savedCount = 0;

    for (const result of results) {
      processedCount++;
      if (result.status !== "fulfilled" || !result.value) {
        console.log("❌ AI GENERATION FAILED for one item");
        continue;
      }

      const generated = result.value;
      const importance = randomImportance();
      const level = randomLevel();

      const insertResult = await supabase.from("toeic_questions").insert({
        question: generated.question,
        translation: generated.translation,
        options: generated.options,
        answer: generated.answer,
        explanation: generated.explanation,
        example_sentence: generated.example_sentence,
        part_of_speech: generated.part_of_speech,
        category: generated.category,
        importance,
        synonyms: generated.synonyms,
        level
      });

      if (insertResult.error) {
        console.error("INSERT ERROR:", insertResult.error);
      } else {
        savedCount++;
      }
    }

    console.log(`BATCH RESULT: processed=${processedCount}, saved=${savedCount}`);

    return NextResponse.json(
      { message: "ok", processed: processedCount, saved: savedCount },
      { status: 200 }
    );
  } catch (err) {
    console.error("SERVER ERROR:", err);
    return NextResponse.json(
      { message: "server error", processed: 0, saved: 0 },
      { status: 500 }
    );
  }
}
