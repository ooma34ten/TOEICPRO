"use server";

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * 単語をユーザーのMy単語帳(user_words)に保存する
 * 既に登録済みの場合はスキップする
 */
export async function saveWordToMyList(userId: string, wordId: string): Promise<{ success: boolean; alreadyExists: boolean }> {
  // 重複チェック
  const { data: existing } = await supabase
    .from("user_words")
    .select("id")
    .eq("user_id", userId)
    .eq("word_id", wordId)
    .maybeSingle();

  if (existing) {
    return { success: true, alreadyExists: true };
  }

  // 新規登録
  const { error } = await supabase
    .from("user_words")
    .insert({
      user_id: userId,
      word_id: wordId,
      correct_count: 0,
      registered_at: new Date().toISOString(),
    });

  if (error) {
    console.error("Failed to save word to my list:", error);
    return { success: false, alreadyExists: false };
  }

  return { success: true, alreadyExists: false };
}

/**
 * 複数の単語を一括でMy単語帳に保存する
 */
export async function saveWordsToMyList(userId: string, wordIds: string[]): Promise<{ savedCount: number; skippedCount: number }> {
  let savedCount = 0;
  let skippedCount = 0;

  for (const wordId of wordIds) {
    const result = await saveWordToMyList(userId, wordId);
    if (result.alreadyExists) {
      skippedCount++;
    } else if (result.success) {
      savedCount++;
    }
  }

  return { savedCount, skippedCount };
}
