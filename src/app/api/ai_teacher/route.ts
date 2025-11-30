import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

type Question = {
  id: string;
  question: string;
  translation: string;
  options: [string, string, string, string]; // 常に4要素
  answer: string;
  explanation: string;
  partOfSpeech: string;
  example?: string;
  category: string;
  importance: number;
  synonyms: string[];
};

type AiResponse = {
  questions: unknown[];
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

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { estimatedScore?: number; weaknesses?: string[]; count?: number };
    const estimatedScore = body.estimatedScore ?? 450;
    const weaknesses = Array.isArray(body.weaknesses) ? body.weaknesses : [];
    const count = Math.min(50, Math.max(1, Number(body.count) || 10));

    const weaknessText = weaknesses.length > 0 ? weaknesses.join(", ") : "";

    const prompt = `
あなたはプロのTOEIC講師です。以下のルールを厳守してください。

1) 出力は **純粋な JSON** のみ（前後に説明文や codeblock を一切書かない）。
2) 問題数は必ず ${count} 問とする。
3) JSON の形は次の通り：
{
  "questions": [
    {
      "id": "任意の一意な文字列",
      "question": "問題文（英語）",
      "translation": "訳（日本語、解答後表示用）",
      "options": ["選択肢1", "選択肢2", "選択肢3", "選択肢4"],
      "answer": "正解の単語",
      "explanation": "日本語での解説",
      "partOfSpeech": "品詞",
      "example": "例文",
      "category": "カテゴリ（例: 語彙/連語, 文法/前置詞）",
      "importance": 1,
      "synonyms": ["..."]
    }
  ]
}

4) ユーザーの苦手分野 (${weaknessText}) がある場合は半分程度出すこと。
5) importance は 1〜5 の整数。
6) options は必ず4要素。
7) answer は options の中の文字列。
8) 各 question に一意な "id" を付与。

ユーザーの推定スコアは ${estimatedScore} 点です。
`;

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(prompt);

    let text = result.response.text().trim();
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();

    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      return NextResponse.json({ error: "Gemini did not return JSON-like content", raw: text }, { status: 500 });
    }

    const jsonText = text.slice(firstBrace, lastBrace + 1);

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch (err) {
      return NextResponse.json({ error: "JSON parse error", raw: jsonText, message: String(err) }, { status: 500 });
    }

    if (typeof parsed !== "object" || parsed === null || !("questions" in parsed)) {
      return NextResponse.json({ error: "Invalid AI response structure", raw: parsed }, { status: 500 });
    }

    const rawQuestions = (parsed as AiResponse).questions;
    if (!Array.isArray(rawQuestions)) {
      return NextResponse.json({ error: "AI questions is not array", raw: parsed }, { status: 500 });
    }

    const validatedQuestions: Question[] = rawQuestions.map((q, i) => {
      const obj = q as Record<string, unknown>;
      const optionsArray: string[] = Array.isArray(obj.options)
        ? obj.options.slice(0, 4).map(String)
        : ["", "", "", ""];
      while (optionsArray.length < 4) optionsArray.push("");
      return {
        id: String(obj.id ?? `q_${Date.now()}_${i}`),
        question: String(obj.question ?? ""),
        translation: String(obj.translation ?? ""),
        options: optionsArray as [string, string, string, string],
        answer: String(obj.answer ?? ""),
        explanation: String(obj.explanation ?? ""),
        partOfSpeech: String(obj.partOfSpeech ?? ""),
        example: String(obj.example ?? ""),
        category: String(obj.category ?? obj.partOfSpeech ?? "other"),
        importance: Math.min(5, Math.max(1, Number(obj.importance ?? 3))),
        synonyms: Array.isArray(obj.synonyms) ? obj.synonyms.map(String) : [],
      };
    }).filter(isQuestion);

    return NextResponse.json({ questions: validatedQuestions });
  } catch (err) {
    console.error("ai_teacher error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
