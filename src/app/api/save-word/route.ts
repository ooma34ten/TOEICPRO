// src/app/api/save-word/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PostgrestError } from "@supabase/supabase-js";

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

interface WordsMaster {
  id: string;
  word: string;
  part_of_speech: string | null;
  meaning: string | null;
  example_sentence: string | null;
  translation: string | null;
  importance: string | null;
  registered_at: string;
}

interface UserWords {
  id: string;
  user_id: string;
  word_id: string;
  correct_count: number;
  incorrect_count: number;
  registered_at: string;
}

export async function POST(req: Request) {
  try {
    const { rows, userId }: RequestBody = await req.json();

    if (!rows?.length || !userId) {
      return NextResponse.json({ success: false, message: "パラメータ不足です" }, { status: 400 });
    }

    // ① サブスクリプション確認
    const { data: subsList, error: subsError } = await supabaseAdmin
      .from("subscriptions")
      .select("is_active")
      .eq("user_id", userId);

    if (subsError) {
      return NextResponse.json({ success: false, message: "サブスク取得エラー: " + subsError.message }, { status: 500 });
    }

    const isSubscribed = subsList?.[0]?.is_active ?? false;

    // ② 非加入者は200件制限
    if (!isSubscribed) {
      const { data: existingWords } = await supabaseAdmin
        .from("user_words")
        .select("id")
        .eq("user_id", userId);

      const existingCount = existingWords?.length ?? 0;
      const remaining = 200 - existingCount;

      if (existingCount + rows.length > 200) {
        return NextResponse.json({
          success: false,
          message: `サブスク未加入のため、残り ${remaining} 件まで`,
          action: { label: "サブスク加入", url: "/words/subscribe" },
          limitExceeded: true,
          remaining,
        });
      }
    }

  

    // ③ words_master に既存単語を取得
    const wordList = rows.map((r) => r.word);
    const meaningList = rows.map((r) => r.meaning);

    console.log("meaningList", meaningList);

    const { data: existingMasterData, error }: { data: WordsMaster[] | null; error: PostgrestError | null } =
      await supabaseAdmin
        .from("words_master")
        .select("*")
        .in("meaning", meaningList)
        .in("word", wordList);
    if (error) {
      console.error("Supabase エラー:", error.message);
      return NextResponse.json(
        { success: false, message: "既存単語チェックエラー: " + error.message },
        { status: 500 }
      );
    }

    console.log("existingMasterData", existingMasterData);

    const existingWordsSet = new Set(existingMasterData?.map((w) => w.word));

    // ④ 新規 words_master 作成
    const newMasterRows: WordsMaster[] = rows
      .filter((r) => !existingWordsSet.has(r.word))
      .map((r) => ({
        id: crypto.randomUUID(),
        word: r.word,
        part_of_speech: r.part_of_speech || null,
        meaning: r.meaning || null,
        example_sentence: r.example || null,
        translation: r.translation || null,
        importance: r.importance || null,
        registered_at: new Date().toISOString(),
      }));

    if (newMasterRows.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from("words_master")
        .insert(newMasterRows as WordsMaster[]);
      if (insertError) {
        return NextResponse.json({ success: false, message: "words_master 保存エラー: " + insertError.message }, { status: 500 });
      }
    }

    // ⑤ user_words 登録用データ作成
    const allMasterRows = [...(existingMasterData ?? []), ...newMasterRows];
    const wordIds = allMasterRows.map((w) => w.id);

    const { data: existingUserWords } = await supabaseAdmin
      .from("user_words")
      .select("word_id")
      .eq("user_id", userId)
      .in("word_id", wordIds);

    const existingUserIds = new Set(existingUserWords?.map((w) => w.word_id) ?? []);
    
    const newUserWords: UserWords[] = wordIds
      .filter((id) => !existingUserIds.has(id))
      .map((id) => ({
        id: crypto.randomUUID(),
        user_id: userId,
        word_id: id,
        correct_count: 0,
        incorrect_count: 0,
        registered_at: new Date().toISOString(),
      }));

    if (newUserWords.length === 0) {
      return NextResponse.json({ success: false, message: "すでに全単語保存済みです" }, { status: 400 });
    }

    // ⑥ user_words 保存
    const { error: userWordsError } = await supabaseAdmin
      .from("user_words")
      .insert(newUserWords as UserWords[]);
    if (userWordsError) {
      return NextResponse.json({ success: false, message: "user_words 保存エラー: " + userWordsError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "単語を保存しました", results: newUserWords }, { status: 200 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "不明なエラーです";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
