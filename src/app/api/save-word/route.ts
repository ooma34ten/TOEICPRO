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

    // ① サブスクリプション情報を取得
    const { data: subsList, error: subsError } = await supabaseAdmin
      .from("subscriptions")
      .select("is_active")
      .eq("user_id", userId);

    if (subsError) {
      return NextResponse.json(
        { success: false, message: "サブスクリプション情報取得エラー: " + subsError.message },
        { status: 500 }
      );
    }

    const isSubscribed = subsList?.[0]?.is_active ?? false;

    // ② 未加入ユーザーの場合は200件まで制限
    if (!isSubscribed) {
      const { data: existingWords } = await supabaseAdmin
        .from("user_words")
        .select("words_id")
        .eq("user_id", userId);

      const existingCount = existingWords?.length ?? 0;
      const remaining = 200 - existingCount;

      if (existingCount + rows.length > 200) {
        return NextResponse.json({
          success: false,
          message: `サブスクリプション未加入のため、保存可能な単語は残り ${remaining} 件までです`,
          action: {
            label: "サブスクリプションに加入する",
            url: "/words/subscribe",
          },
          limitExceeded: true,
          remaining,
        });
      }
    }

    // ③ words_master から既存単語をチェック
    const wordList = rows.map((r) => r.word);
    const meaningList = rows.map((r) => r.meaning);
    const { data: existingMaster, error: selectError } = await supabaseAdmin
      .from("words_master")
      .select("id, word")
      .in("word", wordList)
      .in("meaning", meaningList); // --- IGNORE ---



    if (selectError) {
      return NextResponse.json(
        { success: false, message: "既存チェックエラー: " + selectError.message },
        { status: 500 }
      );
    }



    const newMasterData: { id: string; word: string }[] = [];


    // ⑤ すべての単語の id を統合
    const allWordsData = [
      ...(existingMaster ?? []),
      ...newMasterData,
    ];

    const wordIds = allWordsData.map((w) => w.id);

    // ⑥ user_words に同じ word_id が存在しないか確認
    const { data: existingUserWords } = await supabaseAdmin
      .from("user_words")
      .select("word_id")
      .eq("user_id", userId)
      .in("word_id", wordIds);

    const existingUserIds = new Set(existingUserWords?.map((w) => w.word_id) ?? []);
    const newUserWordData = allWordsData
      .filter((w) => !existingUserIds.has(w.id))
      .map((w) => ({
        user_id: userId,
        word_id: w.id,
        correct_count: 0,
        correct_dates: [],
      }));
    

    if (newUserWordData.length === 0) {
      return NextResponse.json(
        { success: false, message: "すでにすべての単語が保存済みです" },
        { status: 400 }
      );
    }

    // ⑦ user_words に保存
    const { error: userWordsError } = await supabaseAdmin
      .from("user_words")
      .insert(newUserWordData);

    if (userWordsError) {
      return NextResponse.json(
        { success: false, message: userWordsError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, message: "単語を保存しました", results: newUserWordData },
      { status: 200 }
    );
  } catch (e: unknown) {
    let message = "不明なエラーです";
    if (e instanceof Error) message = e.message;
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
