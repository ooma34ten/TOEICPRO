import { NextResponse } from "next/server";

type TOEICAnswer = {
  summary: string;
  examples?: { text: string; translation?: string; point?: string }[];
  tips?: string[];
};

export async function POST(req: Request) {
  try {
    const { question } = await req.json();
    if (!question || typeof question !== "string") {
      return NextResponse.json({ error: "質問を入力してください" }, { status: 400 });
    }

    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": process.env.GEMINI_API_KEY!,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `
あなたはTOEIC学習アシスタントです。
以下の形式で返してください。質問: ${question}

JSON形式:
{
  "summary": "要点まとめ",
  "examples": [
    {"text": "例文", "translation": "例文の日本語訳", "point": "TOEICでのポイント"}
  ],
  "tips": ["学習のコツや注意点"]
}
文章・説明は返さず、必ずJSONのみ返してください。
`
                }
              ]
            }
          ]
        })
      }
    );

    const data = await res.json();

    let answerText = "回答なし";
    if (data?.candidates?.length) {
      const candidate = data.candidates[0];
      if (Array.isArray(candidate.content) && candidate.content[0]?.parts?.length) {
        answerText = candidate.content[0].parts[0].text;
      } else if (candidate.content?.parts?.length) {
        answerText = candidate.content.parts[0].text;
      } else if (candidate.content?.text) {
        answerText = candidate.content.text;
      } else if (candidate.text) {
        answerText = candidate.text;
      }
    }

    // JSON抽出
    answerText = answerText.replace(/```json|```/g, "").trim();
    const match = answerText.match(/{[\s\S]*}/);
    if (match) answerText = match[0];

    // JSONパース
    let answer: TOEICAnswer;
    try {
      answer = JSON.parse(answerText);
    } catch {
      return NextResponse.json({ error: "正しいJSONを取得できませんでした", raw: answerText }, { status: 500 });
    }

    return NextResponse.json({ answer });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "不明なエラー";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
