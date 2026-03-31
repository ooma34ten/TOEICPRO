"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { speakText } from "@/lib/speech";
import Confetti from "react-confetti";
import { Volume2, ChevronRight, Trophy, Zap, Target, RotateCcw, Type, BookOpen, History as HistoryIcon } from "lucide-react";
import { updateUserStats } from "@/app/actions/updateStats";

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
  optionDetails?: {
    option: string;
    meaning: string;
    partOfSpeech: string;
  }[];
  accuracy?: number | null;
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
  needsMore?: boolean;
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
  const [targetCount] = useState(10);
  const [latestScore, setLatestScore] = useState<number | null>(null);
  const [weakCategories, setWeakCategories] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [autoPlay, setAutoPlay] = useState(true);

  const prefetchedRef = useRef<Question[]>([]);
  const answerStartTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    const savedAutoPlay = localStorage.getItem("aiTeacherAutoPlay");
    if (savedAutoPlay !== null) setAutoPlay(savedAutoPlay === "true");
  }, []);

  const toggleAutoPlay = () => {
    setAutoPlay(prev => {
      const next = !prev;
      localStorage.setItem("aiTeacherAutoPlay", String(next));
      return next;
    });
  };

  const autoPlayRef = useRef(autoPlay);
  useEffect(() => { autoPlayRef.current = autoPlay; }, [autoPlay]);

  useEffect(() => {
    if (questions.length > 0 && questions[currentIndex] && !showResult) {
      if (!autoPlayRef.current) return;
      const currentQuestion = questions[currentIndex];
      const textToPlay = currentQuestion.question.replace(/_{2,}|＿{2,}|＿|_____|____|__|（　）|（☐）/g, currentQuestion.answer);
      const timer = setTimeout(() => {
        speakText(textToPlay);
      }, 300);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, showResult, questions]);

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
  const generateQuestions = useCallback(async (count: number = 5, mode: "initial" | "fill" | "both" = "both"): Promise<GenerateResponse | null> => {
    if (!userId) return null;

    try {
      const payload = {
        userId,
        estimatedScore: latestScore ?? 450,
        weaknesses: weakCategories,
        count,
        mode,
      };

      const res = await fetch("/api/ai_teacher", {
        method: "POST",
        headers: { "Content-Type": "application/json", userId },
        body: JSON.stringify(payload),
      });

      const data: GenerateResponse = await res.json();

      if (data.questions) {
        data.questions = data.questions.map((q: any, i: number) => ({
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
          optionDetails: q.optionDetails ?? [],
          accuracy: q.accuracy,
        }));
      }

      return data;
    } catch (err) {
      console.error("Question generation failed:", err);
      return null;
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

      // 1. まずはDBから既存の問題を高速に取得
      const response = await generateQuestions(10, "initial");

      if (response?.questions && response.questions.length > 0) {
        setQuestions(response.questions);
        setCurrentIndex(0);
        answerStartTimeRef.current = Date.now();
        setGenerating(false);

        // 2. 問題が足りなければ裏でAI生成を走らせる
        if (response.needsMore) {
          const fillCount = 10 - response.questions.length;
          generateQuestions(fillCount, "fill").then(fillRes => {
            if (fillRes?.questions) {
              setQuestions(prev => [...prev, ...fillRes.questions]);
            }
          });
        }
      } else {
        // DBに何もなければ、AI、または both で取得
        const fullRes = await generateQuestions(10, "both");
        if (fullRes?.questions && fullRes.questions.length > 0) {
          setQuestions(fullRes.questions);
          setCurrentIndex(0);
          answerStartTimeRef.current = Date.now();
        } else if (fullRes?.limitReached) {
          setError(fullRes.message || "本日の利用制限に達しました");
        }
        setGenerating(false);
      }
    };

    loadInitialQuestions();
  }, [userId]);

  // =============================
  // プリフェッチ
  // =============================
  const prefetchQuestions = useCallback(async () => {
    if (prefetchedRef.current.length > 0) return;

    const response = await generateQuestions(5, "both");
    if (response?.questions) {
      prefetchedRef.current = response.questions;
    }
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

    // Gamification
    if (isCorrect) {
      await updateUserStats(userId, 15, 1); // 15 XP for AI Teacher correct answer
    } else {
      await updateUserStats(userId, 2, 1); // 2 XP for effort on incorrect answer
    }

    // サーバーに保存
    try {
      const res = await fetch("/api/save_test_result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          questions: [current],
          selected: [getOptionLabel(current.options, selectedAnswer)],
          result: {
            correct: isCorrect ? 1 : 0,
            accuracy: isCorrect ? 1 : 0,
            predictedScore: latestScore ?? 450, // サーバー側で再計算されるので、ここはあくまで参考値
            weak: isCorrect ? [] : [current.category || "other"],
          },
        }),
      });

      const data = await res.json();
      if (data.success && data.newScore) {
        // サーバーから返ってきた最新スコアで更新
        setLatestScore(data.newScore);
      }

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
      setSessionStats(prev => ({ ...prev, endTime: new Date() }));
      return;
    }

    // 現在の問題が最後の問題か、またはquestions配列が空の場合
    if (currentIndex >= questions.length - 1) {
      // プリフェッチした問題を使用
      if (prefetchedRef.current.length > 0) {
        setQuestions(prefetchedRef.current);
        prefetchedRef.current = [];
        setCurrentIndex(0);
        setSelectedAnswer(null);
        setShowResult(false);
        answerStartTimeRef.current = Date.now();

        // 更に裏でプリフェッチ
        prefetchQuestions();
      } else {
        // プリフェッチがない場合は同期的に生成
        setGenerating(true);
        const response = await generateQuestions(5, "both");
        if (response?.questions && response.questions.length > 0) {
          setQuestions(response.questions);
          setCurrentIndex(0);
          setSelectedAnswer(null);
          setShowResult(false);
          answerStartTimeRef.current = Date.now();
        } else {
          // 問題が生成できなかった場合、セッション完了とみなす
          setSessionComplete(true);
          setSessionStats(prev => ({ ...prev, endTime: new Date() }));
        }
        setGenerating(false);
      }
    } else {
      // 次の問題へ進む
      setCurrentIndex((prev) => prev + 1);
      setSelectedAnswer(null);
      setShowResult(false);
      answerStartTimeRef.current = Date.now();
    }
  };

  // =============================
  // セッションリスタート
  // =============================
  const handleRestart = async () => {
    setQuestions([]);
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setSessionComplete(false);
    setSessionStats({
      total: 0,
      correct: 0,
      streak: 0,
      maxStreak: 0,
      startTime: new Date(),
    });
    prefetchedRef.current = [];

    setGenerating(true);
    const response = await generateQuestions(10, "initial");
    if (response?.questions && response.questions.length > 0) {
      setQuestions(response.questions);
      answerStartTimeRef.current = Date.now();

      if (response.needsMore) {
        generateQuestions(10 - response.questions.length, "fill").then(fillRes => {
          if (fillRes?.questions) {
            setQuestions(prev => [...prev, ...fillRes.questions]);
          }
        });
      }
    } else {
      const fullRes = await generateQuestions(10, "both");
      if (fullRes?.questions) {
        setQuestions(fullRes.questions);
      }
    }
    setGenerating(false);
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
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--accent)] border-t-transparent mx-auto mb-4"></div>
          <p className="text-[var(--muted-foreground)] text-sm">セッション確認中...</p>
        </div>
      </div>
    );
  }

  // =============================
  // エラー表示
  // =============================
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)] p-4">
        <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-8 max-w-md text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-lg font-bold text-[var(--foreground)] mb-2">利用制限</h2>
          <p className="text-[var(--muted-foreground)] text-sm mb-6">{error}</p>
          <button
            onClick={() => router.push("/words/random")}
            className="bg-[var(--primary)] text-[var(--primary-foreground)] px-6 py-2.5 rounded-lg font-semibold text-sm hover:opacity-90 transition"
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
      <div className="min-h-screen bg-[var(--background)] p-4 flex items-center justify-center">
        {showConfetti && typeof window !== "undefined" && (
          <Confetti width={window.innerWidth} height={window.innerHeight} />
        )}

        <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-8 max-w-lg w-full text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold text-[var(--foreground)] mb-1">セッション完了！</h1>
          <p className="text-[var(--muted-foreground)] text-sm mb-6">素晴らしい学習でした！</p>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-[var(--secondary)] rounded-lg p-4">
              <div className="text-2xl font-bold text-[var(--accent)]">{sessionStats.correct}</div>
              <div className="text-[11px] text-[var(--muted-foreground)]">正解数</div>
            </div>
            <div className="bg-[var(--secondary)] rounded-lg p-4">
              <div className="text-2xl font-bold text-emerald-500">{accuracy}%</div>
              <div className="text-[11px] text-[var(--muted-foreground)]">正解率</div>
            </div>
            <div className="bg-[var(--secondary)] rounded-lg p-4">
              <div className="text-2xl font-bold text-orange-500">{sessionStats.maxStreak}</div>
              <div className="text-[11px] text-[var(--muted-foreground)]">最大連続正解</div>
            </div>
            <div className="bg-[var(--secondary)] rounded-lg p-4">
              <div className="text-2xl font-bold text-[var(--foreground)]">{duration}分</div>
              <div className="text-[11px] text-[var(--muted-foreground)]">学習時間</div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleRestart}
              className="flex-1 bg-[var(--primary)] text-[var(--primary-foreground)] px-5 py-2.5 rounded-lg font-semibold text-sm hover:opacity-90 transition flex items-center justify-center gap-2"
            >
              <RotateCcw size={16} />
              もう一度
            </button>
            <button
              onClick={() => router.push("/words/progress")}
              className="flex-1 bg-[var(--secondary)] text-[var(--foreground)] px-5 py-2.5 rounded-lg font-semibold text-sm hover:bg-[var(--muted)] transition"
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
      <div className="min-h-screen bg-[var(--background)] p-4">
        <div className="max-w-2xl mx-auto pt-12">
          <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-8 text-center">
            <div className="relative w-12 h-12 mx-auto mb-5">
              <div className="absolute inset-0 rounded-full border-2 border-[var(--border)]"></div>
              <div className="absolute inset-0 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Zap className="text-[var(--accent)]" size={18} />
              </div>
            </div>
            <h2 className="text-base font-bold text-[var(--foreground)] mb-1">
              AIが問題を生成中...
            </h2>
            <p className="text-[13px] text-[var(--muted-foreground)]">
              あなたのレベルに合わせた問題を準備しています
            </p>
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
    <div className="min-h-screen bg-[var(--background)] pb-20">
      {showConfetti && typeof window !== "undefined" && (
        <Confetti width={window.innerWidth} height={window.innerHeight} recycle={false} />
      )}

      <div className="max-w-2xl mx-auto px-4 pt-4">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-lg font-bold text-[var(--foreground)] flex items-center gap-2">
            <Zap className="text-[var(--accent)] w-5 h-5" />
            Part 5 強化モード
          </h1>
          <div className="flex items-center gap-3">
            {sessionStats.streak >= 3 && (
              <div className="flex items-center gap-1 bg-orange-500/10 text-orange-600 dark:text-orange-400 px-2.5 py-1 rounded-md text-[12px] font-semibold border border-orange-500/20">
                <Trophy size={14} />
                {sessionStats.streak}連続!
              </div>
            )}
          </div>
        </div>

        {/* 進捗バー */}
        <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4 mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] text-[var(--muted-foreground)] flex items-center gap-1">
              <Target size={13} />
              目標: {sessionStats.total} / {targetCount} 問
            </span>
            <span className="text-[12px] font-semibold text-[var(--accent)]">
              正解率: {sessionStats.total > 0
                ? Math.round((sessionStats.correct / sessionStats.total) * 100)
                : 0}%
            </span>
          </div>
          <div className="h-1.5 bg-[var(--secondary)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--accent)] transition-all duration-500 rounded-full"
              style={{ width: `${getProgressPercent()}%` }}
            ></div>
          </div>
        </div>

        {/* 問題カード */}
        <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden">
          {/* 問題ヘッダー */}
          <div className="bg-[var(--secondary)] px-5 py-3 border-b border-[var(--border)]">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-semibold text-[var(--foreground)]">
                問題 {sessionStats.total + 1}
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold bg-[var(--primary)] text-[var(--primary-foreground)] px-2 py-0.5 rounded">
                  Part 5
                </span>
                <span className="text-[10px] text-[var(--muted-foreground)] bg-[var(--background)] px-2 py-0.5 rounded border border-[var(--border)]">
                  {"★".repeat(currentQuestion.importance)}
                </span>
                {currentQuestion.accuracy !== undefined && currentQuestion.accuracy !== null ? (
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${
                    currentQuestion.accuracy >= 80 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" :
                    currentQuestion.accuracy >= 50 ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" :
                    "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
                  }`}>
                    {currentQuestion.accuracy >= 80 ? "✨ ほぼ習得" : currentQuestion.accuracy >= 50 ? "🌱 習得しかけ" : "🔴 苦手"}
                  </span>
                ) : (
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded font-bold border border-emerald-500/20">
                    初出題
                  </span>
                )}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      const textToPlay = currentQuestion.question.replace(/_{2,}|＿{2,}|＿|_____|____|__|（　）|（☐）/g, currentQuestion.answer);
                      speakText(textToPlay);
                    }}
                    className="p-1 rounded-md hover:bg-[var(--muted)] transition text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                    title="音声を再生"
                  >
                    <Volume2 size={15} />
                  </button>
                  <button
                    onClick={toggleAutoPlay}
                    className={`p-1 rounded-md transition text-[10px] font-bold border ${autoPlay ? 'bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]/30' : 'bg-[var(--secondary)] text-[var(--muted-foreground)] border-[var(--border)]'}`}
                    title="自動再生切り替え"
                  >
                    {autoPlay ? "自動再生: ON" : "自動再生: OFF"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 問題文 */}
          <div className="p-5">
            <p className="text-[15px] text-[var(--foreground)] leading-relaxed mb-5">
              {currentQuestion.question}
            </p>

            {/* 選択肢 */}
            <div className="space-y-3">
              {currentQuestion.options.map((option, index) => {
                const label = String.fromCharCode(65 + index);
                const isSelected = selectedAnswer === option;
                const isAnswer = option === currentQuestion.answer;

                let buttonClass = "w-full text-left p-3.5 rounded-lg border transition-all duration-200 flex items-center gap-3 text-sm";

                if (showResult) {
                  if (isAnswer) {
                    buttonClass += " border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
                  } else if (isSelected && !isAnswer) {
                    buttonClass += " border-red-500 bg-red-500/10 text-red-700 dark:text-red-300";
                  } else {
                    buttonClass += " border-[var(--border)] bg-[var(--secondary)] text-[var(--muted-foreground)]";
                  }
                } else {
                  if (isSelected) {
                    buttonClass += " border-[var(--accent)] bg-[var(--accent)]/8 text-[var(--foreground)]";
                  } else {
                    buttonClass += " border-[var(--border)] hover:border-[var(--accent)]/40 hover:bg-[var(--secondary)] text-[var(--foreground)]";
                  }
                }

                return (
                  <button
                    key={index}
                    onClick={() => handleSelectAnswer(option)}
                    disabled={showResult}
                    className={buttonClass}
                  >
                    <span className={`w-7 h-7 rounded-md flex items-center justify-center font-semibold text-[12px] ${showResult && isAnswer ? "bg-emerald-500 text-white" :
                      showResult && isSelected && !isAnswer ? "bg-red-500 text-white" :
                        isSelected ? "bg-[var(--accent)] text-[var(--accent-foreground)]" :
                          "bg-[var(--secondary)] text-[var(--muted-foreground)]"
                      }`}>
                      {label}
                    </span>
                    <span className="flex-1">{option}</span>
                    {showResult && isAnswer && (
                      <span className="text-emerald-600 dark:text-emerald-400 text-[12px] font-semibold">✓ 正解</span>
                    )}
                    {showResult && isSelected && !isAnswer && (
                      <span className="text-red-500 text-[12px] font-semibold">✗</span>
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
                className="w-full mt-5 bg-[var(--primary)] text-[var(--primary-foreground)] py-3 rounded-lg font-semibold text-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
              >
                回答する
                <ChevronRight size={16} />
              </button>
            ) : (
              <div className="mt-5">
                {/* 結果表示 */}
                <div className={`p-4 rounded-lg mb-4 border ${isCorrect ? "bg-emerald-500/8 border-emerald-500/20" : "bg-red-500/8 border-red-500/20"
                  }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">
                      {isCorrect ? "🎉" : "💡"}
                    </span>
                    <span className={`font-bold text-sm ${isCorrect ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`}>
                      {isCorrect ? "正解！" : "不正解"}
                    </span>
                  </div>

                  <div className="text-[13px] text-[var(--foreground)] space-y-1.5">
                    <p><span className="font-semibold text-[var(--muted-foreground)]">訳:</span> {currentQuestion.translation}</p>
                    {currentQuestion.explanation && (
                      <p><span className="font-semibold text-[var(--muted-foreground)]">解説:</span> {currentQuestion.explanation}</p>
                    )}
                    <div className="flex flex-wrap gap-1.5 pt-2">
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-[var(--accent)]/10 text-[var(--accent)] rounded text-[11px] font-semibold border border-[var(--accent)]/20">
                        <Type size={11} />
                        {currentQuestion.partOfSpeech}
                      </span>
                      {currentQuestion.category?.split(" > ").map((cat, i) => (
                        <span key={i} className="flex items-center gap-1 px-2 py-0.5 bg-[var(--secondary)] text-[var(--muted-foreground)] rounded text-[11px] font-semibold border border-[var(--border)]">
                          <BookOpen size={11} />
                          {cat}
                        </span>
                      ))}
                    </div>
                    {currentQuestion.optionDetails && currentQuestion.optionDetails.length > 0 && (
                      <div className="mt-3 bg-[var(--secondary)] p-3 rounded-lg border border-[var(--border)]">
                        <p className="font-semibold text-[12px] mb-1.5 border-b border-[var(--border)] pb-1.5 text-[var(--foreground)]">選択肢の解説:</p>
                        <ul className="space-y-1">
                          {currentQuestion.optionDetails.map((detail, idx) => (
                            <li key={idx} className="flex flex-col sm:flex-row sm:gap-2 text-[12px]">
                              <span className="font-semibold text-[var(--foreground)] w-28 shrink-0">{detail.option}</span>
                              <span className="text-[var(--muted-foreground)]">
                                <span className="text-[10px] text-[var(--accent)] bg-[var(--accent)]/10 px-1.5 py-0.5 rounded mr-1.5">{detail.partOfSpeech}</span>
                                {detail.meaning}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={handleNextQuestion}
                  className="w-full bg-[var(--primary)] text-[var(--primary-foreground)] py-3 rounded-lg font-semibold text-sm hover:opacity-90 transition flex items-center justify-center gap-2"
                >
                  {sessionStats.total >= targetCount - 1 ? "結果を見る" : "次の問題へ"}
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 推定スコア表示 */}
        {latestScore && (
          <div className="mt-5 text-center text-[12px] text-[var(--muted-foreground)]">
            推定スコア: <span className="font-bold text-[var(--accent)]">{latestScore}</span>点
          </div>
        )}
      </div>
    </div>
  );
}
