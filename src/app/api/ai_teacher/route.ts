import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { estimatedScore, weaknesses } = body;

    const prompt = `
あなたはプロのTOEIC講師です。

以下のルールを厳守してください：

1. JSON 以外の文章は一切書かない  
2. code block（\`\`\`json など）を絶対に使わない  
3. 必ず10問作る  
4. 絶対に次の形式とキー名を守る
5. ユーザーの苦手分野${weaknesses ?? ""}は必ず合わせて5問で、残り5問はランダムに出題する

{
  "questions": [
    {
      "question": "...",
      "translation": "...(解答後の表示用)",
      "options": ["A", "B", "C", "D"],
      "answer": "...",  //
      ・answer は **記号ではなく、正解の単語そのものを入れる**
      ・例えば options[1] が "suitable" なら answer は "suitable"
      "explanation": "...(日本語で)",
      "partOfSpeech": "...(日本語で)",
      "example": "...(日本語で)",
      "importance": 1,
      "synonyms": ["..."]
    }
  ]
}

ユーザーのレベルは ${estimatedScore} 点。
`;

console.log("Gemini prompt:", prompt);

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(prompt);

    let text = result.response.text().trim();

    // ① code block を除去
    text = text.replace(/```json/g, "").replace(/```/g, "");

    // ② "questions": [ が含まれていない場合はエラー
    if (!text.includes(`"questions"`)) {
      return NextResponse.json({
        error: "Gemini が JSON を返しませんでした",
        raw: text
      });
    }

    // ③ JSON 部分だけを抽出（最も安全）
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    const jsonText = text.slice(firstBrace, lastBrace + 1);

    let json;
    try {
      json = JSON.parse(jsonText);
    } catch (err) {
      return NextResponse.json({
        error: "JSON parse error",
        raw: jsonText,
        message: String(err)
      });
    }

    // ④ 必須形式チェック
    if (!json.questions || !Array.isArray(json.questions)) {
      return NextResponse.json({
        error: "questions が存在しません",
        raw: json
      });
    }

    console.log("JSON parsed successfully:", json);

    return NextResponse.json(json);

  } catch (err) {
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}
