
"use client";


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


import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { shuffleArray } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
// =============================
// 円形プログレスリング
// =============================
const ProgressRing = ({
  progress,
  size = 72,
  strokeWidth = 6,
  children,
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
  children?: React.ReactNode;
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - Math.min(progress, 1) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="none"
          className="stroke-border"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          className="stroke-accent"
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

const ALL_POS = ["名詞", "動詞", "形容詞", "副詞", "接続詞", "前置詞"];

function generatePosChoices(correctPos: string) {
  const others = ALL_POS.filter((p) => p !== correctPos);
  for (let i = others.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [others[i], others[j]] = [others[j], others[i]];
  }
  const choices = [correctPos, ...others.slice(0, 3)];
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  return choices;
}


export default function RandomPage() {
  const [words, setWords] = useState<WordMaster[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPos, setSelectedPos] = useState<string | null>(null);
  const [posChoices, setPosChoices] = useState<string[]>([]);
  const [posCorrect, setPosCorrect] = useState<boolean | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [sessionResult, setSessionResult] = useState<{total: number, correct: number, wrong: number}>();
  const [userId, setUserId] = useState<string | null>(null);
  const router = useRouter();

  // ログインユーザーID取得
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id ?? null);
    });
  }, []);

  useEffect(() => {
    if (!userId) return;
    const fetchWords = async () => {
      try {
        setLoading(true);
        // 1. すでにMY単語帳に登録されている単語IDを取得
        const { data: myWords, error: myWordsError } = await supabase
          .from("user_words")
          .select("word_id")
          .eq("user_id", userId);
        if (myWordsError) throw myWordsError;
        const myWordIds = new Set((myWords ?? []).map((w: { word_id: string }) => w.word_id));

        // 2. 全単語から未登録のものだけ抽出
        const { data: allWords, error: allWordsError } = await supabase
          .from("words_master")
          .select<string, WordMaster>("*")
          .limit(200);
        if (allWordsError) throw allWordsError;
        const notMyWords = (allWords ?? []).filter((w) => !myWordIds.has(w.id));
        const randomWords: WordMaster[] = shuffleArray(notMyWords).slice(0, 10);
        setWords(randomWords);
      } catch (err) {
        setError("データ取得中にエラーが発生しました。");
      } finally {
        setLoading(false);
      }
    };
    fetchWords();
  }, [userId]);

  useEffect(() => {
    if (words[currentIndex]) {
      setPosChoices(generatePosChoices(words[currentIndex].part_of_speech));
      setSelectedPos(null);
      setPosCorrect(null);
      setShowAnswer(false);
    }
  }, [currentIndex, words]);

  const handlePosSelect = useCallback(async (pos: string) => {
    if (!words[currentIndex] || selectedPos !== null || !userId) return;
    setSelectedPos(pos);
    const correct = pos === words[currentIndex].part_of_speech;
    setPosCorrect(correct);
    setShowAnswer(true);
    // 不正解ならAPI経由でバックグラウンド保存
    if (!correct && userId) {
      fetch("/api/save-word", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: [{
            word: words[currentIndex].word,
            part_of_speech: words[currentIndex].part_of_speech,
            meaning: words[currentIndex].meaning,
            example: words[currentIndex].example_sentence,
            translation: words[currentIndex].translation,
            importance: words[currentIndex].importance,
          }],
          userId,
        }),
      }).catch(() => {/* エラーは握りつぶす or トースト通知 */});
    }
    // 自動遷移せず、次へボタンで進む
  }, [currentIndex, selectedPos, words, userId]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
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
        単語を取得中...
      </motion.p>
    </div>
  );
  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-xl text-center max-w-md w-full border border-red-100 dark:border-red-900">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-red-500 text-3xl">×</span>
        </div>
        <p className="text-red-600 dark:text-red-400 font-medium">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-6 px-6 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold hover:opacity-80 transition"
        >
          再読み込み
        </button>
      </div>
    </div>
  );

  if (sessionResult) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
        <div className="bg-white rounded-3xl p-8 shadow-xl text-center max-w-md w-full border border-slate-200">
          <h2 className="text-2xl font-bold mb-2">テスト完了！</h2>
          <p className="mb-4">正解数: {sessionResult.correct} / {sessionResult.total}</p>
          <button
            onClick={() => router.push("/words/review")}
            className="w-full mt-3 px-4 py-3 bg-blue-600 text-white rounded-xl font-bold hover:opacity-90 transition"
          >
            復習ページへ戻る
          </button>
        </div>
      </div>
    );
  }

  const current = words[currentIndex];
  const totalProgress = words.length > 0 ? (currentIndex + 1) / words.length : 0;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <h1 className="text-lg font-bold text-[var(--foreground)] flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[var(--accent)]" />
                  新単語テスト
      </h1>
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-xl text-center max-w-md w-full border border-slate-200 dark:border-slate-800">
        {/* プログレスリング */}
        <div className="flex justify-center mb-6">
          <ProgressRing progress={totalProgress} size={72} strokeWidth={6}>
            <div className="text-center">
              <div className="text-sm font-bold text-foreground">
                {currentIndex + 1}
              </div>
              <div className="text-[10px] text-muted-foreground">/{words.length}</div>
            </div>
          </ProgressRing>
        </div>
        <div className="mb-4">
          <div className="text-2xl font-bold text-blue-600 mb-2">{current.word}</div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {posChoices.map((pos) => (
            <button
              key={pos}
              onClick={() => handlePosSelect(pos)}
              disabled={selectedPos !== null}
              className={`py-2 px-4 rounded-lg font-bold text-sm transition border
                ${selectedPos === pos
                  ? pos === current.part_of_speech
                    ? "bg-emerald-500 text-white"
                    : "bg-red-500 text-white"
                  : selectedPos !== null
                    ? pos === current.part_of_speech
                      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                      : "bg-gray-100 text-gray-400 border-gray-200"
                    : "bg-white text-gray-800 border-gray-300 hover:bg-blue-50"}
              `}
            >
              {pos}
            </button>
          ))}
        </div>
        {/* 結果表示・次へボタン */}
        {showAnswer && (
          <>
            <div className={`p-3 rounded-lg text-center font-bold text-sm border mb-2 ${posCorrect ? "bg-emerald-100 text-emerald-700 border-emerald-300" : "bg-red-100 text-red-700 border-red-300"}`}>
              {posCorrect ? (
                <span>✅ 正解！品詞は「{current.part_of_speech}」です</span>
              ) : (
                <span>❌ 不正解… 正しくは「{current.part_of_speech}」です</span>
              )}
            </div>
            <div className="text-sm text-gray-500">意味: {current.meaning}</div>
            <div className="text-sm text-gray-500">訳: {current.translation}</div>
            <div className="text-sm text-gray-500 mb-2">例文: {current.example_sentence}</div>
            {/* Nextボタン */}
            <button
              onClick={() => {
                if (currentIndex + 1 < words.length) {
                  setCurrentIndex((prev) => prev + 1);
                  setSelectedPos(null);
                  setPosCorrect(null);
                  setShowAnswer(false);
                } else {
                  setSessionResult((prev) => {
                    const total = words.length;
                    const correctCount = prev?.correct ?? 0 + (posCorrect ? 1 : 0);
                    const wrongCount = prev?.wrong ?? 0 + (!posCorrect ? 1 : 0);
                    return { total, correct: correctCount, wrong: wrongCount };
                  });
                }
              }}
              className="w-full mt-4 px-4 py-3 bg-blue-600 text-white rounded-xl font-bold hover:opacity-90 transition"
            >
              {currentIndex + 1 < words.length ? "次へ" : "結果を見る"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
