"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { initVoices, speakText } from "@/lib/speech";
import { getImportanceClasses, getPartOfSpeechClasses, getJSTDateString, getJSTYesterday, parseImportance, importanceToStars, isWeakWord } from "@/lib/utils";
import { useRouter } from "next/navigation";
import Confetti from "react-confetti";
import { motion, AnimatePresence } from "framer-motion";
import {
  Flame,
  Target,
  Trophy,
  Zap,
  Volume2,
  Check,
  X,
  SkipForward,
  ArrowRight,
  Sparkles,
  RotateCcw,
  Star,
} from "lucide-react";
import { updateUserStats } from "@/app/actions/updateStats";
import ReportButton from "@/components/ReportButton";

// =============================
// 型定義
// =============================
type WordMaster = {
  id: string;
  word: string;
  part_of_speech: string;
  meaning: string;
  example_sentence: string;
  translation: string;
  importance: string;
  registered_at: string;
  synonyms?: string;
};

type UserWord = {
  id: string;
  user_id: string;
  word_id: string;
  registered_at: string;
  words_master: WordMaster;
  total?: number;
  correct?: number;
  wrong?: number;
  successRate?: number;
  lastAnswered?: string;
};

type Stats = {
  yesterday: number;
  today: number;
  avg30: number;
  firstTarget: number;
  secondTarget: number;
  phase: "phase1" | "phase2" | "finished";
};

type SessionResult = {
  totalAnswered: number;
  correctCount: number;
  wrongCount: number;
  maxStreak: number;
  xpEarned: number;
};

// =============================
// 円形プログレスリング
// =============================
const ProgressRing = ({
  progress,
  size = 100,
  strokeWidth = 8,
  children,
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
  children?: React.ReactNode;
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (Math.min(progress, 1) * circumference);

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="none"
          className="stroke-[var(--border)]"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          className="stroke-[var(--accent)]"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          style={{ strokeDasharray: circumference }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
};

// =============================
// XPフローティングエフェクト
// =============================
const XpPopup = ({ xp, visible }: { xp: number; visible: boolean }) => (
  <AnimatePresence>
    {visible && (
      <motion.div
        initial={{ opacity: 0, y: 0, scale: 0.5 }}
        animate={{ opacity: 1, y: -40, scale: 1 }}
        exit={{ opacity: 0, y: -80, scale: 0.8 }}
        transition={{ duration: 0.8 }}
        className="absolute top-0 right-4 z-30 pointer-events-none"
      >
        <div className="flex items-center gap-1 bg-[var(--accent)] text-[var(--accent-foreground)] px-2.5 py-1 rounded-md text-[12px] font-bold">
          <Zap className="w-4 h-4" />
          +{xp} XP
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);

// =============================
// メインページ
// =============================
export default function ReviewPage() {
  const [words, setWords] = useState<UserWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [confettiTrigger, setConfettiTrigger] = useState(false);
  const [showPhaseModal, setShowPhaseModal] = useState<Stats["phase"] | null>(null);

  // Motivation states
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [xpPopup, setXpPopup] = useState<{ visible: boolean; amount: number }>({ visible: false, amount: 0 });
  const [sessionResult, setSessionResult] = useState<SessionResult | null>(null);
  const [sessionXp, setSessionXp] = useState(0);
  const [slideDirection, setSlideDirection] = useState(1);
  const [isAnswering, setIsAnswering] = useState(false);
  const [lastAnswer, setLastAnswer] = useState<boolean | null>(null);

  const [quizPhase, setQuizPhase] = useState<"quiz" | "result">("quiz");
  const [posChoices, setPosChoices] = useState<string[]>([]);
  const [selectedPos, setSelectedPos] = useState<string | null>(null);
  const [posCorrect, setPosCorrect] = useState<boolean | null>(null);

  const [isGuestMode, setIsGuestMode] = useState(false);
  const [autoPlay, setAutoPlay] = useState(true);
  const [examAutoPlay, setExamAutoPlay] = useState(false);

  useEffect(() => {
    const savedAutoPlay = localStorage.getItem("wordAutoPlay");
    if (savedAutoPlay !== null) setAutoPlay(savedAutoPlay === "true");
    
    const savedExamAutoPlay = localStorage.getItem("examAutoPlay");
    if (savedExamAutoPlay !== null) setExamAutoPlay(savedExamAutoPlay === "true");
  }, []);

  const toggleAutoPlay = () => {
    setAutoPlay(prev => {
      const next = !prev;
      localStorage.setItem("wordAutoPlay", String(next));
      return next;
    });
  };

  const toggleExamAutoPlay = () => {
    setExamAutoPlay(prev => {
      const next = !prev;
      localStorage.setItem("examAutoPlay", String(next));
      return next;
    });
  };

  const autoPlayRef = useRef(autoPlay);
  const examAutoPlayRef = useRef(examAutoPlay);
  
  useEffect(() => { autoPlayRef.current = autoPlay; }, [autoPlay]);
  useEffect(() => { examAutoPlayRef.current = examAutoPlay; }, [examAutoPlay]);

  useEffect(() => {
    // 問題が表示された時に自動再生
    if (words.length > 0 && words[currentIndex] && quizPhase === "quiz") {
      // わずかな遅延を入れて読み上げ（画面切り替え時のかぶり防止）
      const timer = setTimeout(() => {
        const textToSpeech = [];
        if (autoPlayRef.current) textToSpeech.push(words[currentIndex].words_master.word);
        if (examAutoPlayRef.current) textToSpeech.push(words[currentIndex].words_master.example_sentence);
        
        if (textToSpeech.length > 0) {
          speakText(textToSpeech.join(". "));
        }
      }, 300);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, quizPhase, words]);

  const getWordStatus = (total: number, correct: number, successRate: number) => {
    if (total === 0) return null;
    if (total >= 5 && successRate <= 0.4) {
      return { label: "🔴 苦手", classes: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20" };
    }
    if (correct >= 5 && successRate >= 0.8) {
      return { label: "✨ ほぼ覚えた", classes: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" };
    }
    return { label: "🌱 覚えかけ", classes: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" };
  };



  const router = useRouter();

  /** Fisher–Yates shuffle */
  const shuffleArray = <T,>(array: T[]): T[] => {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  /** ログイン確認 */
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        if (localStorage.getItem("guestMode") === "true") {
          // ゲストモード
          setIsGuestMode(true);
          await initVoices();
          setLoading(false);
          return;
        }
        router.replace("/auth/login");
        return;
      }
      setUserId(data.session.user.id);
      await initVoices();
      setLoading(false);
    })();
  }, [router]);

  const computeTargets = (yesterdayCount: number, avg30: number) => {
    const values = [yesterdayCount, Math.ceil(avg30)];
    const firstTarget = Math.min(...values);
    const secondTarget = Math.max(...values, 20);
    return { firstTarget, secondTarget };
  };

  const fetchDailyStats = async (uid: string) => {
    const { data, error } = await supabase.rpc("get_user_word_progress", { uid });
    if (error) {
      console.error("RPC error:", error);
      return { yesterday: 0, today: 0, avg30: 0 };
    }

    const rows = (data as { date: string; daily_correct: number }[]) ?? [];
    if (rows.length === 0) return { yesterday: 0, today: 0, avg30: 0 };

    const todayStr = getJSTDateString();
    const todayCount = rows.find((r) => r.date === todayStr)?.daily_correct ?? 0;

    const yesterdayStr = getJSTYesterday();

    let yesterday = rows.find((r) => r.date === yesterdayStr)?.daily_correct;
    if (yesterday === undefined) {
      const prevRow = [...rows]
        .filter((r) => r.date < todayStr)
        .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
      yesterday = prevRow?.daily_correct ?? 0;
    }

    const last30 = rows.slice(-30);
    const avg30 = last30.reduce((sum, r) => sum + r.daily_correct, 0) / last30.length;

    return { yesterday, today: todayCount, avg30 };
  };

  const fetchStats = async (uid: string) => {
    const { yesterday, today, avg30 } = await fetchDailyStats(uid);
    const { firstTarget, secondTarget } = computeTargets(yesterday, avg30);

    let phase: Stats["phase"] = "phase1";
    if (today >= firstTarget && today < secondTarget) phase = "phase2";
    if (today >= secondTarget) phase = "finished";

    setStats({ yesterday, today, avg30, firstTarget, secondTarget, phase });
  };

  /** 単語取得 */
  useEffect(() => {
    const fetchGuestWords = async (): Promise<void> => {
      try {
        setLoading(true);
        setError(null);
        // 重要度5の単語を多めに取得してシャッフル
        const { data, error } = await supabase
          .from("words_master")
          .select<string, WordMaster>("*")
          .eq("importance", "5")
          .limit(100);

        if (error) throw error;

        if (!data || data.length === 0) {
          setWords([]);
          return;
        }

        const guestWords: UserWord[] = shuffleArray(data).slice(0, 10).map((item: WordMaster) => ({
          id: `guest-${item.id}`,
          user_id: "guest",
          word_id: item.id,
          registered_at: new Date().toISOString(),
          words_master: item,
          total: 0,
          correct: 0,
          wrong: 0,
          successRate: 0,
          lastAnswered: new Date().toISOString(),
        }));

        setWords(guestWords);
      } catch (err) {
        console.error(err);
        setError("体験版データの取得中にエラーが発生しました。");
      } finally {
        setLoading(false);
      }
    };

    const fetchUserWords = async (): Promise<void> => {
      if (!userId) return;
      try {
        setLoading(true);
        setError(null);

        const { data, error } = await supabase.rpc("get_user_word_stats", { p_user_id: userId });
        if (error) throw error;

        interface UserWordStatsRPC {
          user_word_id: string;
          word_id: string;
          registered_at: string;
          word: string;
          part_of_speech: string;
          meaning: string;
          example_sentence: string;
          translation: string;
          importance: string;
          total: number;
          correct: number;
          wrong: number;
          success_rate: number;
          last_answered: string;
          synonyms: string | null;
        }

        const userWords: UserWord[] = (data ?? []).map((item: UserWordStatsRPC) => ({
          id: String(item.user_word_id),
          user_id: userId,
          word_id: String(item.word_id),
          registered_at: String(item.registered_at),
          total: item.total,
          correct: item.correct,
          wrong: item.wrong,
          successRate: item.success_rate,
          lastAnswered: item.last_answered,
          words_master: {
            id: String(item.word_id),
            word: item.word,
            part_of_speech: item.part_of_speech,
            meaning: item.meaning,
            example_sentence: item.example_sentence,
            translation: item.translation,
            importance: item.importance,
            registered_at: String(item.registered_at),
            synonyms: item.synonyms ?? "",
          },
        }));

        const today = new Date();
        const reviewWords = userWords.filter((w) => {
          const lastReview = new Date(w.lastAnswered!);
          const diffDays = Math.floor((today.getTime() - lastReview.getTime()) / (1000 * 60 * 60 * 24));
          const schedule: Record<number, number> = { 0: 0, 1: 1, 2: 3, 3: 7, 4: 14, 5: 30 };
          const cappedCount = Math.min(w.correct ?? 0, 5);
          let nextReview = schedule[cappedCount];

          const isFullyMemorized = (w.correct ?? 0) >= 6 && w.successRate! >= 0.9;
          if (isFullyMemorized) return false;

          if ((w.correct ?? 0) >= 6 && w.successRate! < 0.9) {
            if (w.successRate! < 0.3) nextReview = 3;
            else if (w.successRate! < 0.5) nextReview = 7;
            else if (w.successRate! < 0.7) nextReview = 14;
            else nextReview = 21;
          }

          return diffDays >= nextReview;
        });

        const rank = (imp: string) => parseImportance(imp);
        const grouped: Record<number, UserWord[]> = {};
        reviewWords.forEach((w) => {
          const r = rank(w.words_master.importance);
          if (!grouped[r]) grouped[r] = [];
          grouped[r].push(w);
        });

        const result: UserWord[] = [];
        [5, 4, 3, 2, 1].forEach((r) => {
          if (grouped[r]) result.push(...shuffleArray(grouped[r]));
        });

        setWords(result);
      } catch (err) {
        console.error(err);
        setError("データ取得中にエラーが発生しました。");
      } finally {
        setLoading(false);
        if (userId) await fetchStats(userId);
      }
    };

    if (isGuestMode) {
      fetchGuestWords();
    } else if (userId) {
      fetchUserWords();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, isGuestMode]);

  /** 回答処理 */
  const handleAnswer = useCallback(async (isOk: boolean): Promise<void> => {
    try {
      if (sessionResult || isAnswering) return;

      // --- Guest Mode Logic ---
      if (isGuestMode) {
        setIsAnswering(true);
        setLastAnswer(isOk);

        if (isOk) {
          const newStreak = streak + 1;
          setStreak(newStreak);
          if (newStreak > maxStreak) setMaxStreak(newStreak);
          if (newStreak >= 3 && newStreak % 3 === 0) {
            setConfettiTrigger(true);
            setTimeout(() => setConfettiTrigger(false), 4000);
          }
        } else {
          setStreak(0);
        }

        if (currentIndex + 1 < words.length) {
          setTimeout(() => {
            setSlideDirection(1);
            setCurrentIndex((prev) => prev + 1);
            setShowAnswer(false);
            setIsAnswering(false);
            setLastAnswer(null);
            setQuizPhase("quiz");
            setSelectedPos(null);
            setPosCorrect(null);
          }, 150);
        } else {
          setTimeout(() => {
            setSessionResult({
              totalAnswered: currentIndex + 1,
              correctCount: 0, // Not tracked for guests
              wrongCount: 0,   // Not tracked for guests
              maxStreak: isOk ? Math.max(maxStreak, streak + 1) : maxStreak,
              xpEarned: 0,     // No XP for guests
            });
            setIsAnswering(false);
            setLastAnswer(null);
          }, 150);
        }
        return;
      }

      // --- Registered User Logic ---
      if (!userId) return;

      setIsAnswering(true);
      setLastAnswer(isOk);
      const now = new Date().toISOString();

      await supabase.from("user_word_history").insert({
        user_word_id: words[currentIndex].id,
        user_id: userId,
        is_correct: isOk,
        answered_at: now,
      });

      // XP計算
      const xpGained = isOk ? 5 : 1;
      await updateUserStats(userId, xpGained, 1);

      // XPポップアップ
      setXpPopup({ visible: true, amount: xpGained });
      setTimeout(() => setXpPopup({ visible: false, amount: 0 }), 1200);
      setSessionXp((prev) => prev + xpGained);

      // ストリーク
      if (isOk) {
        const newStreak = streak + 1;
        setStreak(newStreak);
        if (newStreak > maxStreak) setMaxStreak(newStreak);

        // 3問以上連続正解でコンフェティ
        if (newStreak >= 3 && newStreak % 3 === 0) {
          setConfettiTrigger(true);
          setTimeout(() => setConfettiTrigger(false), 4000);
        }
      } else {
        setStreak(0);
      }

      // フェーズ更新
      if (stats) {
        const updatedToday = isOk ? stats.today + 1 : stats.today;
        let updatedPhase: Stats["phase"] = "phase1";
        if (updatedToday >= stats.firstTarget && updatedToday < stats.secondTarget) updatedPhase = "phase2";
        if (updatedToday >= stats.secondTarget) updatedPhase = "finished";

        if (updatedPhase !== stats.phase) {
          setConfettiTrigger(true);
          setTimeout(() => setConfettiTrigger(false), 10000);
          setShowPhaseModal(updatedPhase);
        }

        setStats({ ...stats, today: updatedToday, phase: updatedPhase });
      }

      // 次へ or 完了
      if (currentIndex + 1 < words.length) {
        setTimeout(() => {
          setSlideDirection(1);
          setCurrentIndex((prev) => prev + 1);
          setShowAnswer(false);
          setIsAnswering(false);
          setLastAnswer(null);
          // クイズリセット
          setQuizPhase("quiz");
          setSelectedPos(null);
          setPosCorrect(null);
        }, 150);
      } else {
        // セッション完了
        setTimeout(() => {
          setSessionResult({
            totalAnswered: currentIndex + 1,
            correctCount: stats ? stats.today + (isOk ? 1 : 0) : 0,
            wrongCount: 0,
            maxStreak: isOk ? Math.max(maxStreak, streak + 1) : maxStreak,
            xpEarned: sessionXp + xpGained,
          });
          setIsAnswering(false);
          setLastAnswer(null);
        }, 150);
      }
    } catch (err) {
      console.error(err);
    }
  }, [userId, words, currentIndex, stats, streak, maxStreak, sessionXp, sessionResult, isAnswering, isGuestMode]);

  /** スキップ（末尾に回す） */
  const handleSkip = useCallback(() => {
    if (sessionResult) return;
    const skippedWord = words[currentIndex];
    const newWords = [...words];
    newWords.splice(currentIndex, 1);
    newWords.push(skippedWord);
    setWords(newWords);
    setShowAnswer(false);
    setSlideDirection(1);
  }, [words, currentIndex, sessionResult]);

  const ALL_POS = ["名詞", "動詞", "形容詞", "副詞", "接続詞", "前置詞"];

  /** 品詞クイズの選択肢を生成 */
  const generatePosChoices = useCallback((correctPos: string) => {
    const others = ALL_POS.filter((p) => p !== correctPos);
    // シャッフルしてダミー3つ取得
    for (let i = others.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [others[i], others[j]] = [others[j], others[i]];
    }
    const choices = [correctPos, ...others.slice(0, 3)];
    // シャッフル
    for (let i = choices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [choices[i], choices[j]] = [choices[j], choices[i]];
    }
    return choices;
  }, []);

  /** 品詞選択ハンドラ */
  const handlePosSelect = useCallback((pos: string) => {
    if (selectedPos !== null || !words[currentIndex]) return;
    const correct = pos === words[currentIndex].words_master.part_of_speech;
    setSelectedPos(pos);
    setPosCorrect(correct);
    setShowAnswer(true);
    setQuizPhase("result");
  }, [selectedPos, words, currentIndex, handleAnswer]);

  /** 新しい単語が表示されたら選択肢を生成 */
  useEffect(() => {
    if (words[currentIndex] && quizPhase === "quiz") {
      const pc = generatePosChoices(words[currentIndex].words_master.part_of_speech);
      setPosChoices(pc);
    }
  }, [currentIndex, words, quizPhase, generatePosChoices]);

  /** キーボードショートカット */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (sessionResult) return;
      // クイズフェーズ: 1-4キーで品詞選択
      if (quizPhase === "quiz" && posChoices.length > 0) {
        const num = parseInt(e.key);
        if (num >= 1 && num <= posChoices.length) {
          e.preventDefault();
          handlePosSelect(posChoices[num - 1]);
        }
      }
      // 結果フェーズ: OK/NG
      if (quizPhase === "result" && showAnswer) {
        if (posCorrect && (e.key === "ArrowRight" || e.key === "o")) {
          e.preventDefault();
          handleAnswer(true);
        }
        if (e.key === "ArrowLeft" || e.key === "x") {
          e.preventDefault();
          handleAnswer(false);
        }
      }
      if (e.key === "s") {
        e.preventDefault();
        handleSkip();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showAnswer, handleAnswer, handleSkip, handlePosSelect, sessionResult, quizPhase, posChoices, posCorrect]);

  // =============================
  // ローディング画面
  // =============================
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full mb-4"
        />
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-slate-500 dark:text-slate-400 font-medium"
        >
          復習の準備中...
        </motion.p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-xl text-center max-w-md w-full border border-red-100 dark:border-red-900"
        >
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8 text-red-500" />
          </div>
          <p className="text-red-600 dark:text-red-400 font-medium">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 px-6 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold hover:opacity-80 transition"
          >
            再読み込み
          </button>
        </motion.div>
      </div>
    );
  }

  // =============================
  // 復習対象なし
  // =============================
  if (words.length === 0 && !sessionResult) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-slate-900 rounded-3xl p-10 shadow-xl text-center max-w-md w-full border border-slate-200 dark:border-slate-800"
        >
          <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <Trophy className="w-10 h-10 text-emerald-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            復習完了！
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mb-8">
            本日の復習対象はありません。
            <br />
            素晴らしい学習ペースです！
          </p>
          <button
            onClick={() => router.push("/")}
            className="w-full px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-bold hover:opacity-90 transition shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30"
          >
            ダッシュボードに戻る
          </button>
        </motion.div>
      </div>
    );
  }

  // =============================
  // セッション完了画面
  // =============================
  if (sessionResult) {
    const accuracy = sessionResult.totalAnswered > 0
      ? Math.round((sessionResult.correctCount / sessionResult.totalAnswered) * 100)
      : 0;

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
        {accuracy >= 80 && <Confetti recycle={false} numberOfPieces={400} />}

        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", damping: 15 }}
          className="bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-2xl max-w-md w-full text-center border border-slate-200 dark:border-slate-800"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
            className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-yellow-200 dark:shadow-yellow-900/30"
          >
            <Star className="w-10 h-10 text-white fill-white" />
          </motion.div>

          <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-1">
            おつかれさまでした！
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mb-8">今回の復習結果</p>

          <div className="grid grid-cols-3 gap-3 mb-8">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-2xl"
            >
              <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                {sessionResult.totalAnswered}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">回答数</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-2xl"
            >
              <div className="flex items-center justify-center gap-1">
                <Flame className="w-5 h-5 text-orange-500" />
                <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {sessionResult.maxStreak}
                </span>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">最大連続</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-2xl"
            >
              <div className="flex items-center justify-center gap-1">
                <Zap className="w-5 h-5 text-yellow-500" />
                <span className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {sessionResult.xpEarned}
                </span>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">獲得 XP</div>
            </motion.div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => window.location.reload()}
              className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              もう一回
            </button>
            <button
              onClick={() => router.push("/")}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-bold hover:opacity-90 transition shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30 flex items-center justify-center gap-2"
            >
              ダッシュボード
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // =============================
  // メイン復習画面
  // =============================
  const current = words[currentIndex];
  const m = current.words_master;
  const totalProgress = words.length > 0 ? (currentIndex + 1) / words.length : 0;
  const targetProgress = stats
    ? stats.phase === "phase1"
      ? stats.today / Math.max(stats.firstTarget, 1)
      : stats.phase === "phase2"
        ? stats.today / Math.max(stats.secondTarget, 1)
        : 1
    : 0;

  const currentWordStatus = current ? getWordStatus(current.total ?? 0, current.correct ?? 0, current.successRate ?? 0) : null;

  return (
    <div className="min-h-screen bg-[var(--background)] pb-20 relative">
      {confettiTrigger && typeof window !== "undefined" && (
        <Confetti width={window.innerWidth} height={window.innerHeight} />
      )}

      {/* フェーズ達成モーダル */}
      <AnimatePresence>
        {showPhaseModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={() => setShowPhaseModal(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.5, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 20 }}
              transition={{ type: "spring", damping: 15 }}
              className="bg-[var(--card)] rounded-xl p-8 text-center max-w-sm mx-4 border border-[var(--border)]"
              onClick={(e) => e.stopPropagation()}
            >
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.2, type: "spring" }}
                className={`w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-5 ${showPhaseModal === "phase2"
                  ? "bg-emerald-500/10"
                  : "bg-[var(--accent)]/10"
                  }`}
              >
                {showPhaseModal === "phase2" ? (
                  <Target className="w-7 h-7 text-emerald-500" />
                ) : (
                  <Trophy className="w-7 h-7 text-[var(--accent)]" />
                )}
              </motion.div>

              <h2 className="text-xl font-bold text-[var(--foreground)] mb-1">
                {showPhaseModal === "phase2" ? "第一目標達成！" : "第二目標達成！ 🎉"}
              </h2>
              <p className="text-[var(--muted-foreground)] text-sm mb-5 leading-relaxed">
                {showPhaseModal === "phase2"
                  ? "今日の目標をクリアしました！\nさらに上を目指しましょう！"
                  : "今日の復習をすべてクリア！\n素晴らしい成果です！"}
              </p>
              <button
                onClick={() => setShowPhaseModal(null)}
                className="w-full bg-[var(--primary)] text-[var(--primary-foreground)] font-semibold py-2.5 px-6 rounded-lg hover:opacity-90 transition text-sm"
              >
                続ける
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-xl mx-auto px-4 pt-6">
        {isGuestMode && (
          <div className="mb-4 bg-amber-500/8 border border-amber-500/20 text-amber-700 dark:text-amber-300 p-3.5 rounded-xl" role="alert">
            <p className="font-bold text-[13px]">ゲストモード（体験版）</p>
            <p className="text-[12px] mt-0.5">最重要単語からランダムで10問が出題されます。全ての機能を利用するにはアカウント登録を行ってください。</p>
          </div>
        )}
        {/* ヘッダー */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-5"
        >
          <button
            onClick={() => router.push("/")}
            className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-sm font-medium transition"
          >
            ← 戻る
          </button>
          <h1 className="text-lg font-bold text-[var(--foreground)] flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[var(--accent)]" />
            復習テスト
          </h1>
          <div className="w-12" /> {/* spacer */}
        </motion.div>

        {/* ステータスバー */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex items-center gap-4 mb-5"
        >
          {/* プログレスリング */}
          <ProgressRing progress={totalProgress} size={72} strokeWidth={6}>
            <div className="text-center">
              <div className="text-sm font-bold text-[var(--foreground)]">
                {currentIndex + 1}
              </div>
              <div className="text-[10px] text-[var(--muted-foreground)]">/{words.length}</div>
            </div>
          </ProgressRing>

          {/* ステータス情報 */}
          <div className="flex-1 space-y-2">
            {/* ストリーク */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-orange-500/10 px-2 py-1 rounded-md border border-orange-500/20">
                <Flame className={`w-3.5 h-3.5 ${streak >= 3 ? "text-orange-500 fill-orange-500" : "text-orange-300"}`} />
                <span className="text-[11px] font-bold text-orange-600 dark:text-orange-400">
                  {streak > 0 ? `${streak} 連続！` : "0"}
                </span>
              </div>
              {streak >= 3 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="text-[11px] font-bold text-orange-500"
                >
                  🔥 すごい！
                </motion.span>
              )}
            </div>

            {/* 目標プログレスバー */}
            {stats && (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-medium text-[var(--muted-foreground)]">
                    {stats.phase === "phase1" && "第一目標"}
                    {stats.phase === "phase2" && "第二目標"}
                    {stats.phase === "finished" && "目標達成！"}
                  </span>
                  <span className="text-[10px] font-bold text-[var(--muted-foreground)]">
                    {stats.today} / {stats.phase === "phase1" ? stats.firstTarget : stats.secondTarget}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-[var(--secondary)] rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${stats.phase === "finished"
                      ? "bg-emerald-500"
                      : stats.phase === "phase2"
                        ? "bg-emerald-500"
                        : "bg-[var(--accent)]"
                      }`}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(targetProgress * 100, 100)}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* セッションXP */}
          <div className="text-center bg-[var(--accent)]/8 px-3 py-2 rounded-lg border border-[var(--accent)]/20">
            <div className="flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span className="text-sm font-bold text-[var(--accent)]">{sessionXp}</span>
            </div>
            <div className="text-[10px] text-[var(--muted-foreground)]">XP</div>
          </div>
        </motion.div>

        {/* メインカード */}
        <div className="relative">
          <XpPopup xp={xpPopup.amount} visible={xpPopup.visible} />

          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, x: slideDirection * 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -slideDirection * 50 }}
              transition={{ duration: 0.3 }}
              className={`bg-[var(--card)] rounded-xl p-5 md:p-6 border ${isWeakWord(current.total ?? 0, current.successRate ?? 1) ? "border-red-500/30 ring-1 ring-red-500/10" : "border-[var(--border)]"}`}
            >
              {/* 単語ヘッダー */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-xl md:text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {m.word}
                  </h2>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => speakText(m.word)}
                      className="p-1.5 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20 transition"
                      title="音声を再生"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={toggleAutoPlay}
                      className={`p-1.5 rounded-lg transition text-[10px] font-bold border ${autoPlay ? 'bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]/30' : 'bg-[var(--secondary)] text-[var(--muted-foreground)] border-[var(--border)]'}`}
                      title="自動再生切り替え"
                    >
                      {autoPlay ? "自動再生: ON" : "自動再生: OFF"}
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${getImportanceClasses(m.importance)}`}>
                    {importanceToStars(m.importance)}
                  </span>
                  {currentWordStatus && (
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${currentWordStatus.classes}`}>
                      {currentWordStatus.label}
                    </span>
                  )}
                </div>
              </div>

              {/* 例文 */}
              <div className="flex items-center justify-between bg-[var(--secondary)] p-3.5 rounded-lg mb-4">
                <p className="text-[16px] text-[var(--foreground)] leading-relaxed flex-1">
                  {m.example_sentence}
                </p>
                <div className="flex items-center gap-1 ml-3">
                  <button
                    onClick={() => speakText(m.example_sentence)}
                    className="p-1.5 rounded-lg bg-[var(--card)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition border border-[var(--border)]"
                    title="音声を再生"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={toggleExamAutoPlay}
                    className={`p-1.5 rounded-lg transition text-[10px] font-bold border ${examAutoPlay ? 'bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]/30' : 'bg-[var(--secondary)] text-[var(--muted-foreground)] border-[var(--border)]'}`}
                    title="例文の自動再生切り替え"
                  >
                    {examAutoPlay ? "自動再生: ON" : "自動再生: OFF"}
                  </button>
                </div>
              </div>

              {/* 品詞クイズ or 結果表示 */}
              <AnimatePresence mode="wait">
                {quizPhase === "quiz" ? (
                  <motion.div
                    key="quiz-phase"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-3"
                  >
                    <p className="text-center text-sm font-bold text-[var(--foreground)] mb-2">
                      この単語の品詞は？
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {posChoices.map((pos, idx) => (
                        <motion.button
                          key={pos}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handlePosSelect(pos)}
                          disabled={selectedPos !== null}
                          className={`py-2.5 px-4 rounded-lg font-bold text-sm transition flex items-center justify-center gap-2 ${selectedPos === pos
                            ? pos === m.part_of_speech
                              ? "bg-emerald-500 text-white"
                              : "bg-red-500 text-white"
                            : selectedPos !== null
                              ? pos === m.part_of_speech
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                                : "bg-[var(--secondary)] text-[var(--muted-foreground)] border border-[var(--border)]"
                              : "bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--secondary)] border border-[var(--border)]"
                            }`}
                        >
                          <span className="text-[11px] text-[var(--muted-foreground)] font-mono w-4">{idx + 1}</span>
                          {pos}
                        </motion.button>
                      ))}
                    </div>
                    <button
                      onClick={handleSkip}
                      className="w-full py-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-sm font-medium transition flex items-center justify-center gap-2"
                    >
                      <SkipForward className="w-4 h-4" />
                      あとで復習する
                    </button>
                    <p className="text-center text-[10px] text-[var(--muted-foreground)] opacity-50">
                      1〜4 で選択 • S でスキップ
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="result-phase"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4 }}
                    className="space-y-4"
                  >
                    {/* 品詞クイズ結果バナー */}
                    <motion.div
                      initial={{ scale: 0.9 }}
                      animate={{ scale: 1 }}
                      className={`p-3 rounded-lg text-center font-bold text-sm border ${posCorrect
                        ? "bg-emerald-500/8 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                        : "bg-red-500/8 text-red-700 dark:text-red-300 border-red-500/20"
                        }`}
                    >
                      {posCorrect ? (
                        <span>✅ 正解！品詞は「{m.part_of_speech}」です</span>
                      ) : (
                        <span>❌ 不正解… 正しくは「{m.part_of_speech}」です</span>
                      )}
                    </motion.div>

                    {/* 回答詳細 */}
                    <div className="bg-[var(--secondary)] p-4 rounded-lg space-y-2.5 border border-[var(--border)]">
                      <p className="text-base font-bold text-[var(--foreground)]">
                        {m.meaning}
                      </p>
                      <p className="text-[13px] text-[var(--muted-foreground)]">
                        訳: {m.translation}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getPartOfSpeechClasses(m.part_of_speech)}`}>
                          {m.part_of_speech}
                        </span>
                      </div>
                      {m.synonyms && (
                        <div className="flex items-center gap-1.5 flex-wrap mt-1">
                          <span className="text-[11px] font-semibold text-[var(--accent)]">類義語:</span>
                          {m.synonyms.split(",").map((s: string, i: number) => (
                            <span key={i} className="text-[11px] bg-[var(--accent)]/10 text-[var(--accent)] px-2 py-0.5 rounded border border-[var(--accent)]/20">
                              {s.trim()}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-4 text-[11px] text-[var(--muted-foreground)] pt-2 border-t border-[var(--border)]">
                        <span>
                          正解: <strong className="text-emerald-600 dark:text-emerald-400">{current.correct ?? 0}</strong> 回
                        </span>
                        <span>
                          誤答: <strong className="text-red-500">{current.wrong ?? 0}</strong> 回
                        </span>
                        <span>
                          正解率:{" "}
                          <strong
                            className={
                              (current.successRate ?? 0) >= 0.8
                                ? "text-emerald-600 dark:text-emerald-400"
                                : (current.successRate ?? 0) >= 0.5
                                  ? "text-[var(--accent)]"
                                  : "text-red-500"
                            }
                          >
                            {((current.successRate ?? 0) * 100).toFixed(0)}%
                          </strong>
                        </span>
                      </div>
                      {isWeakWord(current.total ?? 0, current.successRate ?? 1) && (
                        <div className="mt-2 p-2 rounded-lg bg-red-500/8 border border-red-500/20">
                          <p className="text-[11px] font-bold text-red-600 dark:text-red-400 flex items-center gap-1">
                            ⚠️ 苦手な単語です。繰り返し取り組みましょう！
                          </p>
                        </div>
                      )}
                    </div>

                    {/* 報告ボタン */}
                    <div className="flex justify-end">
                      <ReportButton wordId={m.id} wordText={m.word} userId={userId} compact />
                    </div>

                    {/* OK / NG ボタン */}
                    <div className="flex gap-3">
                      <motion.button
                        whileTap={{ scale: posCorrect ? 0.95 : 1 }}
                        onClick={() => { if (posCorrect) handleAnswer(true); }}
                        disabled={isAnswering || !posCorrect}
                        className={`flex-1 font-bold py-3 rounded-lg transition flex items-center justify-center gap-2 text-sm ${!posCorrect
                          ? "bg-[var(--secondary)] text-[var(--muted-foreground)] cursor-not-allowed"
                          : isAnswering && lastAnswer === true
                            ? "bg-emerald-600 text-white scale-95"
                            : isAnswering
                              ? "bg-[var(--secondary)] text-[var(--muted-foreground)] cursor-not-allowed"
                              : "bg-emerald-500 hover:bg-emerald-600 text-white"
                          }`}
                      >
                        <Check className="w-5 h-5" />
                        {!posCorrect ? "正解不可" : isAnswering && lastAnswer === true ? "✓ OK!" : "わかった"}
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleAnswer(false)}
                        disabled={isAnswering}
                        className={`flex-1 font-bold py-3 rounded-lg transition flex items-center justify-center gap-2 text-sm ${isAnswering && lastAnswer === false
                          ? "bg-red-600 text-white scale-95"
                          : isAnswering
                            ? "bg-[var(--secondary)] text-[var(--muted-foreground)] cursor-not-allowed"
                            : "bg-red-500 hover:bg-red-600 text-white"
                          }`}
                      >
                        <X className="w-5 h-5" />
                        {isAnswering && lastAnswer === false ? "✗ NG" : "わからない"}
                      </motion.button>
                    </div>

                    <p className="text-center text-[10px] text-[var(--muted-foreground)] opacity-50">
                      {posCorrect ? "→ わかった • ← わからない" : "← わからない"}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* 統計ブロック（下部） */}
        {stats && !isGuestMode && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-5 bg-[var(--card)] rounded-xl p-4 border border-[var(--border)]"
          >
            <h3 className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-wider mb-3">
              今日の学習状況
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <div className="text-lg font-bold text-[var(--foreground)]">{stats.today}</div>
                <div className="text-[10px] text-[var(--muted-foreground)]">今日の正解</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-[var(--foreground)]">{stats.yesterday}</div>
                <div className="text-[10px] text-[var(--muted-foreground)]">前回の正解</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-[var(--foreground)]">{stats.avg30.toFixed(1)}</div>
                <div className="text-[10px] text-[var(--muted-foreground)]">30日平均</div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}