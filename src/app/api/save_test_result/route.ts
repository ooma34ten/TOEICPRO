import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

interface SaveResultRequest {
  userId: string;
  questions: {
    question: string;
    translation: string;
    options: string[];
    answer: string;
    explanation: string;
    partOfSpeech: string;
    example: string;
    importance: number;
    synonyms: string[];
  }[];
  selected: string[];
  result: {
    correct: number;
    accuracy: number;
    predictedScore: number;
    weak: string[];
  };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SaveResultRequest;
    const { userId, questions, selected, result } = body;

    // ---------------------------------------
    // 1. test_results に保存
    // ---------------------------------------
    const { data: testResult, error: testError } = await supabaseAdmin
      .from("test_results")
      .insert({
        user_id: userId,
        correct_count: result.correct,
        accuracy: result.accuracy,
        predicted_score: result.predictedScore,
        weak_categories: result.weak,
      })
      .select()
      .single();

    if (testError) throw testError;

    const resultId = testResult.id;

    // ---------------------------------------
    // 2. 各問題の詳細を保存
    // ---------------------------------------
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const label = selected[i];
      const userAnswer = q.options[label.charCodeAt(0) - 65];
      const isCorrect = userAnswer === q.answer;

      // ------------------------------
      // 2-1. words_master に登録または取得
      // ------------------------------
      const { data: existWord } = await supabaseAdmin
        .from("words_master")
        .select("id")
        .eq("word", q.answer)
        .single();

      let wordId = existWord?.id;

      if (!wordId) {
        const { data: newWord, error: insertWordError } = await supabaseAdmin
          .from("words_master")
          .insert({
            word: q.answer,
            part_of_speech: q.partOfSpeech,
            meaning: q.translation,
            example_sentence: q.example,
            translation: q.translation,
            importance: q.importance.toString(),
          })
          .select()
          .single();

        if (insertWordError) throw insertWordError;
        wordId = newWord.id;
      }

      // ------------------------------
      // 2-2. test_result_items に保存
      // ------------------------------
      const { error: itemErr } = await supabaseAdmin
        .from("test_result_items")
        .insert({
          result_id: resultId,
          question: q.question,
          correct_answer: q.answer,
          user_answer: userAnswer,
          is_correct: isCorrect,
          part_of_speech: q.partOfSpeech,
        });

      if (itemErr) throw itemErr;

      // ------------------------------
      // 2-3. user_words 更新
      // ------------------------------
      const { data: existUserWord } = await supabaseAdmin
        .from("user_words")
        .select("*")
        .eq("user_id", userId)
        .eq("word_id", wordId)
        .single();

      if (existUserWord) {
        await supabaseAdmin
          .from("user_words")
          .update({
            correct_count: existUserWord.correct_count + (isCorrect ? 1 : 0),
            incorrect_count: existUserWord.incorrect_count + (isCorrect ? 0 : 1),
          })
          .eq("id", existUserWord.id);
      } else {
        await supabaseAdmin.from("user_words").insert({
          user_id: userId,
          word_id: wordId,
          correct_count: isCorrect ? 1 : 0,
          incorrect_count: isCorrect ? 0 : 1,
        });
      }

      // ------------------------------
      // 2-4. user_word_history に保存
      // ------------------------------
      await supabaseAdmin.from("user_word_history").insert({
        user_id: userId,
        user_word_id: wordId,
        is_correct: isCorrect,
      });
    }

    return NextResponse.json({ success: true, resultId });

  } catch (e) {
    // ------------------------------
    // any を使わない安全なエラーハンドリング
    // ------------------------------
    let message = "Unknown error occurred";

    if (e instanceof Error) {
      message = e.message;
    } else if (typeof e === "string") {
      message = e;
    } else if (typeof e === "object" && e !== null && "message" in e) {
      const m = (e as { message?: unknown }).message;
      if (typeof m === "string") message = m;
    }

    console.error("save-result error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
