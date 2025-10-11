// src/app/api/add-to-master/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
    console.log("add-to-master API 実行");
  try {
    const { words } = await req.json();

    if (!Array.isArray(words) || words.length === 0) {
      return NextResponse.json(
        { success: false, message: "登録データがありません" },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("words_master")
      .insert(
        words.map((r: {
          word: string;
          part_of_speech: string;
          meaning: string;
          example: string;
          translation: string;
          importance: number;
        }) => ({
          word: r.word,
          part_of_speech: r.part_of_speech,
          meaning: r.meaning,
          example_sentence: r.example,
          translation: r.translation,
          importance: r.importance,
        }))
      );

    if (error) {
      console.error("words_master 挿入エラー:", error);
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, message: "words_master に保存しました" },
      { status: 200 }
    );
  } catch (e) {
    console.error("サーバーエラー:", e);
    return NextResponse.json(
      { success: false, message: "サーバーエラーです" },
      { status: 500 }
    );
  }
}
