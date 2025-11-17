import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Geminiクライアント初期化
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

interface AiTeacherRequest {
  estimatedScore: number;
  weaknesses: string[];
}

interface AiTeacherResponse {
  question: string;
  options: string[];
  answer: string; // "A", "B", "C", "D"
  explanation: string;
  partOfSpeech: string;
  example: string;
  importance: number;
  synonyms: string[];
}

export async function POST(req: Request) {
  try {
    const body: AiTeacherRequest = await req.json();
    const { estimatedScore, weaknesses } = body;

    const prompt = `
あなたはTOEIC講師です。
ユーザーのレベルは約 ${estimatedScore} 点。
苦手分野は ${weaknesses.join(", ")}。
このユーザーに合ったTOEIC Part 5 の問題を1問作成し、
日本語で解答し、
以下のJSON形式で出力してください。

{
  "question": "...",
  "options": ["A", "B", "C", "D"],
  "answer": "A",
  "explanation": "...",
  "partOfSpeech": "...",
  "example": "...",
  "importance": 1〜5,
  "synonyms": ["...", "..."]
}
`;

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(prompt);

    let text = result.response.text();
    console.log("📡 Gemini text response:", text);
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();

    // JSON 部分だけ抽出
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "JSON 部分を抽出できませんでした", raw: text });
    }

    const jsonText = jsonMatch[0];

    try {
      const json: AiTeacherResponse = JSON.parse(jsonText);
      return NextResponse.json(json);
    } catch (err) {
      return NextResponse.json({ err: "Failed to parse Gemini output", raw: jsonText });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message || "Unknown server error" }, { status: 500 });
  }
}
