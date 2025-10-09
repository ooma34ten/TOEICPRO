"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { speakText } from "@/lib/speech";
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
  correct_count: number;
  correct_dates: string[];
  registered_at: string;
  words_master: WordMaster; // ← 単一のオブジェクトとして扱いたい
};

export default function ReviewPage() {
  const [words, setWords] = useState<UserWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
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

  /** 最終復習日を取得 */
  const getLastReviewDate = (w: UserWord): Date => {
    if (w.correct_dates && w.correct_dates.length > 0) {
      return new Date(w.correct_dates[w.correct_dates.length - 1]);
    }
    return new Date(w.registered_at);
  };

  /** ログイン確認 */
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/auth/login");
      } else {
        setLoading(false);
      }
    })();
  }, [router]);

  /** 単語データ取得 */
  useEffect(() => {
    const fetchWords = async (): Promise<void> => {
      try {
        setLoading(true);
        setError(null);

        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData?.user) {
          setError("ログインが必要です");
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("user_words")
          .select(`
            id,
            user_id,
            word_id,
            correct_count,
            correct_dates,
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
          .eq("user_id", userData.user.id)
          .order("registered_at", { ascending: false });

        if (error) throw error;
        if (!data) {
          setWords([]);
          setLoading(false);
          return;
        }

        // words_master が配列で返ってくる可能性に対応
        const userWords: UserWord[] = data.map((item: any) => {
          const master = Array.isArray(item.words_master)
            ? item.words_master[0]
            : item.words_master;

          if (!master) {
            throw new Error("words_master が存在しません");
          }

          return {
            id: String(item.id),
            user_id: String(item.user_id),
            word_id: String(item.word_id),
            correct_count: Number(item.correct_count ?? 0),
            correct_dates: Array.isArray(item.correct_dates)
              ? item.correct_dates.map(String)
              : [],
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

        // 復習対象フィルター
        const today = new Date();
        const reviewWords = userWords.filter((w) => {
          const lastReview = getLastReviewDate(w);
          const diffDays = Math.floor(
            (today.getTime() - lastReview.getTime()) / (1000 * 60 * 60 * 24)
          );
          const schedule: Record<number, number> = {
            0: 0,
            1: 1,
            2: 2,
            3: 4,
            4: 7,
            5: 15,
          };
          const cappedCount = Math.min(w.correct_count ?? 0, 5);
          const nextReview = schedule[cappedCount];
          return diffDays >= nextReview;
        });

        // 重要度順ソート → シャッフル
        const sorted = reviewWords.sort((a, b) => {
          const rank = (imp: string): number => {
            switch (imp) {
              case "★★★★★":
                return 5;
              case "★★★★":
                return 4;
              case "★★★":
                return 3;
              case "★★":
                return 2;
              case "★":
                return 1;
              default:
                return 0;
            }
          };
          return rank(b.words_master.importance) - rank(a.words_master.importance);
        });

        const shuffled = shuffleArray(sorted);
        setWords(shuffled);
      } catch (err) {
        console.error(err);
        setError("データ取得中にエラーが発生しました。");
      } finally {
        setLoading(false);
      }
    };

    fetchWords();
  }, []);

  if (loading) return <p>読み込み中...</p>;
  if (error) return <p className="text-red-500">{error}</p>;
  if (words.length === 0) return <p>本日の復習対象はありません。</p>;

  const current = words[currentIndex];
  const m = current.words_master;

  /** OK / NG 判定 */
  const handleAnswer = async (isOk: boolean): Promise<void> => {
    try {
      const today = new Date().toISOString().split("T")[0];
      if (isOk) {
        const newCount = (current.correct_count || 0) + 1;
        const newDates = [...(current.correct_dates || []), today];
        console.log("Updating:", current.id, newCount, newDates);
        await supabase
          .from("user_words")
          .update({ correct_count: newCount, correct_dates: newDates })
          .eq("id", current.id);
      } else {
        await supabase
          .from("user_words")
          .update({ correct_count: 0, correct_dates: [] })
          .eq("id", current.id);
      }

      console.log("Answered:", isOk ? "OK" : "NG");

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

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">復習テスト</h1>
      <p className="mb-2">
        {currentIndex + 1} / {words.length}
      </p>

      <div className="mb-4">
        <span className="text-lg font-semibold">単語: {m.word}</span>
        <button
          onClick={() => speakText(m.word)}
          className="ml-2 text-blue-500 hover:underline inline-flex items-center"
        >
          🔊
        </button>

        <p className="text-lg font-semibold mb-2">
          例文: {m.example_sentence}
          <button
            onClick={() => speakText(m.example_sentence)}
            className="ml-2 text-blue-500 hover:underline"
          >
            🔊
          </button>
        </p>

        {!showAnswer ? (
          <button
            onClick={() => setShowAnswer(true)}
            className="bg-blue-500 text-white px-4 py-2 rounded"
          >
            答えを見る
          </button>
        ) : (
          <>
            <div className="mb-4">
              <p className="text-lg font-semibold mb-1">訳: {m.translation}</p>
              <p className="text-sm text-gray-700">品詞: {m.part_of_speech}</p>
              <p className="text-sm text-gray-700">意味: {m.meaning}</p>
              <p className="text-sm text-gray-700">重要度: {m.importance}</p>
            </div>
            <div className="space-x-4">
              <button
                onClick={() => handleAnswer(true)}
                className="bg-green-500 text-white px-4 py-2 rounded"
              >
                OK
              </button>
              <button
                onClick={() => handleAnswer(false)}
                className="bg-red-500 text-white px-4 py-2 rounded"
              >
                NG
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
