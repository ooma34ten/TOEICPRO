import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { supabase } from "@/lib/supabaseClient";

interface WordRow {
  word: string;
  part_of_speech: string;
  meaning: string;
  example: string;
  translation: string;
  importance: string;
}

interface RequestBody {
  word: string;
  rows: WordRow[];
  userId: string;
}

export async function POST(req: Request) {
  try {
    const { word, rows, userId }: RequestBody = await req.json();

    if (!word || !rows || !userId) {
      return NextResponse.json(
        { success: false, message: "パラメータ不足です" },
        { status: 400 }
      );
    }

    // 重複チェック（配列で取得）
    const { data: existingRows, error: fetchError } = await supabase
      .from("words")
      .select("id")
      .eq("word", word)
      .eq("user_id", userId);

    // 重複チェック
    if (fetchError) {
      return NextResponse.json(
        { success: false, message: "既存チェックエラー: " + fetchError.message },
        { status: 500 }
      );
    }

    if (existingRows && existingRows.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: `すでに保存済み: 【${word}】 (${existingRows.length}件)`
        },
        { status: 400 }
      );
    }


    // ✅ 新規保存
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
      .select("*");

    if (error) {
      console.error("Supabase insert error:", error);
      console.error("Insert payload:", insertData);
      return NextResponse.json(
        { success: false, message: error.message, details: error },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, results: data || [] });
  } catch (e: unknown) {
    console.error("Route exception:", e);
    let message = "不明なエラーです";
    if (e instanceof Error) message = e.message;

    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}
