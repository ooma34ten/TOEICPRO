import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type TOEICAnswer = {
  summary: string;
  examples?: {
    text: string;
    translation?: string;
    point?: string;
    importance?: string;
  }[];
  tips?: string[];
};

export async function POST(req: Request) {
  try {
    const { question, userId } = await req.json();
    if (!question || typeof question !== "string") {
      return NextResponse.json({ error: "質問を入力してください" }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json({ error: "ログインしてください" }, { status: 401 });
    }

    // サブスク確認
    const { data: subsData } = await supabase
      .from("subscriptions")
      .select("is_active")
      .eq("user_id", userId)
      .eq("is_active", true)
      .single();

    const isSubscribed = !!subsData?.is_active;

    // 無料ユーザーは1日1回制限
    if (!isSubscribed) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { count } = await supabase
        .from("ai_usage_log")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("used_at", today.toISOString());

      if ((count ?? 0) >= 1) {
        return NextResponse.json(
          { error: "無料ユーザーは1日1回まで利用可能です。" },
          { status: 403 }
        );
      }
    }

    // AI呼び出し
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
以下の質問に対して、JSON形式で以下のフォーマットで回答してください。
質問: ${question}

JSON形式:
{
  "summary": "要点まとめ",
  "examples": [
    {
      "text": "例文",
      "translation": "日本語訳",
      "point": "TOEICでのポイント",
      "importance": "★★★★★ / ★★★★ / ★★★ / ★★ / ★"
    }
  ],
  "tips": ["学習のコツや注意点"]
}

※文章や説明は一切入れず、必ずJSONのみ返してください。
`,
                },
              ],
            },
          ],
        }),
      }
    );

    const data = await res.json();

    let answerText = "";
    if (data?.candidates?.length) {
      const content = data.candidates[0]?.content;
      if (Array.isArray(content?.parts) && content.parts[0]?.text) {
        answerText = content.parts[0].text;
      } else if (content?.text) {
        answerText = content.text;
      }
    }

    answerText = answerText.replace(/```json|```/g, "").trim();
    const match = answerText.match(/{[\s\S]*}/);
    if (match) answerText = match[0];

    let answer: TOEICAnswer;
    try {
      answer = JSON.parse(answerText);
    } catch {
      return NextResponse.json(
        { error: "正しいJSONを取得できませんでした", raw: answerText },
        { status: 500 }
      );
    }

    // 利用ログ登録（無料・サブスク関係なく記録しておく）
    await supabase.from("ai_usage_log").insert({ user_id: userId });

    return NextResponse.json({ answer });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "不明なエラー";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
