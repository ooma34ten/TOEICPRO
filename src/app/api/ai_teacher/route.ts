import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { estimatedScore, weaknesses } = body;

    console.log("📩 受信データ:", body);

    const prompt = `
あなたはTOEIC講師です。
ユーザーのレベルは約 ${estimatedScore} 点。
苦手分野は ${weaknesses.join(", ")}。
このユーザーに合ったTOEIC Part 5 の問題を1問作成し、
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

    console.log("🧠 Gemini 送信プロンプト:", prompt);

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(prompt);

    let text = result.response.text();
    console.log("📝 Gemini 応答（raw）:", text);

    // ✅ コードブロックなどを除去
    text = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    console.log("🧹 整形後テキスト:", text);

    try {
      const json = JSON.parse(text);
      console.log("✅ JSON 解析成功:", json);
      return NextResponse.json(json);
    } catch (err) {
      console.error("❌ JSON 解析失敗:", err);
      return NextResponse.json({
        error: "Failed to parse Gemini output",
        raw: text,
      });
    }
  } catch (err: any) {
    console.error("💥 API エラー:", err);
    return NextResponse.json(
      { error: err.message || "Unknown server error" },
      { status: 500 }
    );
  }
}
