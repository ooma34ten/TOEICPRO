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

    // 再出題判定のために過去の履歴を一括取得
    const questionIds = questions.map(q => q.id).filter(Boolean) as string[];
    const { data: historyData } = await supabaseAdmin
      .from("user_question_history")
      .select("question_id")
      .eq("user_id", userId)
      .in("question_id", questionIds);

    const answeredIds = new Set(historyData?.map(h => h.question_id) || []);
    console.log("historyData", historyData);

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
      const isReQuestion = q.id ? answeredIds.has(q.id) : false;
      console.log("id", q.id);
      console.log("answeredIds", answeredIds);

      console.log("isReQuestion", isReQuestion);
      const importance = q.importance ?? 3; // デフォルト3

      if (!isReQuestion) {
        // 初出題のみスコアを変動させる
        if (isCorrect) {
          // 初回正解: +1
          scoreDelta += 1 * importance;
        } else {
          // 初回不正解: -1
          scoreDelta -= 1 * importance;
        }
      } else {
        // 再出題: スコア変動なし
      }
    }

    console.log("scoreDelta", scoreDelta);

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

      // 4-1 test_result_items (単語登録は行わずテスト結果のアイテムだけ保存)
      const { error: itemErr } = await supabaseAdmin
        .from("test_result_items")
        .insert({
          result_id: resultId,
          question_id: q.id,
          user_answer: userAnswer,
          is_correct: isCorrect,
        });
      if (itemErr) throw itemErr;

      // 4-2 toeic_questions のグローバル統計を更新
      if (q.id) {
        await supabaseAdmin.rpc("increment_question_stats", {
          q_id: q.id,
          is_correct: isCorrect,
        });
      }
    }

    return NextResponse.json({ success: true, resultId, newScore });
  } catch (e) {
    let message = "Unknown error occurred";
    if (e instanceof Error) message = e.message;
    console.error("save-result error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
