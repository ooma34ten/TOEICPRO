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

export async function POST(req: Request) {
  try {
    const { words }: { words: WordRow[] } = await req.json();

    if (!Array.isArray(words) || words.length === 0) {
      return NextResponse.json(
        { success: false, message: "登録データがありません" },
        { status: 400 }
      );
    }

    const wordList = words.map((w) => w.word);

    // ✅ 型安全な Supabase 呼び出し
    const { data: existingMaster, error: selectError } = await supabaseAdmin
      .from<Pick<WordsMaster, "word">>("words_master")
      .select("word")
      .in("word", wordList);

    if (selectError) {
      return NextResponse.json(
        { success: false, message: `既存単語取得エラー: ${selectError.message}` },
        { status: 500 }
      );
    }

    const existingWordsSet = new Set(existingMaster?.map((w) => w.word) ?? []);

    const newMasterRows: WordsMaster[] = words
      .filter((w) => !existingWordsSet.has(w.word))
      .map((w) => ({
        id: crypto.randomUUID(),
        word: w.word,
        part_of_speech: w.part_of_speech || null,
        meaning: w.meaning || null,
        example_sentence: w.example || null,
        translation: w.translation || null,
        importance: w.importance || null,
        registered_at: new Date().toISOString(),
      }));

    if (newMasterRows.length === 0) {
      return NextResponse.json(
        { success: false, message: "すべての単語がすでに登録済みです" },
        { status: 400 }
      );
    }

    const { error: insertError } = await supabaseAdmin
      .from<WordsMaster>("words_master")
      .insert(newMasterRows);

    if (insertError) {
      return NextResponse.json(
        { success: false, message: `words_master 保存エラー: ${insertError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, message: "words_master に保存しました", results: newMasterRows },
      { status: 200 }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "不明なエラーです";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
