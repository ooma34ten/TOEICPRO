"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { speakText } from "@/lib/speech";
import Confetti from "react-confetti";
import { Volume2, ChevronRight, Trophy, Zap, Target, RotateCcw } from "lucide-react";

// =============================
// 型定義
// =============================
type Question = {
  id: string;
  question: string;
  translation: string;
  options: string[];
  answer: string;
  explanation: string;
  partOfSpeech: string;
  category?: string;
  example?: string;
  importance: number;
  synonyms?: string[];
};

type SessionStats = {
  total: number;
  correct: number;
  streak: number;
  maxStreak: number;
  startTime: Date;
};

type GenerateResponse = {
  questions: Question[];
  limitReached?: boolean;
  message?: string;
};

// =============================
// メインコンポーネント
// =============================
export default function AITeacherPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [sessionStats, setSessionStats] = useState<SessionStats>({
    total: 0,
    correct: 0,
    streak: 0,
    maxStreak: 0,
    startTime: new Date(),
  });
  const [showConfetti, setShowConfetti] = useState(false);
  const [targetCount] = useState(20);
  const [latestScore, setLatestScore] = useState<number | null>(null);
  const [weakCategories, setWeakCategories] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sessionComplete, setSessionComplete] = useState(false);

  const prefetchedRef = useRef<Question[]>([]);
  const answerStartTimeRef = useRef<number>(Date.now());

  // =============================
  // 認証チェック
  // =============================
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/auth/login");
        return;
      }
      setUserId(data.session.user.id);
      setLoading(false);
    })();
  }, [router]);

  // =============================
  // 最新スコア取得
  // =============================
  useEffect(() => {
    if (!userId) return;

    (async () => {
      try {
        const res = await fetch("/api/get-latest-result", {
          headers: { "x-user-id": userId },
        });
        const json = await res.json();
        if (json.result) {
          setLatestScore(json.result.predicted_score ?? 450);
          setWeakCategories(json.result.weak_categories ?? []);
        }
      } catch (e) {
        console.error("Failed to fetch latest score:", e);
      }
    })();
  }, [userId]);

  // =============================
  // 問題生成
  // =============================
  const generateQuestions = useCallback(async (count: number = 5): Promise<Question[]> => {
    if (!userId) return [];

    try {
      const payload = {
        userId,
        estimatedScore: latestScore ?? 450,
        weaknesses: weakCategories,
        count,
      };

      const res = await fetch("/api/ai_teacher", {
        method: "POST",
        headers: { "Content-Type": "application/json", userId },
        body: JSON.stringify(payload),
      });

      const data: GenerateResponse = await res.json();

      if (data.limitReached) {
        setError(data.message || "本日の利用制限に達しました");
        return [];
      }

      if (!Array.isArray(data.questions)) {
        return [];
      }

      return data.questions.map((q, i) => ({
        id: q.id ?? `q_${Date.now()}_${i}`,
        question: q.question,
        translation: q.translation ?? "",
        options: q.options,
        answer: q.answer,
        explanation: q.explanation ?? "",
        partOfSpeech: q.partOfSpeech ?? "",
        category: q.category ?? q.partOfSpeech ?? "other",
        example: q.example ?? "",
        importance: Math.min(5, Math.max(1, Math.round(q.importance ?? 3))),
        synonyms: q.synonyms ?? [],
      }));
    } catch (err) {
      console.error("Question generation failed:", err);
      return [];
    }
  }, [userId, latestScore, weakCategories]);

  // =============================
  // 自動問題ロード（ページ初期化時）
  // =============================
  useEffect(() => {
    if (!userId || generating) return;

    const loadInitialQuestions = async () => {
      setGenerating(true);
      setError(null);

      const newQuestions = await generateQuestions(5);
      if (newQuestions.length > 0) {
        setQuestions(newQuestions);
        setCurrentIndex(0);
        answerStartTimeRef.current = Date.now();
      }

      setGenerating(false);

      // バックグラウンドで次の問題をプリフェッチ
      prefetchQuestions();
    };

    loadInitialQuestions();
  }, [userId]);

  // =============================
  // プリフェッチ
  // =============================
  const prefetchQuestions = useCallback(async () => {
    if (prefetchedRef.current.length > 0) return;

    const newQuestions = await generateQuestions(5);
    prefetchedRef.current = newQuestions;
  }, [generateQuestions]);

  // =============================
  // 回答選択
  // =============================
  const handleSelectAnswer = (answer: string) => {
    if (showResult) return;
    setSelectedAnswer(answer);
  };

  // =============================
  // 回答確定
  // =============================
  const handleSubmitAnswer = async () => {
    if (!selectedAnswer || !userId) return;

    const current = questions[currentIndex];
    const isCorrect = selectedAnswer === current.answer;
    const answerTimeMs = Date.now() - answerStartTimeRef.current;

    setShowResult(true);

    // 統計更新
    setSessionStats((prev) => {
      const newStreak = isCorrect ? prev.streak + 1 : 0;
      const newStats = {
        ...prev,
        total: prev.total + 1,
        correct: prev.correct + (isCorrect ? 1 : 0),
        streak: newStreak,
        maxStreak: Math.max(prev.maxStreak, newStreak),
      };

      // 連続正解ボーナス
      if (newStreak >= 5 && newStreak % 5 === 0) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);
      }

      return newStats;
    });

    // サーバーに保存
    try {
      await fetch("/api/save_test_result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          questions: [current],
          selected: [getOptionLabel(current.options, selectedAnswer)],
          result: {
            correct: isCorrect ? 1 : 0,
            accuracy: isCorrect ? 1 : 0,
            predictedScore: latestScore ?? 450,
            weak: isCorrect ? [] : [current.category || "other"],
          },
        }),
      });
    } catch (err) {
      console.error("Failed to save result:", err);
    }
  };

  // =============================
  // 次の問題へ
  // =============================
  const handleNextQuestion = async () => {
    // 目標達成チェック
    if (sessionStats.total >= targetCount) {
      setSessionComplete(true);
      return;
    }

    // 次の問題があるかチェック
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedAnswer(null);
      setShowResult(false);
      answerStartTimeRef.current = Date.now();
    } else {
      // プリフェッチした問題を使用
      if (prefetchedRef.current.length > 0) {
        setQuestions(prefetchedRef.current);
        prefetchedRef.current = [];
        setCurrentIndex(0);
        setSelectedAnswer(null);
        setShowResult(false);
        answerStartTimeRef.current = Date.now();

        // 次のプリフェッチを開始
        prefetchQuestions();
      } else {
        // プリフェッチがない場合は同期的に生成
        setGenerating(true);
        const newQuestions = await generateQuestions(5);
        if (newQuestions.length > 0) {
          setQuestions(newQuestions);
          setCurrentIndex(0);
          setSelectedAnswer(null);
          setShowResult(false);
          answerStartTimeRef.current = Date.now();
        }
        setGenerating(false);
      }
    }
  };

  // =============================
  // セッションリスタート
  // =============================
  const handleRestart = () => {
    setSessionComplete(false);
    setSessionStats({
      total: 0,
      correct: 0,
      streak: 0,
      maxStreak: 0,
      startTime: new Date(),
    });
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setShowResult(false);
    prefetchedRef.current = [];

    // 新しい問題を生成
    (async () => {
      setGenerating(true);
      const newQuestions = await generateQuestions(5);
      if (newQuestions.length > 0) {
        setQuestions(newQuestions);
        answerStartTimeRef.current = Date.now();
      }
      setGenerating(false);
    })();
  };

  // =============================
  // ヘルパー関数
  // =============================
  const getOptionLabel = (options: string[], answer: string): string => {
    const index = options.indexOf(answer);
    return index >= 0 ? String.fromCharCode(65 + index) : "";
  };

  const getProgressPercent = () => {
    return Math.min((sessionStats.total / targetCount) * 100, 100);
  };

  // =============================
  // ローディング表示
  // =============================
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">セッション確認中...</p>
        </div>
      </div>
    );
  }

  // =============================
  // エラー表示
  // =============================
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">利用制限</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => router.push("/words/random")}
            className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-indigo-700 transition"
          >
            問題バンクで学習する
          </button>
        </div>
      </div>
    );
  }

  // =============================
  // セッション完了画面
  // =============================
  if (sessionComplete) {
    const accuracy = sessionStats.total > 0
      ? Math.round((sessionStats.correct / sessionStats.total) * 100)
      : 0;
    const duration = Math.round((Date.now() - sessionStats.startTime.getTime()) / 1000 / 60);

    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4 flex items-center justify-center">
        {showConfetti && typeof window !== "undefined" && (
          <Confetti width={window.innerWidth} height={window.innerHeight} />
        )}

        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-lg w-full text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-3xl font-bold text-indigo-700 mb-2">セッション完了！</h1>
          <p className="text-gray-600 mb-6">素晴らしい学習でした！</p>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-indigo-50 rounded-xl p-4">
              <div className="text-3xl font-bold text-indigo-600">{sessionStats.correct}</div>
              <div className="text-sm text-gray-600">正解数</div>
            </div>
            <div className="bg-green-50 rounded-xl p-4">
              <div className="text-3xl font-bold text-green-600">{accuracy}%</div>
              <div className="text-sm text-gray-600">正解率</div>
            </div>
            <div className="bg-yellow-50 rounded-xl p-4">
              <div className="text-3xl font-bold text-yellow-600">{sessionStats.maxStreak}</div>
              <div className="text-sm text-gray-600">最大連続正解</div>
            </div>
            <div className="bg-purple-50 rounded-xl p-4">
              <div className="text-3xl font-bold text-purple-600">{duration}分</div>
              <div className="text-sm text-gray-600">学習時間</div>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={handleRestart}
              className="flex-1 bg-indigo-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-indigo-700 transition flex items-center justify-center gap-2"
            >
              <RotateCcw size={18} />
              もう一度
            </button>
            <button
              onClick={() => router.push("/words/progress")}
              className="flex-1 bg-gray-100 text-gray-700 px-6 py-3 rounded-xl font-medium hover:bg-gray-200 transition"
            >
              進捗を見る
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =============================
  // 問題生成中
  // =============================
  if (generating || questions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold text-center text-indigo-700 mb-8">
            🧠 TOEIC AI 問題演習
          </h1>

          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="relative w-20 h-20 mx-auto mb-6">
              <div className="absolute inset-0 rounded-full border-4 border-indigo-100"></div>
              <div className="absolute inset-0 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Zap className="text-indigo-500" size={24} />
              </div>
            </div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              AIが問題を生成中...
            </h2>
            <p className="text-gray-500">
              あなたのレベルに合わせた問題を準備しています
            </p>

            <div className="mt-6 bg-gray-100 rounded-full h-2 overflow-hidden">
              <div className="bg-indigo-500 h-full animate-pulse" style={{ width: "60%" }}></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =============================
  // メイン問題画面
  // =============================
  const currentQuestion = questions[currentIndex];
  const isCorrect = selectedAnswer === currentQuestion.answer;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4">
      {showConfetti && typeof window !== "undefined" && (
        <Confetti width={window.innerWidth} height={window.innerHeight} recycle={false} />
      )}

      <div className="max-w-2xl mx-auto">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-indigo-700 flex items-center gap-2">
            <Zap className="text-yellow-500" size={24} />
            AI 問題演習
          </h1>
          <div className="flex items-center gap-4">
            {sessionStats.streak >= 3 && (
              <div className="flex items-center gap-1 bg-orange-100 text-orange-600 px-3 py-1 rounded-full text-sm font-medium">
                <Trophy size={16} />
                {sessionStats.streak}連続正解!
              </div>
            )}
          </div>
        </div>

        {/* 進捗バー */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 flex items-center gap-1">
              <Target size={14} />
              今日の目標: {sessionStats.total} / {targetCount} 問
            </span>
            <span className="text-sm font-medium text-indigo-600">
              正解率: {sessionStats.total > 0
                ? Math.round((sessionStats.correct / sessionStats.total) * 100)
                : 0}%
            </span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
              style={{ width: `${getProgressPercent()}%` }}
            ></div>
          </div>
        </div>

        {/* 問題カード */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* 問題ヘッダー */}
          <div className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-6 py-4">
            <div className="flex items-center justify-between">
              <span className="text-sm opacity-90">
                問題 {sessionStats.total + 1}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-white/20 px-2 py-1 rounded">
                  重要度: {"★".repeat(currentQuestion.importance)}
                </span>
                <button
                  onClick={() => speakText(currentQuestion.question)}
                  className="p-1.5 rounded-full hover:bg-white/20 transition"
                >
                  <Volume2 size={18} />
                </button>
              </div>
            </div>
          </div>

          {/* 問題文 */}
          <div className="p-6">
            <p className="text-lg text-gray-800 leading-relaxed mb-6">
              {currentQuestion.question}
            </p>

            {/* 選択肢 */}
            <div className="space-y-3">
              {currentQuestion.options.map((option, index) => {
                const label = String.fromCharCode(65 + index);
                const isSelected = selectedAnswer === option;
                const isAnswer = option === currentQuestion.answer;

                let buttonClass = "w-full text-left p-4 rounded-xl border-2 transition-all duration-200 flex items-center gap-3";

                if (showResult) {
                  if (isAnswer) {
                    buttonClass += " border-green-500 bg-green-50 text-green-800";
                  } else if (isSelected && !isAnswer) {
                    buttonClass += " border-red-500 bg-red-50 text-red-800";
                  } else {
                    buttonClass += " border-gray-200 bg-gray-50 text-gray-500";
                  }
                } else {
                  if (isSelected) {
                    buttonClass += " border-indigo-500 bg-indigo-50 text-indigo-800 shadow-md";
                  } else {
                    buttonClass += " border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50";
                  }
                }

                return (
                  <button
                    key={index}
                    onClick={() => handleSelectAnswer(option)}
                    disabled={showResult}
                    className={buttonClass}
                  >
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center font-medium text-sm ${showResult && isAnswer ? "bg-green-500 text-white" :
                        showResult && isSelected && !isAnswer ? "bg-red-500 text-white" :
                          isSelected ? "bg-indigo-500 text-white" :
                            "bg-gray-200 text-gray-600"
                      }`}>
                      {label}
                    </span>
                    <span className="flex-1">{option}</span>
                    {showResult && isAnswer && (
                      <span className="text-green-600">✓ 正解</span>
                    )}
                    {showResult && isSelected && !isAnswer && (
                      <span className="text-red-600">✗</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* 回答ボタン or 結果表示 */}
            {!showResult ? (
              <button
                onClick={handleSubmitAnswer}
                disabled={!selectedAnswer}
                className="w-full mt-6 bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 rounded-xl font-medium hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
              >
                回答する
                <ChevronRight size={18} />
              </button>
            ) : (
              <div className="mt-6">
                {/* 結果表示 */}
                <div className={`p-4 rounded-xl mb-4 ${isCorrect ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"
                  }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-2xl ${isCorrect ? "text-green-600" : "text-red-600"}`}>
                      {isCorrect ? "🎉" : "💡"}
                    </span>
                    <span className={`font-bold ${isCorrect ? "text-green-700" : "text-red-700"}`}>
                      {isCorrect ? "正解！" : "不正解"}
                    </span>
                  </div>

                  <div className="text-sm text-gray-700 space-y-1">
                    <p><span className="font-medium">訳:</span> {currentQuestion.translation}</p>
                    {currentQuestion.explanation && (
                      <p><span className="font-medium">解説:</span> {currentQuestion.explanation}</p>
                    )}
                    <p><span className="font-medium">品詞:</span> {currentQuestion.partOfSpeech}</p>
                  </div>
                </div>

                <button
                  onClick={handleNextQuestion}
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 rounded-xl font-medium hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 flex items-center justify-center gap-2"
                >
                  {sessionStats.total >= targetCount - 1 ? "結果を見る" : "次の問題へ"}
                  <ChevronRight size={18} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 推定スコア表示 */}
        {latestScore && (
          <div className="mt-6 text-center text-sm text-gray-500">
            現在の推定スコア: <span className="font-bold text-indigo-600">{latestScore}</span>点
          </div>
        )}
      </div>
    </div>
  );
}
