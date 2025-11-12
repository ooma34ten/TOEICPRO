import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { question, userId } = await req.json();
    if (!question) return NextResponse.json({ error: "質問が必要です" }, { status: 400 });

    // サブスクチェック
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("is_active")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();

    const subscribed = sub?.is_active ?? false;

    // 無料ユーザー制限
    if (!subscribed) {
      const today = new Date(); today.setHours(0,0,0,0);
      const { count } = await supabase
        .from("ai_usage_log")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("used_at", today.toISOString());
      if ((count ?? 0) >= 1)
        return NextResponse.json({ error: "無料ユーザーは1日1回までです。" }, { status: 403 });
    }

    // Gemini呼び出し
    // --- 既存の prompt の代わりに以下を採用 ---
    // --- 改良版 prompt ---
    const prompt = `
    あなたはTOEIC専門の英語学習AIです。
    ユーザーの質問内容に応じて最適な形式で答えてください。
    必ず以下のルールに従ってください。

    ▼ 出力ルール
    - 出力は必ず JSON のみ。文以外は禁止。
    - 日本人向けに自然な解説を行う。
    - JSONキー構造は必ず固定（summary / examples / tips / extra）。
    - 全ての例文には必ず「translation（訳）」と「point（文法または使い方の説明）」を含める。
    - 「importance」は重要度を★5段階で評価。
    - 単語・熟語・文法項目を聞かれた場合（例：runの意味、on timeの使い方など）は：
      1. 例文を2〜3件出す。
      2. 各例文に「訳」「文法・意味のポイント」「重要度」を必ず付ける。
      3. さらに tips で学習のコツ・混同しやすい表現などを1〜3件出す。
    - 問題を求められた場合（例：「問題を出して」）は選択肢付き問題形式にし、「answer」を必ず含める。
    - 「勉強のコツ」などを聞かれた場合は例文を省略し、アドバイス中心にする。
    - TOEIC頻出単語・表現には extra で補足を付ける。

    質問: ${question}

    出力フォーマット:
    {
      "summary": "質問の要点を1〜2文でまとめる",
      "examples": [
        {
          "text": "例文または問題文(英語)",
          "translation": "日本語訳",
          "point": "文法や使い方の説明",
          "importance": "★★★★★",
          "answer": "正解（問題の場合のみ）",
          "choices": ["A案","B案","C案"]
        }
      ],
      "tips": [
        "単語・文法・勉強に関するコツや注意点を1〜3件"
      ],
      "extra": [
        {"title":"補足","content":"関連表現・派生語・TOEIC頻出ポイントなど"}
      ]
    }
    `;



    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": process.env.GEMINI_API_KEY!,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    const data = await res.json();
    const raw =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ??
      data?.candidates?.[0]?.output_text ??
      "";

    const cleaned = raw.replace(/```json|```/g, "").trim();
    const match = cleaned.match(/{[\s\S]*}/);
    if (!match) throw new Error("JSON形式の応答が見つかりません");

    const answer = JSON.parse(match[0]);

    console.log("TOEIC AI Answer:", answer);

    // ✅ 「訳が抜けている例文」に対して自動翻訳補完
    if (Array.isArray(answer.examples)) {
      for (const ex of answer.examples) {
        if (!ex.translation && ex.text) {
          // Google翻訳などを使わず簡易的に空欄を補完（フロント表示対策）
          ex.translation = "(訳がありません)";
        }
      }
    }

    // 利用記録を保存
    await supabase.from("ai_usage_log").insert({ user_id: userId });
    return NextResponse.json({ answer });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "質問内容を変更してください。（例：もう少し具体的に）" }, { status: 500 });
  }
}
