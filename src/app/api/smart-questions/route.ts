import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// =============================
// 型定義
// =============================
type ToeicQuestion = {
  id: string;
  question: string;
  translation: string | null;
  options: string[];
  answer: string;
  explanation: string | null;
  example_sentence: string | null;
  part_of_speech: string | null;
  category: number | null;
  importance: number;
  synonyms: string[] | null;
  level: number;
  created_at: string;
};

type UserQuestionHistory = {
  question_id: string;
  correct_count: number;
  incorrect_count: number;
  last_answered_at: string;
};

type SmartQuestionRequest = {
  userId: string;
  mode: "quick" | "focus" | "weakness" | "review";
  count?: number;
  categoryFilter?: number[];
  levelFilter?: number[];
};

// =============================
// 忘却曲線に基づく復習間隔（日数）
// =============================
const REVIEW_INTERVALS: Record<number, number> = {
  0: 0,   // 未回答 → 即時
  1: 1,   // 1回正解 → 1日後
  2: 3,   // 2回正解 → 3日後
  3: 7,   // 3回正解 → 7日後
  4: 14,  // 4回正解 → 14日後
  5: 30,  // 5回正解 → 30日後
  6: 60,  // 6回以上 → 60日後（マスター）
};

// =============================
// 優先度スコア計算
// =============================
function calculatePriority(
  importance: number,
  correctRate: number,
  daysSinceLastAnswer: number,
  dueForReview: boolean
): number {
  // 基本スコア: 重要度 × (1 - 正解率)
  let score = importance * (1 - correctRate);

  // 復習期限を過ぎている場合はボーナス
  if (dueForReview) {
    score += 5;
  }

  // 最後の回答からの日数が長いほどボーナス
  score += Math.min(daysSinceLastAnswer / 7, 3);

  return score;
}

// =============================
// Fisher-Yates シャッフル
// =============================
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// =============================
// スマート問題取得ロジック
// =============================
async function getSmartQuestions(
  userId: string,
  mode: SmartQuestionRequest["mode"],
  count: number,
  categoryFilter?: number[],
  levelFilter?: number[]
): Promise<ToeicQuestion[]> {
  const now = new Date();


  // 1. 全問題を取得（not_in_mylistモードの場合はmy単語帳未登録のみ）
  let allQuestions: ToeicQuestion[] = [];
  let qError: any = null;
  if (mode === "not_in_mylist") {
    // user_wordsに存在しない単語のみ取得
    // 1. user_wordsから自分のword_id一覧を取得
    const { data: myWords, error: myWordsError } = await supabase
      .from("user_words")
      .select("word_id")
      .eq("user_id", userId);
    const myWordIds = (myWords ?? []).map((w: any) => w.word_id);

    // 2. words_masterからmyWordIds以外のwordを取得し、そのwordと一致するtoeic_questionsのみ抽出
    let query = supabase.from("toeic_questions").select("*");
    if (categoryFilter && categoryFilter.length > 0) {
      query = query.in("category", categoryFilter);
    }
    if (levelFilter && levelFilter.length > 0) {
      query = query.in("level", levelFilter);
    }
    if (myWordIds.length > 0) {
      query = query.not("id", "in", `(${myWordIds.map((id) => `'${id}'`).join(",")})`);
    }
    const { data, error } = await query;
    allQuestions = data ?? [];
    qError = error;
  } else {
    let query = supabase.from("toeic_questions").select("*");
    if (categoryFilter && categoryFilter.length > 0) {
      query = query.in("category", categoryFilter);
    }
    if (levelFilter && levelFilter.length > 0) {
      query = query.in("level", levelFilter);
    }
    const { data, error } = await query;
    allQuestions = data ?? [];
    qError = error;
  }
  if (qError || !allQuestions || allQuestions.length === 0) {
    console.error("Failed to fetch questions:", qError);
    return [];
  }

  // 2. ユーザーの回答履歴を取得
  const { data: history, error: hError } = await supabase
    .from("user_question_history")
    .select("question_id, correct_count, incorrect_count, last_answered_at")
    .eq("user_id", userId);

  const historyMap = new Map<string, UserQuestionHistory>();
  if (!hError && history) {
    history.forEach((h) => {
      historyMap.set(h.question_id, h);
    });
  }

  // 3. 各問題に優先度スコアを付与
  type ScoredQuestion = ToeicQuestion & { priority: number; dueForReview: boolean };

  const scoredQuestions: ScoredQuestion[] = allQuestions.map((q: ToeicQuestion) => {
    const h = historyMap.get(q.id);
    const correctCount = h?.correct_count ?? 0;
    const incorrectCount = h?.incorrect_count ?? 0;
    const totalAttempts = correctCount + incorrectCount;
    const correctRate = totalAttempts > 0 ? correctCount / totalAttempts : 0;

    let daysSinceLastAnswer = 999;
    let dueForReview = true;

    if (h?.last_answered_at) {
      const lastAnswered = new Date(h.last_answered_at);
      daysSinceLastAnswer = Math.floor(
        (now.getTime() - lastAnswered.getTime()) / (1000 * 60 * 60 * 24)
      );
      const requiredInterval = REVIEW_INTERVALS[Math.min(correctCount, 6)];
      dueForReview = daysSinceLastAnswer >= requiredInterval;
    }

    const priority = calculatePriority(
      q.importance ?? 3,
      correctRate,
      daysSinceLastAnswer,
      dueForReview
    );

    return { ...q, priority, dueForReview };
  });

  // 4. モードに応じてフィルタリング・ソート
  let filtered: ScoredQuestion[] = [];

  switch (mode) {
        case "not_in_mylist":
          // my単語帳未登録のみ: そのまま優先度順で出題
          filtered = scoredQuestions.sort((a, b) => b.priority - a.priority);
          break;
    case "quick":
      // クイックモード: ランダムに出題（未回答・復習期限優先）
      filtered = scoredQuestions
        .filter((q) => q.dueForReview || !historyMap.has(q.id))
        .sort((a, b) => b.priority - a.priority);
      break;

    case "focus":
      // 集中モード: 重要度の高い問題を優先
      filtered = scoredQuestions
        .sort((a, b) => {
          if (a.importance !== b.importance) return (b.importance ?? 0) - (a.importance ?? 0);
          return b.priority - a.priority;
        });
      break;

    case "weakness": {
      // 弱点克服モード: 正解率の低い問題を優先
      filtered = scoredQuestions
        .filter((q) => {
          const h = historyMap.get(q.id);
          if (!h) return false;
          const total = h.correct_count + h.incorrect_count;
          if (total < 2) return false;
          const rate = h.correct_count / total;
          return rate < 0.7;
        })
        .sort((a, b) => b.priority - a.priority);

      // フォールバック: 弱点問題がない場合は未回答の重要度が高い問題を出題
      if (filtered.length === 0) {
        console.log("[smart-questions] weakness fallback: using unanswered high-importance questions");
        filtered = scoredQuestions
          .filter((q) => !historyMap.has(q.id))
          .sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0));
      }
      break;
    }

    case "review": {
      // 復習モード: 復習期限が来ている問題のみ
      filtered = scoredQuestions
        .filter((q) => q.dueForReview && historyMap.has(q.id))
        .sort((a, b) => b.priority - a.priority);

      // フォールバック: 復習対象がない場合は優先度順に全問題から出題
      if (filtered.length === 0) {
        console.log("[smart-questions] review fallback: using priority-sorted questions");
        filtered = scoredQuestions
          .sort((a, b) => b.priority - a.priority);
      }
      break;
    }

    default:
      filtered = scoredQuestions.sort((a, b) => b.priority - a.priority);
  }

  // グローバルフォールバック: どのモードでも0件なら全問題からランダム
  if (filtered.length === 0) {
    console.log("[smart-questions] global fallback: using all questions shuffled");
    filtered = shuffleArray(scoredQuestions);
  }

  // 5. 指定数だけ返却（シャッフル要素を加える）
  const result = filtered.slice(0, Math.min(count * 2, filtered.length));

  // 上位候補からランダムに選択
  const shuffled = shuffleArray(result);

  return shuffled.slice(0, count);
}

// =============================
// 弱点カテゴリ分析（安全版）
// =============================
async function getWeaknessAnalysis(userId: string) {
  try {
    // Step 1: ユーザーの回答履歴を取得
    const { data: history, error: hError } = await supabase
      .from("user_question_history")
      .select("question_id, correct_count, incorrect_count")
      .eq("user_id", userId);

    if (hError || !history || history.length === 0) return [];

    // Step 2: 関連する質問のカテゴリを個別に取得
    const questionIds = history.map((h) => h.question_id);
    const { data: questions, error: qError } = await supabase
      .from("toeic_questions")
      .select("id, category")
      .in("id", questionIds);

    if (qError || !questions) return [];

    // 質問IDからカテゴリIDへのマップ
    const questionCategoryMap = new Map<string, number>();
    questions.forEach((q) => {
      if (q.category) questionCategoryMap.set(q.id, q.category);
    });

    // Step 3: カテゴリ情報を取得（存在する場合のみ）
    const categoryIds = [...new Set(
      questions.map((q) => q.category).filter((c): c is number => c !== null)
    )];

    const categoryNameMap = new Map<number, string>();
    if (categoryIds.length > 0) {
      const { data: cats } = await supabase
        .from("categories")
        .select("id, level1, level2")
        .in("id", categoryIds);

      if (cats) {
        cats.forEach((c: { id: number; level1: string | null; level2: string | null }) => {
          categoryNameMap.set(c.id, c.level2 || c.level1 || "その他");
        });
      }
    }

    // Step 4: カテゴリ別に集計
    type CategoryStats = {
      categoryId: number;
      categoryName: string;
      totalCorrect: number;
      totalIncorrect: number;
    };

    const categoryStatsMap = new Map<number, CategoryStats>();

    history.forEach((h) => {
      const catId = questionCategoryMap.get(h.question_id);
      if (!catId) return;

      const catName = categoryNameMap.get(catId) || `カテゴリ ${catId}`;
      const existing = categoryStatsMap.get(catId);

      if (existing) {
        existing.totalCorrect += h.correct_count;
        existing.totalIncorrect += h.incorrect_count;
      } else {
        categoryStatsMap.set(catId, {
          categoryId: catId,
          categoryName: catName,
          totalCorrect: h.correct_count,
          totalIncorrect: h.incorrect_count,
        });
      }
    });

    // 正解率でソート（低い順）
    return Array.from(categoryStatsMap.values())
      .map((c) => ({
        ...c,
        total: c.totalCorrect + c.totalIncorrect,
        correctRate: c.totalCorrect / (c.totalCorrect + c.totalIncorrect),
      }))
      .filter((c) => c.total >= 3)
      .sort((a, b) => a.correctRate - b.correctRate)
      .slice(0, 5);
  } catch (e) {
    console.error("Weakness analysis error:", e);
    return [];
  }
}

// =============================
// API エンドポイント
// =============================
export async function POST(req: Request) {
  try {
    const body: SmartQuestionRequest = await req.json();
    // AI問題演習は常に10問とするため、リクエストボディのcountは無視
    const { userId, mode, categoryFilter, levelFilter } = body;
    const count = 10;

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const questions = await getSmartQuestions(
      userId,
      mode || "quick",
      count, // 10に固定
      categoryFilter,
      levelFilter
    );

    const weaknesses = await getWeaknessAnalysis(userId);

    return NextResponse.json({
      questions,
      weaknesses,
      totalAvailable: questions.length,
    });
  } catch (err) {
    console.error("smart-questions error:", err);
    return NextResponse.json(
      { error: "Server error", questions: [], weaknesses: [] },
      { status: 500 }
    );
  }
}

// GET: 簡易テスト用
export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const questions = await getSmartQuestions(userId, "quick", 5);
  return NextResponse.json({ questions });
}

