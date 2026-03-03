import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    console.log("📩 Request received");

    const body = await req.json() as { question?: string };
    console.log("📥 Parsed body:", body);

    const question = body.question;

    if (!question || typeof question !== "string") {
      console.log("❌ Invalid question");
      return NextResponse.json({ error: "質問を入力してください" }, { status: 400 });
    }

    console.log("🔍 Fetching Gemini API with question:", question);

    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": process.env.GEMINI_API_KEY ?? "",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `
                  あなたは英語学習アシスタントです。
                  日本語で解答してください。
                  次の単語について、以下の JSON 形式 **だけ** を返してください。
                  JSON 以外の文章・記号・説明・マークダウンは一切出力してはいけません。
                  複数の意味がある場合は全て含めてください。
                  TOEIC対策ように解答してください。

                  形式:
                  {
                    "word": "example",
                    "definitions": [
                      {
                        "word": "単語（英語）",
                        "part_of_speech": "品詞（日本語）",
                        "meaning": "意味",
                        "example": "TOEICでよく出る例文。",
                        "translation": "例文の日本語訳",
                        "importance": "1〜5（数字で。5が最重要、TOEIC頻出度）",
                        "synonyms": "類義語をカンマ区切りで（例：obtain, acquire, gain）。なければ空文字列。"
                      }
                    ]
                  }

                  単語: ${question}
                  `,
                },
              ],
            },
          ],
        }),
      }
    );

    console.log("🌐 Gemini API status:", res.status, "ok:", res.ok);

    const data = await res.json();
    console.log("🔧 Gemini raw response:", JSON.stringify(data, null, 2));

    // テキスト抽出
    let answer = "回答なし";

    if (data?.candidates?.length) {
      const candidate = data.candidates[0];
      console.log("📌 Candidate:", candidate);

      if (Array.isArray(candidate.content) && candidate.content[0]?.parts?.length) {
        answer = candidate.content[0].parts[0].text;
      } else if (candidate.content?.parts?.length) {
        answer = candidate.content.parts[0].text;
      } else if (candidate.content?.text) {
        answer = candidate.content.text;
      } else if (candidate.text) {
        answer = candidate.text;
      }
    }

    console.log("📝 Extracted answer before cleaning:", answer);

    // JSON 部分だけを抽出
    if (answer !== "回答なし") {
      answer = answer
        .replace(/```json|```/g, "")
        .replace(/単語\s*[:：]\s*/g, "")
        .trim();

      const match = answer.match(/{[\s\S]*}/);
      if (match) {
        answer = match[0];
      }
    }

    console.log("🧹 Cleaned answer:", answer);

    // JSON.parse チェック
    try {
      JSON.parse(answer);
    } catch (e) {
      console.log("❗ JSON parse error:", e);
      console.log("❗ Raw parsed text:", answer);
      return NextResponse.json(
        { error: "正しいJSONを取得できませんでした", raw: answer },
        { status: 500 }
      );
    }

    console.log("✅ Final JSON OK");

    return NextResponse.json({ answer });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "不明なエラー";
    console.log("🔥 Unexpected error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
