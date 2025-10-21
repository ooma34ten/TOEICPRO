"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { speakText } from "@/lib/speech";
import { getImportanceClasses, getPartOfSpeechClasses } from "@/lib/utils";
import { useRouter } from "next/navigation";

type WordMaster = {
  id: string;
  word: string;
  part_of_speech: string;
  meaning: string;
  example_sentence: string;
  translation: string;
  importance: string;
  registered_at: string;
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

export default function ReviewPage() {
  const [words, setWords] = useState<UserWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
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
        router.replace("/auth/login");
        return;
      }
      setUserId(data.session.user.id);
      setLoading(false);
    })();
  }, [router]);

  /** 単語データ取得 */
  useEffect(() => {
    if (!userId) return;

    const fetchWords = async (): Promise<void> => {
      try {
        setLoading(true);
        setError(null);

        // 🔹 user_words + words_master 取得
        const { data, error } = await supabase
          .from("user_words")
          .select(`
            id,
            user_id,
            word_id,
            registered_at,
            words_master (
              id,
              word,
              part_of_speech,
              meaning,
              example_sentence,
              translation,
              importance,
              registered_at
            )
          `)
          .eq("user_id", userId)
          .order("registered_at", { ascending: false });

        if (error) throw error;

        const userWords: UserWord[] = (data ?? []).map((item) => {
          const master = Array.isArray(item.words_master)
            ? item.words_master[0]
            : item.words_master;

          return {
            id: String(item.id),
            user_id: String(item.user_id),
            word_id: String(item.word_id),
            registered_at: String(item.registered_at),
            words_master: {
              id: String(master.id),
              word: String(master.word),
              part_of_speech: String(master.part_of_speech),
              meaning: String(master.meaning),
              example_sentence: String(master.example_sentence),
              translation: String(master.translation),
              importance: String(master.importance),
              registered_at: String(master.registered_at),
            },
          };
        });

        // 🔹 履歴取得
        const { data: history } = await supabase
          .from("user_word_history")
          .select("user_word_id, answered_at, is_correct")
          .eq("user_id", userId);

        // 🔹 履歴集計
        const historyStats = new Map<
          string,
          { total: number; correct: number; lastAnswered: string }
        >();

        history?.forEach((h) => {
          const s = historyStats.get(h.user_word_id) ?? {
            total: 0,
            correct: 0,
            lastAnswered: h.answered_at,
          };
          s.total += 1;
          if (h.is_correct) s.correct += 1;
          s.lastAnswered = h.answered_at;
          historyStats.set(h.user_word_id, s);
        });

        const today = new Date();

        const userWordsWithStats: UserWord[] = userWords.map((w) => {
          const stat = historyStats.get(w.id);
          const total = stat?.total ?? 0;
          const correct = stat?.correct ?? 0;
          const wrong = total - correct;
          const successRate = total > 0 ? correct / total : 0;
          const lastAnswered = stat?.lastAnswered ?? w.registered_at;

          return {
            ...w,
            total,
            correct,
            wrong,
            successRate,
            lastAnswered,
          };
        });

        // 🔹 復習対象判定
        const reviewWords = userWordsWithStats.filter((w) => {
          const lastReview = new Date(w.lastAnswered!);
          const diffDays = Math.floor(
            (today.getTime() - lastReview.getTime()) / (1000 * 60 * 60 * 24)
          );

          const schedule: Record<number, number> = {
            0: 0,
            1: 1,
            2: 3,
            3: 7,
            4: 14,
            5: 30,
          };
          const cappedCount = Math.min(w.correct ?? 0, 5);
          let nextReview = schedule[cappedCount];

          const isFullyMemorized = (w.correct ?? 0) >= 6 && w.successRate! >= 0.9;
          if (isFullyMemorized) return false;

          if ((w.correct ?? 0) >= 6 && w.successRate! < 0.9) {
            if (w.successRate! < 0.5) nextReview = 7;
            else if (w.successRate! < 0.7) nextReview = 14;
            else nextReview = 21;
          }

          return diffDays >= nextReview;
        });

        // 🔹 重要度順 + シャッフル
        const rank = (imp: string): number =>
          imp === "★★★★★" ? 5 :
          imp === "★★★★" ? 4 :
          imp === "★★★" ? 3 :
          imp === "★★" ? 2 :
          imp === "★" ? 1 : 0;

        const groupedByImportance: Record<number, UserWord[]> = {};
        reviewWords.forEach((w) => {
          const r = rank(w.words_master.importance);
          if (!groupedByImportance[r]) groupedByImportance[r] = [];
          groupedByImportance[r].push(w);
        });

        const shuffledByImportance: UserWord[] = [];
        [5, 4, 3, 2, 1].forEach((r) => {
          if (groupedByImportance[r]) {
            shuffledByImportance.push(...shuffleArray(groupedByImportance[r]));
          }
        });

        setWords(shuffledByImportance);
      } catch (err) {
        console.error(err);
        setError("データ取得中にエラーが発生しました。");
      } finally {
        setLoading(false);
      }
    };

    fetchWords();
  }, [userId]);

  /** 回答処理（履歴だけ追加） */
  const handleAnswer = async (isOk: boolean): Promise<void> => {
    try {
      if (!userId) return;
      const now = new Date().toISOString();

      await supabase.from("user_word_history").insert({
        user_word_id: words[currentIndex].id,
        user_id: userId,
        is_correct: isOk,
        answered_at: now,
      });

      if (currentIndex + 1 < words.length) {
        setCurrentIndex((prev) => prev + 1);
        setShowAnswer(false);
      } else {
        alert("復習終了！");
      }
    } catch (err) {
      console.error(err);
      alert("更新中にエラーが発生しました。");
    }
  };

  if (loading) return <p>読み込み中...</p>;
  if (error) return <p className="text-red-500">{error}</p>;
  if (words.length === 0) return <p>本日の復習対象はありません。</p>;

  const current = words[currentIndex];
  const m = current.words_master;

  return (
    <div className="p-4 flex justify-center">
      <div className="w-full max-w-xl">
        <h1 className="text-2xl font-bold text-center mb-6 text-gray-800">復習テスト</h1>
        <p className="text-sm text-gray-500 mb-4 text-center">
          {currentIndex + 1} / {words.length}
        </p>

        <div className="bg-white shadow-lg rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-indigo-600">{m.word}</h2>
            <button
              onClick={() => speakText(m.word)}
              className="text-indigo-500 hover:text-indigo-700 text-xl"
            >
              🔊
            </button>
          </div>

          <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
            <span className="text-lg">{m.example_sentence}</span>
            <button
              onClick={() => speakText(m.example_sentence)}
              className="text-blue-500 hover:text-blue-700 text-xl"
            >
              🔊
            </button>
          </div>

          {!showAnswer ? (
            <button
              onClick={() => setShowAnswer(true)}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 rounded-xl transition"
            >
              答えを見る
            </button>
          ) : (
            <div className="space-y-3">
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <p className="text-lg font-semibold">訳: {m.translation}</p>
                <p className="text-sm text-gray-600">
                  品詞:{" "}
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${getPartOfSpeechClasses(
                      m.part_of_speech
                    )}`}
                  >
                    {m.part_of_speech}
                  </span>
                </p>
                <p className="text-sm text-gray-600">意味: {m.meaning}</p>
                <p className="text-sm text-gray-600">
                  重要度:{" "}
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${getImportanceClasses(
                      m.importance
                    )}`}
                  >
                    {m.importance}
                  </span>
                </p>

                <p className="text-sm text-gray-600">
                  正解数: {current.correct ?? 0} 回 / 誤答数: {current.wrong ?? 0} 回
                </p>

                <p className="text-sm font-semibold">
                  正解確率:{" "}
                  <span
                    className={
                      current.successRate! >= 0.8
                        ? "text-green-600"
                        : current.successRate! >= 0.5
                        ? "text-yellow-600"
                        : "text-red-600"
                    }
                  >
                    {(current.successRate! * 100).toFixed(1)} %
                  </span>
                </p>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => handleAnswer(true)}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white font-semibold py-2 rounded-xl transition"
                >
                  OK
                </button>
                <button
                  onClick={() => handleAnswer(false)}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-2 rounded-xl transition"
                >
                  NG
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
