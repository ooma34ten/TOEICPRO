// src/app/words/review/page.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Word = {
  id: number;
  word: string;
  part_of_speech: string;
  meaning: string;
  example_sentence: string;
  translation: string;
  importance: string;
  registered_at: string;
  correct_count?: number;
  correct_dates?: string[];
};

export default function ReviewPage() {
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  // Fisher–Yates shuffle
  const shuffleArray = (array: Word[]) => {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  // 最後に正解した日 or 登録日を基準日として返す
  const getLastReviewDate = (w: Word) => {
    if (w.correct_dates && w.correct_dates.length > 0) {
      return new Date(w.correct_dates[w.correct_dates.length - 1]);
    }
    return new Date(w.registered_at);
  };

  
  

  useEffect(() => {
    const fetchWords = async () => {
      setLoading(true);
      setError(null);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("ログインが必要です");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("words")
        .select("*")
        .eq("user_id", user.id);

      if (error) {
        setError(error.message);
      } else {
        const today = new Date();

        const reviewWords = (data || []).filter((w) => {
          const lastReview = getLastReviewDate(w);
          const diffDays = Math.floor(
            (today.getTime() - lastReview.getTime()) / (1000 * 60 * 60 * 24)
          );

          // 忘却曲線の間隔（日）
          const schedule: Record<number, number> = {
            0: 0, // 毎日出題
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

        const sortedAndShuffled = shuffleArray(reviewWords).sort((a, b) => {
          const importanceRank = (imp: string) => {
            switch (imp) {
              case "★★★★★": return 5;
              case "★★★★": return 4;
              case "★★★": return 3;
              default: return 0;
            }
          };
          return importanceRank(b.importance) - importanceRank(a.importance);
        });
        setWords(sortedAndShuffled);        
      }

      setLoading(false);
    };

    fetchWords();
  }, []);

  if (loading) return <p>読み込み中...</p>;
  if (error) return <p className="text-red-500">{error}</p>;
  if (words.length === 0) return <p>本日の復習対象はありません。</p>;

  const currentWord = words[currentIndex];

  const handleAnswer = async (isOk: boolean) => {
    const today = new Date().toISOString().split("T")[0];

    if (isOk) {
      const newCount = (currentWord.correct_count || 0) + 1;
      const newDates = [...(currentWord.correct_dates || []), today];

      await supabase
        .from("words")
        .update({ correct_count: newCount, correct_dates: newDates })
        .eq("id", currentWord.id);
    } else {
      // NG の場合はカウントをリセット
      await supabase
        .from("words")
        .update({ correct_count: 0 })
        .eq("id", currentWord.id);
    }

    if (currentIndex + 1 < words.length) {
      setCurrentIndex((prev) => prev + 1);
      setShowAnswer(false);
    } else {
      alert("復習終了！");
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">復習テスト</h1>
      <p className="mb-2">
        {currentIndex + 1} / {words.length}
      </p>

      <div className="mb-4">
        <p className="text-lg font-semibold mb-4">
          単語: {currentWord.word}
        </p>
        <p className="text-lg font-semibold mb-4">
          例文: {currentWord.example_sentence}
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
              <p className="text-lg font-semibold mb-4">訳: {currentWord.translation}</p>
              <p className="text-sm text-gray-700">品詞: {currentWord.part_of_speech}</p>
              <p className="text-sm text-gray-700">意味: {currentWord.meaning}</p>
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
