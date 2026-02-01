"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { initVoices, speakText } from "@/lib/speech";
import { getImportanceClasses, getPartOfSpeechClasses } from "@/lib/utils";
import { useRouter } from "next/navigation";
import Confetti from "react-confetti";

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

  type Stats = {
    yesterday: number;
    today: number;
    avg30: number;
    firstTarget: number;
    secondTarget: number;
    phase: "phase1" | "phase2" | "finished";
  };

  const [stats, setStats] = useState<Stats | null>(null);
  const [confettiTrigger, setConfettiTrigger] = useState(false);
  const [showPhaseModal, setShowPhaseModal] = useState<Stats["phase"] | null>(null);

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

  const fetchDailyStats = async (userId: string) => {
    const { data, error } = await supabase.rpc("get_user_word_progress", { uid: userId });
    if (error) {
      console.error("RPC error:", error);
      return { yesterday: 0, today: 0, avg30: 0 };
    }

    const rows = (data as { date: string; daily_correct: number }[]) ?? [];
    if (rows.length === 0) return { yesterday: 0, today: 0, avg30: 0 };

    const todayStr = new Date().toISOString().slice(0, 10);
    const todayCount = rows.find((r) => r.date === todayStr)?.daily_correct ?? 0;

    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = yesterdayDate.toISOString().slice(0, 10);

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

  const fetchStats = async (userId: string) => {
    const { yesterday, today, avg30 } = await fetchDailyStats(userId);
    const { firstTarget, secondTarget } = computeTargets(yesterday, avg30);

    let phase: Stats["phase"] = "phase1";
    if (today >= firstTarget && today < secondTarget) phase = "phase2";
    if (today >= secondTarget) phase = "finished";


    setStats({ yesterday, today, avg30, firstTarget, secondTarget, phase });
  };

  /** 単語取得 */
  useEffect(() => {
    if (!userId) return;

    const fetchWords = async (): Promise<void> => {
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
          },
        }));

        // 復習対象
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

        const rank = (imp: string) =>
          imp === "★★★★★" ? 5 : imp === "★★★★" ? 4 : imp === "★★★" ? 3 : imp === "★★" ? 2 : imp === "★" ? 1 : 0;

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
        await fetchStats(userId);
      }
    };

    fetchWords();
  }, [userId]);

  /** 回答処理 */
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

      if (stats) {
        const updatedToday = isOk ? stats.today + 1 : stats.today;
        let updatedPhase: Stats["phase"] = "phase1";
        if (updatedToday >= stats.firstTarget && updatedToday < stats.secondTarget) updatedPhase = "phase2";
        if (updatedToday >= stats.secondTarget) updatedPhase = "finished";

        // フェーズ変化があればモーダル表示
        if (updatedPhase !== stats.phase){
          setConfettiTrigger(true);
          setTimeout(() => setConfettiTrigger(false), 10000);
          setShowPhaseModal(updatedPhase);
        }
           

        setStats({ ...stats, today: updatedToday, phase: updatedPhase });
      }

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
    <div className="p-4 flex justify-center relative">
      {confettiTrigger && typeof window !== "undefined" && (
        <Confetti width={window.innerWidth} height={window.innerHeight} />
      )}

      {/* フェーズ達成モーダル */}
      {showPhaseModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl p-8 shadow-2xl text-center animate-bounce">
            <h2 className="text-4xl font-extrabold text-yellow-500 mb-4">
              {showPhaseModal === "phase2" ? "🟢 第一目標達成！" : "🟣 第二目標達成！🎉"}
            </h2>
            <p className="text-lg text-gray-700 mb-6">
              {showPhaseModal === "phase2"
                ? `今日の目標をクリアしました！次のステップに進もう！`
                : `今日の復習をすべてクリア！素晴らしい成果です！`}
            </p>
            <button
              onClick={() => setShowPhaseModal(null)}
              className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2 px-6 rounded-xl shadow-md transition transform hover:scale-105"
            >
              続ける
            </button>
          </div>
        </div>
      )}

      <div className="w-full max-w-xl">
        <h1 className="text-3xl font-bold text-center mb-4 text-indigo-700">🔥 復習テスト 🔥</h1>

        {/* 成績ブロック */}
        {stats && (
          <div className="border border-gray-200 bg-white p-4 rounded-xl mb-4 shadow-sm">
            <p className="text-center text-sm font-semibold text-gray-600 mb-2">
              {stats.phase === "phase1" && "🔵 第一目標に挑戦中"}
              {stats.phase === "phase2" && "🟢 第一目標達成！次のステップへ"}
              {stats.phase === "finished" && "🟣 第二目標も達成！目標更新中…🔥"}
            </p>

            <div className="space-y-1 text-gray-700">
              <p className="flex justify-between">
                <span>今日の正解数</span>
                <span className="font-bold">{stats.today}</span>
              </p>
              <p className="flex justify-between">
                <span>前回の正解数</span>
                <span>{stats.yesterday}</span>
              </p>
              <p className="flex justify-between">
                <span>過去30日の平均</span>
                <span>{stats.avg30.toFixed(1)}</span>
              </p>
            </div>

            <div className="mt-3">
              <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-2 bg-indigo-400 transition-all duration-300"
                  style={{
                    width:
                      stats.phase === "phase1"
                        ? `${Math.min((stats.today / stats.firstTarget) * 100, 100)}%`
                        : stats.phase === "phase2"
                        ? `${Math.min((stats.today / stats.secondTarget) * 100, 100)}%`
                        : "100%",
                  }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 mt-1 text-right">
                {stats.phase === "phase1" && `目標 ${stats.firstTarget}問`}
                {stats.phase === "phase2" && `第二目標 ${stats.secondTarget}問`}
                {stats.phase === "finished" && "すごい！ もう目標を超えました！🔥"}
              </p>
            </div>
          </div>
        )}

        <p className="text-sm text-gray-500 mb-4 text-center">
          {currentIndex + 1} / {words.length}
        </p>

        <div className="bg-white shadow-lg rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-indigo-600">{m.word}</h2>
            <button onClick={() => speakText(m.word)} className="text-indigo-500 hover:text-indigo-700 text-xl">
              🔊
            </button>
          </div>

          <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
            <span className="text-lg">{m.example_sentence}</span>
            <button onClick={() => speakText(m.example_sentence)} className="text-blue-500 hover:text-blue-700 text-xl">
              🔊
            </button>
          </div>

          {!showAnswer ? (
            <button
              onClick={() => setShowAnswer(true)}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 rounded-xl transition transform hover:scale-105 shadow-md"
            >
              答えを見る
            </button>
          ) : (
            <div className="space-y-3">
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <p className="text-lg font-semibold">訳: {m.translation}</p>
                <p className="text-sm text-gray-600">
                  品詞:{" "}
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getPartOfSpeechClasses(m.part_of_speech)}`}>
                    {m.part_of_speech}
                  </span>
                </p>
                <p className="text-sm text-gray-600">意味: {m.meaning}</p>
                <p className="text-sm text-gray-600">
                  重要度:{" "}
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getImportanceClasses(m.importance)}`}>
                    {m.importance}
                  </span>
                </p>
                <p className="text-sm text-gray-600">
                  正解数: {current.correct ?? 0} 回 / 誤答数: {current.wrong ?? 0} 回
                </p>
                <p className="text-sm font-semibold">
                  正解確率:{" "}
                  <span className={current.successRate! >= 0.8 ? "text-green-600" : current.successRate! >= 0.5 ? "text-yellow-600" : "text-red-600"}>
                    {(current.successRate! * 100).toFixed(1)} %
                  </span>
                </p>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => handleAnswer(true)}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-2 rounded-xl transition transform hover:scale-105 shadow-lg"
                >
                  ✅ OK
                </button>
                <button
                  onClick={() => handleAnswer(false)}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2 rounded-xl transition transform hover:scale-105 shadow-lg"
                >
                  ❌ NG
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}