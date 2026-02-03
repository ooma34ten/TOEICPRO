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

  // 1. 全問題を取得
  let query = supabase.from("toeic_questions").select("*");

  if (categoryFilter && categoryFilter.length > 0) {
    query = query.in("category", categoryFilter);
  }
  if (levelFilter && levelFilter.length > 0) {
    query = query.in("level", levelFilter);
  }

  const { data: allQuestions, error: qError } = await query;
  if (qError || !allQuestions) {
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

    case "weakness":
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
      break;

    case "review":
      // 復習モード: 復習期限が来ている問題のみ
      filtered = scoredQuestions
        .filter((q) => q.dueForReview && historyMap.has(q.id))
        .sort((a, b) => b.priority - a.priority);
      break;

    default:
      filtered = scoredQuestions.sort((a, b) => b.priority - a.priority);
  }

  // 5. 指定数だけ返却（シャッフル要素を加える）
  const result = filtered.slice(0, Math.min(count * 2, filtered.length));
  
  // 上位候補からランダムに選択
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result.slice(0, count);
}

// =============================
// 弱点カテゴリ分析
// =============================
async function getWeaknessAnalysis(userId: string) {
  const { data: history, error } = await supabase
    .from("user_question_history")
    .select(`
      question_id,
      correct_count,
      incorrect_count,
      toeic_questions!inner (category, categories!inner (level1, level2))
    `)
    .eq("user_id", userId);

  if (error || !history) return [];

  type CategoryStats = {
    categoryId: number;
    categoryName: string;
    totalCorrect: number;
    totalIncorrect: number;
  };

  const categoryMap = new Map<number, CategoryStats>();

  history.forEach((h: {
    correct_count: number;
    incorrect_count: number;
    toeic_questions: {
      category: number;
      categories: { level1: string; level2: string };
    };
  }) => {
    const catId = h.toeic_questions?.category;
    if (!catId) return;

    const existing = categoryMap.get(catId);
    const catName = h.toeic_questions?.categories?.level2 || 
                    h.toeic_questions?.categories?.level1 || 
                    "その他";

    if (existing) {
      existing.totalCorrect += h.correct_count;
      existing.totalIncorrect += h.incorrect_count;
    } else {
      categoryMap.set(catId, {
        categoryId: catId,
        categoryName: catName,
        totalCorrect: h.correct_count,
        totalIncorrect: h.incorrect_count,
      });
    }
  });

  // 正解率でソート（低い順）
  return Array.from(categoryMap.values())
    .map((c) => ({
      ...c,
      total: c.totalCorrect + c.totalIncorrect,
      correctRate: c.totalCorrect / (c.totalCorrect + c.totalIncorrect),
    }))
    .filter((c) => c.total >= 3) // 最低3回以上解いたカテゴリのみ
    .sort((a, b) => a.correctRate - b.correctRate)
    .slice(0, 5);
}

// =============================
// API エンドポイント
// =============================
export async function POST(req: Request) {
  try {
    const body: SmartQuestionRequest = await req.json();
    const { userId, mode, count = 10, categoryFilter, levelFilter } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const questions = await getSmartQuestions(
      userId,
      mode || "quick",
      count,
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
