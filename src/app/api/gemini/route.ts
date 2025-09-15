import { NextResponse } from "next/server";

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
                  あなたは英語学習アシスタントです。
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
                        "importance": "★★★★★/★★★★/★★★/★★/★"
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

    const data = await res.json();
    //console.log("Gemini response:", JSON.stringify(data, null, 2));


    // テキスト抽出
    let answer = "回答なし";
    if (data?.candidates?.length) {
      const candidate = data.candidates[0];
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

    // JSON 部分だけを抽出
    if (answer !== "回答なし") {
      // ```json や "単語:" を除去
      answer = answer.replace(/```json|```/g, "").replace(/単語\s*[:：]\s*/g, "").trim();

      // 最初の { から最後の } を抜き出す
      const match = answer.match(/{[\s\S]*}/);
      if (match) {
        answer = match[0];
      }
    }

    // バリデーション: JSON.parse に失敗したらエラー返す
    try {
      JSON.parse(answer);
    } catch {
      //console.log("Gemini raw response:", data);
      //console.log("Extracted answer before parse:", answer);
      return NextResponse.json({ error: "正しいJSONを取得できませんでした", raw: answer }, { status: 500 });
    }

    return NextResponse.json({ answer });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "不明なエラー";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// src/app/api/gemini/route.ts
