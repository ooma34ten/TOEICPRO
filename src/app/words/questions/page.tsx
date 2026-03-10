"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { speakText } from "@/lib/speech";
import Confetti from "react-confetti";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  Target,
  RotateCcw,
  TrendingUp,
  BookOpen,
  CheckCircle,
  Clock,
  AlertTriangle,
  ChevronRight,
  Volume2,
  Flame,
  Star,
  Sparkles,
  Trophy,
} from "lucide-react";
import { updateUserStats } from "@/app/actions/updateStats";
import ReportButton from "@/components/ReportButton";

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
  part_of_speech: string;
  category?: number;
  importance: number;
  level: number;
  synonyms?: string[];
};

type WeaknessCategory = {
  categoryId: number;
  categoryName: string;
  correctRate: number;
  total: number;
};

type Mode = "quick" | "focus" | "weakness" | "review";

// =============================
// XPフローティングエフェクト
// =============================
const XpPopup = ({ xp, visible }: { xp: number; visible: boolean }) => (
  <AnimatePresence>
    {visible && (
      <motion.div
        initial={{ opacity: 0, y: 0, scale: 0.5 }}
        animate={{ opacity: 1, y: -50, scale: 1 }}
        exit={{ opacity: 0, y: -90, scale: 0.8 }}
        transition={{ duration: 0.8 }}
        className="absolute top-0 right-4 z-30 pointer-events-none"
      >
        <div className="flex items-center gap-1 bg-yellow-400 text-yellow-900 px-3 py-1.5 rounded-full text-sm font-bold shadow-lg">
          <Zap className="w-4 h-4" />
          +{xp} XP
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);

// =============================
// コンポーネント: モード選択カード
// =============================
const ModeCard = ({
  title,
  desc,
  icon: Icon,
  color,
  onClick
}: {
  title: string;
  desc: string;
  icon: any;
  color: string;
  onClick: () => void;
}) => (
  <motion.button
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    whileHover={{ scale: 1.03, y: -4 }}
    whileTap={{ scale: 0.97 }}
    onClick={onClick}
    className="relative overflow-hidden bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 border border-slate-100 dark:border-slate-800 text-left group"
  >
    <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity ${color}`}>
      <Icon size={80} />
    </div>
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${color} text-white shadow-lg`}>
      <Icon size={24} />
    </div>
    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">{title}</h3>
    <p className="text-sm text-slate-500 dark:text-slate-400">{desc}</p>
  </motion.button>
);

// =============================
// 称号取得
// =============================
function getTitle(accuracy: number): { title: string; emoji: string; color: string } {
  if (accuracy >= 100) return { title: "完璧！パーフェクト！", emoji: "🏆", color: "text-yellow-500" };
  if (accuracy >= 90) return { title: "素晴らしい！", emoji: "🌟", color: "text-indigo-500" };
  if (accuracy >= 80) return { title: "いい調子！", emoji: "🔥", color: "text-orange-500" };
  if (accuracy >= 60) return { title: "よくがんばりました！", emoji: "💪", color: "text-emerald-500" };
  return { title: "次はもっとできる！", emoji: "📚", color: "text-blue-500" };
}

// =============================
// メインページ
// =============================
export default function QuestionBankPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [weaknesses, setWeaknesses] = useState<WeaknessCategory[]>([]);
  const [mode, setMode] = useState<Mode | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [sessionStats, setSessionStats] = useState({ correct: 0, total: 0 });
  const [showConfetti, setShowConfetti] = useState(false);
  const [fetching, setFetching] = useState(false);

  // Motivation states
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [sessionXp, setSessionXp] = useState(0);
  const [xpPopup, setXpPopup] = useState<{ visible: boolean; amount: number }>({ visible: false, amount: 0 });
  const [showStreakEffect, setShowStreakEffect] = useState(false);

  const answerStartTimeRef = useRef<number>(0);

  // 初回ロード
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/auth/login");
        return;
      }
      setUserId(data.session.user.id);

      // 弱点情報の取得 (初期表示用)
      fetchWeaknesses(data.session.user.id);
      setLoading(false);
    })();
  }, [router]);

  const fetchWeaknesses = async (uid: string) => {
    try {
      const res = await fetch("/api/smart-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: uid, mode: "quick", count: 1 }),
      });
      const data = await res.json();
      if (data.weaknesses) {
        setWeaknesses(data.weaknesses);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const [noQuestionsMsg, setNoQuestionsMsg] = useState<string | null>(null);

  // 問題開始
  const startSession = async (selectedMode: Mode) => {
    if (!userId) return;
    setMode(selectedMode);
    setFetching(true);
    setQuestions([]);
    setSessionStats({ correct: 0, total: 0 });
    setCurrentIndex(0);
    setShowResult(false);
    setSelectedAnswer(null);
    setNoQuestionsMsg(null);
    setStreak(0);
    setMaxStreak(0);
    setSessionXp(0);

    let count = 10;
    if (selectedMode === "quick") count = 5;
    if (selectedMode === "focus") count = 20;
    if (selectedMode === "weakness") count = 10;

    try {
      const res = await fetch("/api/smart-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, mode: selectedMode, count }),
      });
      const data = await res.json();

      if (data.questions && data.questions.length > 0) {
        setQuestions(data.questions);
        answerStartTimeRef.current = Date.now();
      } else {
        setNoQuestionsMsg("問題バンクに問題がありません。管理画面で問題を生成してください。");
        setMode(null);
      }
    } catch (e) {
      setNoQuestionsMsg("問題の取得中にエラーが発生しました。もう一度お試しください。");
      setMode(null);
    } finally {
      setFetching(false);
    }
  };


  // 回答送信
  const submitAnswer = async () => {
    if (!selectedAnswer || !userId) return;

    const currentQ = questions[currentIndex];
    const isCorrect = selectedAnswer === currentQ.answer;
    const timeMs = Date.now() - answerStartTimeRef.current;

    setSessionStats(prev => ({
      total: prev.total + 1,
      correct: prev.correct + (isCorrect ? 1 : 0)
    }));
    setShowResult(true);

    // XP計算
    const xpGained = isCorrect ? 10 : 1;
    setSessionXp(prev => prev + xpGained);

    // XPポップアップ
    setXpPopup({ visible: true, amount: xpGained });
    setTimeout(() => setXpPopup({ visible: false, amount: 0 }), 1200);

    if (isCorrect) {
      const newStreak = streak + 1;
      setStreak(newStreak);
      if (newStreak > maxStreak) setMaxStreak(newStreak);

      // ストリーク効果
      if (newStreak >= 3) {
        setShowStreakEffect(true);
        setTimeout(() => setShowStreakEffect(false), 2000);
      }

      // コンフェティ
      if (newStreak >= 3 && newStreak % 3 === 0) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);
      }

      await updateUserStats(userId, 10, 1);
    } else {
      setStreak(0);
      await updateUserStats(userId, 1, 1);
    }

    // 保存
    try {
      await fetch("/api/save-question-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          questionId: currentQ.id,
          userAnswer: selectedAnswer,
          isCorrect,
          answerTimeMs: timeMs
        })
      });
    } catch (e) {
      console.error(e);
    }
  };

  // 次へ
  const nextQuestion = () => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setShowResult(false);
      answerStartTimeRef.current = Date.now();
    } else {
      setQuestions([]);
      setMode("finished" as any);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  // =============================
  // 完了画面
  // =============================
  if (mode === "finished" as any) {
    const accuracy = sessionStats.total > 0 ? Math.round((sessionStats.correct / sessionStats.total) * 100) : 0;
    const titleInfo = getTitle(accuracy);
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950">
        {accuracy >= 80 && <Confetti recycle={false} numberOfPieces={500} />}

        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", damping: 15 }}
          className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-8 max-w-md w-full text-center border border-slate-200 dark:border-slate-800"
        >
          {/* 称号アイコン */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.2, type: "spring" }}
            className="w-24 h-24 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-yellow-200 dark:shadow-yellow-900/30"
          >
            <span className="text-4xl">{titleInfo.emoji}</span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className={`text-2xl font-extrabold mb-1 ${titleInfo.color}`}
          >
            {titleInfo.title}
          </motion.h2>
          <p className="text-slate-500 dark:text-slate-400 mb-6">おつかれさまでした！🎉</p>

          {/* スタッツグリッド */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl"
            >
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {sessionStats.correct}/{sessionStats.total}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-1">正解数</div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className="bg-green-50 dark:bg-green-900/20 p-4 rounded-2xl"
            >
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{accuracy}%</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-1">正解率</div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-2xl"
            >
              <div className="flex items-center justify-center gap-1">
                <Zap className="w-5 h-5 text-yellow-500" />
                <span className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{sessionXp}</span>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-1">獲得 XP</div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 }}
              className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-2xl"
            >
              <div className="flex items-center justify-center gap-1">
                <Flame className="w-5 h-5 text-orange-500" />
                <span className="text-2xl font-bold text-orange-600 dark:text-orange-400">{maxStreak}</span>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-1">最大連続正解</div>
            </motion.div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => { setMode(null); setStreak(0); setMaxStreak(0); setSessionXp(0); fetchWeaknesses(userId!); }}
              className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 py-4 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              もう一回
            </button>
            <button
              onClick={() => router.push("/dashboard")}
              className="flex-1 bg-gradient-to-r from-indigo-600 to-violet-600 text-white py-4 rounded-xl font-bold hover:opacity-90 transition shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30 flex items-center justify-center gap-2"
            >
              ダッシュボード
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // =============================
  // クイズ画面
  // =============================
  if (mode && questions.length > 0) {
    const currentQ = questions[currentIndex];
    const progress = ((currentIndex + 1) / questions.length) * 100;

    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8">
        {showConfetti && <Confetti recycle={false} numberOfPieces={200} />}

        <div className="max-w-3xl mx-auto relative">
          {/* XPポップアップ */}
          <XpPopup xp={xpPopup.amount} visible={xpPopup.visible} />

          {/* ヘッダー */}
          <div className="flex items-center justify-between mb-6">
            <button onClick={() => setMode(null)} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm font-medium transition">
              ← 中断する
            </button>

            {/* セッション情報 */}
            <div className="flex items-center gap-3">
              {/* ストリーク表示 */}
              <AnimatePresence>
                {streak >= 2 && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="flex items-center gap-1 bg-orange-50 dark:bg-orange-900/20 px-2.5 py-1 rounded-full"
                  >
                    <Flame className={`w-4 h-4 ${streak >= 5 ? "text-orange-500 fill-orange-500 animate-streak-fire" : "text-orange-400"}`} />
                    <span className="text-xs font-bold text-orange-700 dark:text-orange-300">
                      {streak}連続！
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* XP表示 */}
              <div className="flex items-center gap-1 bg-yellow-50 dark:bg-yellow-900/20 px-2.5 py-1 rounded-full">
                <Zap className="w-3.5 h-3.5 text-yellow-500" />
                <span className="text-xs font-bold text-yellow-700 dark:text-yellow-300">{sessionXp} XP</span>
              </div>

              {/* 問題数 */}
              <div className="text-sm font-bold text-slate-500 dark:text-slate-400">
                {currentIndex + 1} / {questions.length}
              </div>
            </div>
          </div>

          {/* プログレスバー */}
          <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full mb-8 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          {/* ストリークメッセージ */}
          <AnimatePresence>
            {showStreakEffect && streak >= 3 && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="text-center mb-4"
              >
                <span className="bg-gradient-to-r from-orange-500 to-red-500 text-white text-sm font-bold px-4 py-2 rounded-full shadow-lg">
                  🔥 {streak}連続正解！{streak >= 5 ? "絶好調！" : "いい調子！"}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 問題カード */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.3 }}
              className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 p-6 md:p-10 mb-6"
            >
              <div className="flex justify-between items-start mb-6">
                <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-3 py-1 rounded-full text-xs font-bold">
                  Part 5 形式
                </span>
                <div className="flex gap-2">
                  <span className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-600 dark:text-slate-400">
                    Level {currentQ.level}
                  </span>
                  <button onClick={() => speakText(currentQ.question)} className="text-slate-400 hover:text-indigo-500 transition">
                    <Volume2 size={20} />
                  </button>
                </div>
              </div>

              <h2 className="text-xl md:text-2xl font-medium text-slate-900 dark:text-white leading-relaxed mb-8">
                {currentQ.question}
              </h2>

              <div className="grid grid-cols-1 gap-3">
                {currentQ.options.map((opt, i) => {
                  const label = String.fromCharCode(65 + i);
                  const isSelected = selectedAnswer === opt;
                  const isAnswer = opt === currentQ.answer;

                  let style = "border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800";
                  if (showResult) {
                    if (isAnswer) style = "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300";
                    else if (isSelected) style = "border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300";
                    else style = "border-slate-100 dark:border-slate-800 opacity-50";
                  } else if (isSelected) {
                    style = "border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-600";
                  }

                  return (
                    <motion.button
                      key={i}
                      disabled={showResult}
                      onClick={() => setSelectedAnswer(opt)}
                      whileHover={!showResult ? { scale: 1.01 } : {}}
                      whileTap={!showResult ? { scale: 0.99 } : {}}
                      className={`flex items-center p-4 rounded-xl border-2 text-left transition-all ${style}`}
                    >
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mr-4 ${showResult && isAnswer ? "bg-emerald-500 text-white" :
                        showResult && isSelected ? "bg-red-500 text-white" :
                          isSelected ? "bg-indigo-600 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                        }`}>
                        {label}
                      </span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">{opt}</span>
                      {showResult && isAnswer && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="ml-auto"
                        >
                          <CheckCircle className="text-emerald-600 dark:text-emerald-400" size={20} />
                        </motion.div>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* アクションボタン */}
          <div className="mt-6">
            {showResult ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 mb-6">
                  <div className="flex items-center gap-2 mb-2 font-bold text-slate-900 dark:text-white">
                    <BookOpen size={18} className="text-indigo-500" />
                    解説
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-2">{currentQ.explanation}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-2 mt-2">訳: {currentQ.translation}</p>
                  {currentQ.synonyms && currentQ.synonyms.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span className="text-xs font-semibold text-purple-600">類義語:</span>
                      {currentQ.synonyms.map((s, i) => (
                        <span key={i} className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full border border-purple-200">
                          {s.trim()}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex justify-end mt-4">
                    <ReportButton wordId={currentQ.id} wordText={currentQ.question} userId={userId} compact />
                  </div>
                </div>
                <motion.button
                  onClick={nextQuestion}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white py-4 rounded-xl font-bold hover:opacity-90 transition shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30 flex items-center justify-center gap-2"
                >
                  {currentIndex + 1 < questions.length ? (
                    <>次の問題へ <ChevronRight size={20} /></>
                  ) : (
                    <>結果を見る <Star size={20} /></>
                  )}
                </motion.button>
              </motion.div>
            ) : (
              <motion.button
                onClick={submitAnswer}
                disabled={!selectedAnswer}
                whileHover={selectedAnswer ? { scale: 1.01 } : {}}
                whileTap={selectedAnswer ? { scale: 0.99 } : {}}
                className="w-full bg-gradient-to-r from-slate-900 to-slate-800 dark:from-white dark:to-slate-200 text-white dark:text-slate-900 py-4 rounded-xl font-bold hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition shadow-lg"
              >
                回答する
              </motion.button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (fetching) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full mb-4"
        />
        <p className="text-slate-500 dark:text-slate-400 font-medium">最適な問題をセレクト中...</p>
      </div>
    );
  }

  // =============================
  // トップ画面（モード選択）
  // =============================
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 md:p-10">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10 text-center md:text-left"
        >
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-2 flex items-center gap-3 justify-center md:justify-start">
            <Sparkles className="w-8 h-8 text-indigo-500" />
            TOEIC 問題バンク
          </h1>
          <p className="text-slate-500 dark:text-slate-400">あなたの現在のレベルと苦手に合わせて、最適な問題を出題します。</p>
        </motion.div>

        {/* 弱点アラート */}
        {weaknesses.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800 rounded-2xl p-6 mb-10 flex flex-col md:flex-row items-start md:items-center gap-6"
          >
            <div className="bg-orange-100 dark:bg-orange-900/40 p-3 rounded-xl text-orange-600">
              <AlertTriangle size={24} />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">弱点カテゴリが見つかりました</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                最近の学習データから、以下の分野の正解率が低くなっています。重点的に復習しましょう。
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {weaknesses.slice(0, 3).map((w) => (
                <span key={w.categoryId} className="px-3 py-1 bg-white dark:bg-slate-800 border border-orange-200 dark:border-orange-700 text-orange-700 dark:text-orange-300 rounded-full text-sm font-medium shadow-sm">
                  {w.categoryName} ({Math.round(w.correctRate * 100)}%)
                </span>
              ))}
            </div>
          </motion.div>
        )}

        {/* エラーメッセージ */}
        {noQuestionsMsg && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-6 mb-10 flex items-start gap-4"
          >
            <div className="bg-red-100 dark:bg-red-900/40 p-3 rounded-xl text-red-600">
              <AlertTriangle size={24} />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-red-800 dark:text-red-300 mb-1">問題が見つかりません</h3>
              <p className="text-red-600 dark:text-red-400 text-sm">{noQuestionsMsg}</p>
            </div>
            <button
              onClick={() => setNoQuestionsMsg(null)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              ✕
            </button>
          </motion.div>
        )}

        <motion.h2
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2"
        >
          <Target className="text-indigo-500" />
          学習モードを選択
        </motion.h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <ModeCard
            title="クイック挑戦"
            desc="5問 / 約2分。隙間時間に最適。"
            icon={Zap}
            color="bg-yellow-500"
            onClick={() => startSession("quick")}
          />
          <ModeCard
            title="集中特訓"
            desc="20問。本番形式でしっかりと。"
            icon={Clock}
            color="bg-blue-600"
            onClick={() => startSession("focus")}
          />
          <ModeCard
            title="弱点克服"
            desc="苦手なカテゴリを重点的に。"
            icon={TrendingUp}
            color="bg-red-500"
            onClick={() => startSession("weakness")}
          />
          <ModeCard
            title="総復習"
            desc="過去に間違えた問題を再挑戦。"
            icon={RotateCcw}
            color="bg-green-600"
            onClick={() => startSession("review")}
          />
        </div>
      </div>
    </div>
  );
}
