import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

interface Question {
  id?: string;
  question: string;
  translation: string;
  options: string[];
  answer: string;
  explanation: string;
  partOfSpeech: string;
  example: string;
  importance: number;
  synonyms: string[];
  category?: string;
}

interface TestResult {
  correct: number;
  accuracy: number;
  predictedScore: number;
  weak: string[];
}

interface SaveResultRequest {
  userId: string;
  questions: Question[];
  selected: string[];
  result: TestResult;
}

// 型ガード: Question
const isQuestion = (obj: unknown): obj is Question => {
  if (typeof obj !== "object" || obj === null) return false;
  const q = obj as Question;
  return (
    typeof q.question === "string" &&
    Array.isArray(q.options) &&
    q.options.every((o) => typeof o === "string") &&
    typeof q.answer === "string" &&
    typeof q.importance === "number"
  );
};

// 型ガード: TestResult
const isTestResult = (obj: unknown): obj is TestResult => {
  if (typeof obj !== "object" || obj === null) return false;
  const r = obj as TestResult;
  return (
    typeof r.correct === "number" &&
    typeof r.accuracy === "number" &&
    typeof r.predictedScore === "number" &&
    Array.isArray(r.weak) &&
    r.weak.every((w) => typeof w === "string")
  );
};

export async function POST(req: Request) {
  try {
    const body: unknown = await req.json();

    if (typeof body !== "object" || body === null) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { userId, questions, selected, result } = body as SaveResultRequest;

    if (!userId) return NextResponse.json({ error: "userId missing" }, { status: 400 });
    if (!Array.isArray(questions) || !questions.every(isQuestion)) {
      return NextResponse.json({ error: "Invalid questions array" }, { status: 400 });
    }
    if (!Array.isArray(selected) || selected.length !== questions.length) {
      return NextResponse.json({ error: "Invalid selected array" }, { status: 400 });
    }
    if (!isTestResult(result)) {
      return NextResponse.json({ error: "Invalid result object" }, { status: 400 });
    }

    // 1) 直近のスコアを取得
    const { data: latestResult } = await supabaseAdmin
      .from("test_results")
      .select("predicted_score")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let currentScore = latestResult?.predicted_score ?? 400; // 初回デフォルト

    // 2) スコア変動計算 (サーバー側で計算して不正防止)
    let scoreDelta = 0;

    // 問題ごとの正誤判定とスコア計算
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const label = selected[i];
      let userAnswer = "";

      if (typeof label === "string" && label.length > 0) {
        const idx = label.toUpperCase().charCodeAt(0) - 65;
        if (idx >= 0 && idx < q.options.length) userAnswer = q.options[idx];
      }

      const isCorrect = userAnswer.trim().toLowerCase() === q.answer.trim().toLowerCase();
      const importance = q.importance ?? 3; // デフォルト3

      if (isCorrect) {
        // 正解: 重要度が高いほど伸びる (例: ★5=10点, ★3=6点)
        scoreDelta += importance * 2;
      } else {
        // 不正解: 重要度が高いほど下がる (例: ★5=-5点, ★3=-3点)
        scoreDelta -= importance * 1;
      }
    }

    // 新しいスコア (10〜990の範囲に収める)
    let newScore = currentScore + scoreDelta;
    if (newScore > 990) newScore = 990;
    if (newScore < 10) newScore = 10;

    // 3) test_results に保存
    const { data: testResult, error: testError } = await supabaseAdmin
      .from("test_results")
      .insert({
        user_id: userId,
        correct_count: result.correct,
        accuracy: result.accuracy,
        predicted_score: newScore, // 計算したスコアを使用
        weak_categories: result.weak,
      })
      .select()
      .single();

    if (testError) throw testError;
    const resultId: string = testResult.id;

    // 4) 各問題を処理 (詳細保存)
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const label = selected[i];
      let userAnswer = "";

      if (typeof label === "string" && label.length > 0) {
        const idx = label.toUpperCase().charCodeAt(0) - 65;
        if (idx >= 0 && idx < q.options.length) userAnswer = q.options[idx];
      }

      const correctAnswer = q.answer;
      const isCorrect =
        userAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase();

      // 4-1 words_master
      const { data: existWord, error: existWordErr } = await supabaseAdmin
        .from("words_master")
        .select("id")
        .eq("word", correctAnswer)
        .limit(1)
        .maybeSingle();
      if (existWordErr) throw existWordErr;

      let wordId: string;
      if (existWord?.id) {
        wordId = existWord.id;
      } else {
        const { data: newWord, error: insertWordError } = await supabaseAdmin
          .from("words_master")
          .insert({
            word: correctAnswer,
            part_of_speech: q.partOfSpeech,
            meaning: q.translation,
            example_sentence: q.example,
            translation: q.translation,
            importance: String(q.importance ?? 3),
          })
          .select()
          .single();
        if (insertWordError) throw insertWordError;
        wordId = newWord.id;
      }

      // 4-2 test_result_items
      const { error: itemErr } = await supabaseAdmin
        .from("test_result_items")
        .insert({
          result_id: resultId,
          question: q.question,
          correct_answer: correctAnswer,
          user_answer: userAnswer,
          is_correct: isCorrect,
          part_of_speech: q.partOfSpeech,
          category: q.category ?? null,
        });
      if (itemErr) throw itemErr;

      // 4-3 user_words
      const { data: existUserWord, error: existUserWordErr } = await supabaseAdmin
        .from("user_words")
        .select("*")
        .eq("user_id", userId)
        .eq("word_id", wordId)
        .limit(1)
        .maybeSingle();
      if (existUserWordErr) throw existUserWordErr;

      let userWordId: string;
      if (existUserWord?.id) {
        const { error: updateErr } = await supabaseAdmin
          .from("user_words")
          .update({
            correct_count: (existUserWord.correct_count ?? 0) + (isCorrect ? 1 : 0),
            incorrect_count: (existUserWord.incorrect_count ?? 0) + (isCorrect ? 0 : 1),
          })
          .eq("id", existUserWord.id);
        if (updateErr) throw updateErr;
        userWordId = existUserWord.id;
      } else {
        const { data: insertedUserWord, error: insertUserWordErr } = await supabaseAdmin
          .from("user_words")
          .insert({
            user_id: userId,
            word_id: wordId,
            correct_count: isCorrect ? 1 : 0,
            incorrect_count: isCorrect ? 0 : 1,
          })
          .select()
          .single();
        if (insertUserWordErr) throw insertUserWordErr;
        userWordId = insertedUserWord.id;
      }

      // 4-4 user_word_history
      const { error: histErr } = await supabaseAdmin
        .from("user_word_history")
        .insert({
          user_id: userId,
          user_word_id: userWordId,
          is_correct: isCorrect,
        });
      if (histErr) throw histErr;
    }

    return NextResponse.json({ success: true, resultId, newScore });
  } catch (e) {
    let message = "Unknown error occurred";
    if (e instanceof Error) message = e.message;
    console.error("save-result error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
