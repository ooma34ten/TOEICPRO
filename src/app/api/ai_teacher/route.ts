// 完全版 /api/ai_teacher
// ユーザー指定: TypeScript で any を使わない

import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// =============================
// 型定義
// =============================
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

type RawQuestion = Record<string, unknown>;

type ParsedResponse = {
  questions: RawQuestion[];
};

// =============================
// 型ガード
// =============================
function isQuestion(obj: unknown): obj is Question {
  if (typeof obj !== "object" || obj === null) return false;
  const q = obj as Record<string, unknown>;
  return (
    typeof q.id === "string" &&
    typeof q.question === "string" &&
    typeof q.translation === "string" &&
    Array.isArray(q.options) &&
    q.options.length === 4 &&
    q.options.every((o) => typeof o === "string") &&
    typeof q.answer === "string" &&
    typeof q.explanation === "string" &&
    typeof q.partOfSpeech === "string" &&
    typeof q.category === "string" &&
    typeof q.importance === "number" &&
    Array.isArray(q.synonyms) &&
    q.synonyms.every((s) => typeof s === "string")
  );
}

// =============================
// JSON パース
// =============================
function parseJsonSafe(text: string): ParsedResponse | null {
  try {
    const clean = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const first = clean.indexOf("{");
    const last = clean.lastIndexOf("}");
    if (first === -1 || last === -1) return null;
    const parsed = JSON.parse(clean.slice(first, last + 1));
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "questions" in parsed &&
      Array.isArray((parsed as ParsedResponse).questions)
    ) {
      return parsed as ParsedResponse;
    }
    return null;
  } catch {
    return null;
  }
}

// =============================
// 選択肢正規化
// =============================
function normalizeOptionText(raw: unknown): string {
  if (typeof raw !== "string") return "";

  // まず全体の先頭にある "A) / A. / A: / A：" などを削除
  let text = raw.replace(/^[A-D][\)\.\:\：\s\-–—]*?/i, "").trim();

  // 改行で複数行ある場合、最後の行を使用
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let last = lines.length ? lines[lines.length - 1] : text;

  // 行頭の記号（".", ")", "-", ":" など）を取り除く
  // 行頭の記号のみを削除（後ろが英数のときだけ）
  last = last.replace(/^[\.\)\-\:\：\s]+(?=[a-zA-Z0-9])/, "").trim();


  return last;
}


// =============================
// 翻訳の空欄補完
// =============================
function fillTranslationPlaceholder(translation: string, fillText: string): string {
  const pattern = /_{2,}|＿{2,}|＿|_____|____|__|（　）|（☐）|（　）/g;
  if (pattern.test(translation)) {
    const replacement = fillText.trim() !== "" ? fillText : "（語句）";
    return translation.replace(pattern, replacement);
  }
  return translation;
}

// =============================
// 回答を A/B → 選択肢テキストに解決
// =============================
function resolveAnswer(answerRaw: unknown, options: [string, string, string, string]): string {
  if (typeof answerRaw !== "string") return "";
  const trimmed = answerRaw.trim();
  const letter = trimmed.match(/^([A-Da-d])[\)\.\:\s]*$/);
  if (letter) {
    const index = letter[1].toUpperCase().charCodeAt(0) - 65;
    return options[index] ?? "";
  }
  for (let i = 0; i < 4; i++) {
    if (trimmed === options[i]) return options[i];
  }
  return trimmed;
}

// =============================
// API 本体
// =============================
export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("[ai_teacher] request body:", body);
    const userId = req.headers.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "userId が必要です" }, { status: 400 });
    }

    const weaknesses = Array.isArray(body.weaknesses)
      ? (body.weaknesses as string[])
      : [];
    const estimatedScore = typeof body.estimatedScore === "number" ? body.estimatedScore : 450;
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

    // 無料ユーザー制限
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
          message: "無料ユーザーは本日すでに1回利用済みです。",
        });
      }
    }

    // Gemini prompt
    const prompt = `
あなたはプロのTOEIC講師です。以下のルール厳守：
1) 出力は JSON のみ
2) 問題数は ${count} 問
3) 形式：
{
  "questions": [
    {
      "id": "一意ID",
      "question": "...",
      "translation": "...",
      "options": ["A", "B", "C", "D"],
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
苦手分野 ${weaknessText} を半分入れる。
推定スコア：${estimatedScore}
`; 

    // AI 実行
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    let parsed: ParsedResponse | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const result = await model.generateContent(prompt);
      const text = result.response.text();

      console.log(`[ai_teacher] Gemini attempt ${attempt}`);
      console.log(text);


      parsed = parseJsonSafe(text);
      if (parsed) break;
    }

    if (!parsed) {
      return NextResponse.json({
        questions: [],
        limitReached: false,
        message: "有効な問題を生成できませんでした。",
      });
    }

    // ----------------------------
    // バリデーション
    // ----------------------------
    const validated: Question[] = parsed.questions
      .map((raw, i) => {
        if (typeof raw !== "object" || raw === null) return null;
        const r = raw as RawQuestion;

        // options
        const rawOps = Array.isArray(r.options) ? r.options : [];
        const options: [string, string, string, string] = ["", "", "", ""];
        for (let j = 0; j < 4; j++) {
          options[j] = normalizeOptionText(rawOps[j]);
        }

        const answer = resolveAnswer(r.answer ?? "", options);
        const translationRaw = typeof r.translation === "string" ? r.translation : "";
        const translation = fillTranslationPlaceholder(translationRaw, answer);

        const q: Question = {
          id: typeof r.id === "string" ? r.id : `q_${Date.now()}_${i}`,
          question: typeof r.question === "string" ? r.question : "",
          translation,
          options,
          answer,
          explanation: typeof r.explanation === "string" ? r.explanation : "",
          partOfSpeech: typeof r.partOfSpeech === "string" ? r.partOfSpeech : "",
          example: typeof r.example === "string" ? r.example : undefined,
          category:
            typeof r.category === "string"
              ? r.category
              : typeof r.partOfSpeech === "string"
              ? r.partOfSpeech
              : "other",
          importance:
            typeof r.importance === "number"
              ? Math.min(5, Math.max(1, r.importance))
              : 3,
          synonyms: Array.isArray(r.synonyms)
            ? r.synonyms.filter((s): s is string => typeof s === "string")
            : [],
        };

        return isQuestion(q) ? q : null;
      })
      .filter((q): q is Question => q !== null);

    // 利用ログ保存
    await supabase.from("ai_usage_log").insert({ user_id: userId });

    console.log("[ai_teacher] parsed questions count:", parsed.questions.length);

    validated.forEach((q, i) => {
      console.log(`--- validated question ${i + 1} ---`);
      console.log("id:", q.id);
      console.log("question:", q.question);
      console.log("translation:", q.translation);
      console.log("options:", q.options);
      console.log("answer:", q.answer);
      console.log("partOfSpeech:", q.partOfSpeech);
      console.log("category:", q.category);
      console.log("importance:", q.importance);
      console.log("synonyms:", q.synonyms);
    });


    return NextResponse.json({
      questions: validated,
      limitReached: false,
      message: "生成成功",
    });
  } catch (err) {
    return NextResponse.json({
      questions: [],
      limitReached: false,
      message: "サーバーエラー",
    });
  }
}
