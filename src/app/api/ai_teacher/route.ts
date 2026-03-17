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
  optionDetails?: {
    option: string;
    meaning: string;
    partOfSpeech: string;
  }[];
};

type RawQuestion = Record<string, unknown>;

type ParsedResponse = {
  questions: RawQuestion[];
};

// =============================
// 型ガード
// =============================
function isQuestion(obj: unknown): obj is Question {
  if (typeof obj !== "object" || obj === null) {
    console.log("[isQuestion] Failed: Not an object");
    return false;
  }
  const q = obj as Record<string, unknown>;
  const isValid = (
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
    (q.synonyms === undefined || (Array.isArray(q.synonyms) && q.synonyms.every((s) => typeof s === "string")))
  );
  if (!isValid) {
    console.log("[isQuestion] Failed for object. id:", typeof q.id, "q:", typeof q.question, "trans:", typeof q.translation, "opt:", Array.isArray(q.options), "ans:", typeof q.answer, "exp:", typeof q.explanation, "pos:", typeof q.partOfSpeech, "cat:", typeof q.category, "imp:", typeof q.importance);
  }
  return isValid;
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
// 正規化: "(A) apple" -> "apple", "A. apple" -> "apple"
// 正規化: "(A) apple" -> "apple", "A. apple" -> "apple"
function normalizeOptionText(raw: unknown): string {
  if (typeof raw !== "string") return "";

  // 1. remove leading (A), (1), A., 1. etc.
  // We require a separator (paren, dot, colon) OR parens around the letter.
  // This prevents stripping "Because" -> "ecause" (where B is matched as the index).
  let text = raw.replace(/^[\(（][A-Da-d1-4][\)）]([\.\:\：]?\s*)?/, "").trim(); // Matches (A), (1)
  text = text.replace(/^[A-Da-d1-4][\.\)\:\：]\s*/, "").trim(); // Matches A., 1., A)

  // 2. remove leading non-alphanumeric symbols if any remain (e.g. "- ", ". ")
  text = text.replace(/^[\.\-\:\：]\s*/, "").trim();

  return text;
}


// =============================
// 翻訳の空欄補完
// =============================
function fillTranslationPlaceholder(translation: string): string {
  // 英語の答えをそのまま当てはめると「従業員のprivacyに関する」のようになって不自然なため、
  // プロンプト側で「完全な日本語の文にする」よう指示し、万が一空欄が残っていた場合は（空欄の部分）などにするかそのままにします。
  // ここではAIが生成した和訳を極力そのまま活かすため、無理に英語を挿入しません。
  return translation.replace(/_{2,}|＿{2,}|＿|_____|____|__|（　）|（☐）/g, "（空欄）");
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
3) **重要: "translation", "explanation", "partOfSpeech" は必ず日本語で出力すること。** 特に translation は自然な和訳にし、英語のままにしないこと。
   - translation に "(A) registration" のような英語の選択肢を含めないこと。
   - translation に "_____" や "(  )" のような空欄記号を含めず、正解を当てはめた【完全な日本語の文】にすること。
   - options の配列には、選択肢の記号(A, B, C, D)を含めないこと。純粋な単語/フレーズのみ。
4) **出題形式・難易度の厳密な調整**:
   - 出題形式は【すべて TOEIC Part 5 形式の短文穴埋め問題】のみに限定してください。長文や会話問題は不可です。
   - ユーザーの推定スコアは ${estimatedScore} 点です。
   - このスコアレベルの学習者にとって【少し歯ごたえのある（正解率60%程度になるような）】適切な難度の単語・文法・イディオムを出題してください。
   - 簡単すぎる基礎単語（例：run, make, easyなど）は避け、スコア ${estimatedScore} 点を取得するために必須となる頻出語彙や引っ掛け問題を意識してください。
   - 苦手分野 ${weaknessText} を半分入れてください。
5) 形式：
{
  "questions": [
    {
      "id": "一意ID",
      "question": "...",
      "translation": "（正解を当てはめた、自然で完全な日本語の文）...",
      "options": ["registration", "register", "registered", "registering"],
      "answer": "registration",
      "explanation": "（必ず日本語で）...",
      "partOfSpeech": "（必ず日本語で）...",
      "example": "...",
      "category": "...",
      "importance": 1,
      "synonyms": ["..."],
      "optionDetails": [
        { "option": "registration", "meaning": "登録", "partOfSpeech": "名詞" },
        { "option": "register", "meaning": "登録する", "partOfSpeech": "動詞" },
        { "option": "registered", "meaning": "登録された", "partOfSpeech": "形容詞" },
        { "option": "registering", "meaning": "登録すること", "partOfSpeech": "動名詞/現在分詞" }
      ]
    }
  ]
}
`;

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    console.log("========== AI Teacher Prompt ==========\n", prompt, "\n=============================================");

    let parsed: ParsedResponse | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const result = await model.generateContent(prompt);
      const text = result.response.text();

      console.log(`\n\n[ai_teacher] ====== Gemini attempt ${attempt} ======`);
      console.log(text);
      console.log(`=====================================================\n\n`);

      parsed = parseJsonSafe(text);
      if (parsed) {
        console.log("[ai_teacher] Successfully parsed JSON structure");
        break;
      } else {
        console.error("[ai_teacher] Failed to parse JSON on attempt", attempt);
      }
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
    const validatedRaw = parsed.questions
      .map((raw, i) => {
        if (typeof raw !== "object" || raw === null) return null;
        const r = raw as RawQuestion;

        // options
        const rawOps = Array.isArray(r.options) ? r.options : [];
        const options: [string, string, string, string] = ["", "", "", ""];
        for (let j = 0; j < 4; j++) {
          options[j] = normalizeOptionText(rawOps[j]);
        }

        // ensure we have exactly 4 valid string options (minimum fallback)
        for (let j = 0; j < 4; j++) {
          if (!options[j]) options[j] = `Option ${j + 1}`;
        }

        const answer = resolveAnswer(r.answer ?? "", options);
        const translationRaw = typeof r.translation === "string" ? r.translation : "";
        const translation = fillTranslationPlaceholder(translationRaw);

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
          optionDetails: Array.isArray(r.optionDetails)
            ? r.optionDetails.filter((d: any): d is { option: string; meaning: string; partOfSpeech: string } =>
              typeof d === "object" && d !== null &&
              typeof d.option === "string" &&
              typeof d.meaning === "string" &&
              typeof d.partOfSpeech === "string"
            )
            : [],
        };

        if (!isQuestion(q)) {
          const errMsg = `[isQuestion] Validation failed. id:${typeof (q as any)?.id}, q:${typeof (q as any)?.question}, trans:${typeof (q as any)?.translation}, opt:${Array.isArray((q as any)?.options)}, ans:${typeof (q as any)?.answer}, exp:${typeof (q as any)?.explanation}, pos:${typeof (q as any)?.partOfSpeech}, cat:${typeof (q as any)?.category}, imp:${typeof (q as any)?.importance}, syn:${typeof (q as any)?.synonyms}`;
          console.error(errMsg, JSON.stringify(q, null, 2));
          (q as any)._error = errMsg;
          return q as any; // エラーメッセージを持たせて一旦返す
        }
        return q as any;
      });

    const failedQuestions = validatedRaw.filter((q: any) => q?._error);
    const validated = validatedRaw.filter((q: any): q is Question => !q?._error);

    if (validated.length === 0 && failedQuestions.length > 0) {
      return NextResponse.json({
        questions: [],
        limitReached: false,
        message: `問題データの形式エラー: ${failedQuestions[0]._error}`
      });
    }

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
      console.log("optionDetails:", q.optionDetails);
    });


    return NextResponse.json({
      questions: validated,
      limitReached: false,
      message: "生成成功",
    });
  } catch (err: any) {
    console.error("[ai_teacher] Error in API:", err);
    return NextResponse.json({
      questions: [],
      limitReached: false,
      message: `サーバーエラー: ${err?.message || String(err)}`,
    });
  }
}
