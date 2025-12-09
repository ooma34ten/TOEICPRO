import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Question = {
  id: string;
  question: string;
  translation: string;
  options: [string, string, string, string];
  answer: string;
  explanation: string;
  partOfSpeech: string;
  example?: string;
  category: string;
  importance: number;
  synonyms: string[];
};

// 型ガード
function isQuestion(obj: unknown): obj is Question {
  if (typeof obj !== "object" || obj === null) return false;
  const q = obj as Record<string, unknown>;
  return (
    typeof q.id === "string" &&
    typeof q.question === "string" &&
    Array.isArray(q.options) &&
    q.options.length === 4 &&
    q.options.every((o) => typeof o === "string") &&
    typeof q.answer === "string" &&
    typeof q.translation === "string" &&
    typeof q.explanation === "string" &&
    typeof q.partOfSpeech === "string" &&
    typeof q.category === "string" &&
    typeof q.importance === "number" &&
    Array.isArray(q.synonyms) &&
    q.synonyms.every((s) => typeof s === "string")
  );
}

// JSONパース安全関数
function parseJsonSafe(text: string): unknown | null {
  try {
    const clean = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const firstBrace = clean.indexOf("{");
    const lastBrace = clean.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1) return null;
    const jsonText = clean.slice(firstBrace, lastBrace + 1);
    return JSON.parse(jsonText) as unknown;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const userId = req.headers.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "userId が必要です" }, { status: 400 });
    }

    const estimatedScore = body.estimatedScore ?? 450;
    const weaknesses: string[] = Array.isArray(body.weaknesses) ? body.weaknesses : [];
    const count = Math.min(50, Math.max(1, Number(body.count) || 10));
    const weaknessText = weaknesses.length > 0 ? weaknesses.join(", ") : "";

    // サブスク確認
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("is_active")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();
    const subscribed = sub?.is_active === true;

    // 無料ユーザー制限（1日1回）
    if (!subscribed) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { count: usage } = await supabase
        .from("ai_usage_log")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("used_at", today.toISOString());

      if ((usage ?? 0) >= 1) {
        return NextResponse.json({
          questions: [],
          limitReached: true,
          message: "無料ユーザーは本日すでに1回利用済みです。サブスクで無制限に利用可能です。",
        });
      }
    }

    // Gemini プロンプト
    const prompt = `
あなたはプロのTOEIC講師です。以下のルールを厳守してください。
1) 出力は必ず純粋な JSON のみ。
2) 問題数は必ず ${count} 問。
3) JSON 形式は次の通り：
{
  "questions": [
    {
      "id": "任意の一意なID",
      "question": "...",
      "translation": "...",
      "options": ["A","B","C","D"],
      "answer": "...",
      "explanation": "...",
      "partOfSpeech": "...",
      "example": "...",
      "category": "...",
      "importance": 1,
      "synonyms": ["..."]
    }
  ]
}
苦手分野 (${weaknessText}) があれば半分程度入れる。
importance は 1〜5。
answer は options の中身と完全一致する文字列。
推定スコア：${estimatedScore} 点。
`;

    // Gemini 実行（リトライ対応）
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    let parsed: unknown | null = null;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      parsed = parseJsonSafe(text);
      if (
        parsed &&
        typeof parsed === "object" &&
        "questions" in parsed &&
        Array.isArray((parsed as { questions: unknown[] }).questions)
      ) {
        break;
      }
      if (attempt < maxRetries) await new Promise((r) => setTimeout(r, 1000));
    }

    if (
      !parsed ||
      typeof parsed !== "object" ||
      !("questions" in parsed) ||
      !Array.isArray((parsed as { questions: unknown[] }).questions)
    ) {
      return NextResponse.json({
        questions: [],
        limitReached: false,
        message: "AI が有効な問題を生成できませんでした。少し時間をおいて再試行してください。",
      });
    }

    // バリデーション + 整形
    const rawQuestions: unknown[] = (parsed as { questions: unknown[] }).questions;
    const validated: Question[] = rawQuestions
      .map((q: unknown, i: number): Question | null => {
        if (typeof q !== "object" || q === null) return null;
        const obj = q as Record<string, unknown>;

        const options: [string, string, string, string] = ["", "", "", ""];
        if (Array.isArray(obj.options)) {
          for (let j = 0; j < 4; j++) {
            options[j] = typeof obj.options[j] === "string" ? obj.options[j] : "";
          }
        }

        const question: Question = {
          id: typeof obj.id === "string" ? obj.id : `q_${Date.now()}_${i}`,
          question: typeof obj.question === "string" ? obj.question : "",
          translation: typeof obj.translation === "string" ? obj.translation : "",
          options,
          answer: typeof obj.answer === "string" ? obj.answer : "",
          explanation: typeof obj.explanation === "string" ? obj.explanation : "",
          partOfSpeech: typeof obj.partOfSpeech === "string" ? obj.partOfSpeech : "",
          example: typeof obj.example === "string" ? obj.example : undefined,
          category:
            typeof obj.category === "string"
              ? obj.category
              : typeof obj.partOfSpeech === "string"
              ? obj.partOfSpeech
              : "other",
          importance:
            typeof obj.importance === "number" ? Math.min(5, Math.max(1, obj.importance)) : 3,
          synonyms: Array.isArray(obj.synonyms)
            ? obj.synonyms.filter((s): s is string => typeof s === "string")
            : [],
        };

        return isQuestion(question) ? question : null;
      })
      .filter((q): q is Question => q !== null);

    // 利用ログを保存
    await supabase.from("ai_usage_log").insert({ user_id: userId });

    // 正常レスポンス
    return NextResponse.json({
      questions: validated,
      limitReached: false,
      message: "問題生成に成功しました。",
    });
  } catch (error: unknown) {
    console.error("❌ /api/ai_teacher エラー", error);
    return NextResponse.json({
      questions: [],
      limitReached: false,
      message: "サーバーエラーが発生しました。時間をおいて再試行してください。",
    });
  }
}
