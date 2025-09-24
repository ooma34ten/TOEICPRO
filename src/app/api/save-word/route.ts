// src/app/api/save-word/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

interface WordRow {
  word: string;
  part_of_speech: string;
  meaning: string;
  example: string;
  translation: string;
  importance: string;
}

interface RequestBody {
  rows: WordRow[];
  userId: string;
}

export async function POST(req: Request) {
  try {
    const { rows, userId }: RequestBody = await req.json();

    if (!rows || !userId || rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "パラメータ不足です" },
        { status: 400 }
      );
    }

    // ① サブスク情報を取得（配列対応）
    const { data: subsList, error: subsError } = await supabaseAdmin
      .from("subscriptions")
      .select("is_active")
      .eq("user_id", userId);

    if (subsError) {
      return NextResponse.json(
        { success: false, message: "サブスク情報取得エラー: " + subsError.message },
        { status: 500 }
      );
    }

    const subs = subsList?.[0];
    const isSubscribed = subs?.is_active ?? false;

    // ② 未加入ユーザーの場合は200件まで制限
    if (!isSubscribed) {
  const { data: existingWords } = await supabaseAdmin
    .from("words")
    .select("id")
    .eq("user_id", userId);

  const existingCount = existingWords?.length ?? 0;
  const remaining = 200 - existingCount;

  if (existingCount + rows.length > 200) {
    // 400を返さずにサブスク誘導情報を返す
    return NextResponse.json({
      success: false,
      message: `サブスク未加入のため、保存可能な単語は残り ${remaining} 件までです`,
      action: {
        label: "サブスクに加入する",
        url: "/words/subscribe",
      },
      limitExceeded: true, // フロントで判定用
      remaining,
    });
  }
}


    // ③ 重複チェック（複数単語対応）
    const wordList = rows.map(r => r.word);

    const { data: existingRows } = await supabaseAdmin
      .from("words")
      .select("word")
      .in("word", wordList)
      .eq("user_id", userId);

    if (existingRows && existingRows.length > 0) {
      const existingWords = existingRows.map(r => r.word).join(", ");
      return NextResponse.json(
        { success: false, message: `すでに保存済み: 【${existingWords}】` },
        { status: 400 }
      );
    }

    // ④ 保存
    const insertData = rows.map((r) => ({
      user_id: userId,
      word: r.word,
      part_of_speech: r.part_of_speech,
      meaning: r.meaning,
      example_sentence: r.example,
      translation: r.translation,
      importance: r.importance,
      correct_count: 0,
      correct_dates: [],
    }));

    const { data, error } = await supabaseAdmin
      .from("words")
      .insert(insertData)
      .select("*"); // 配列として返す

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, results: data || [] });

  } catch (e: unknown) {
    let message = "不明なエラーです";
    if (e instanceof Error) message = e.message;
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
// src/app/api/save-word/route.ts
