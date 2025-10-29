"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  LineChart,
} from "recharts";

/* ===== 型定義 ===== */
type WordMaster = {
  id: string;
  word: string;
  part_of_speech?: string;
  meaning?: string;
  example_sentence?: string;
  translation?: string;
  importance?: string;
};

type UserWordHistory = {
  answered_at: string;
  is_correct: boolean;
};

type UserWord = {
  id: string;
  user_id: string;
  word_id: string;
  correct_count: number;
  incorrect_count: number;
  registered_at: string;
  words_master: WordMaster;
  user_word_history: UserWordHistory[];
};

type TimeUnit = "day" | "month" | "year";

/* ===== メインコンポーネント ===== */
export default function ProgressPage() {
  const [words, setWords] = useState<UserWord[]>([]);
  const [count, setCount] = useState(0);
  const [mastered, setMastered] = useState(0);
  const [unlearned, setUnlearned] = useState(0);
  const [accuracy, setAccuracy] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeUnit, setTimeUnit] = useState<TimeUnit>("day");
  const router = useRouter();

  /* ===== ログインチェック ===== */
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/auth/login");
      } else {
        fetchProgress();
      }
    })();
  }, [router]);

  /* ===== データ取得 ===== */
  const fetchProgress = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
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
          incorrect_count,
          registered_at,
          words_master (id, word),
          user_word_history (is_correct, answered_at)
        `)
        .eq("user_id", user.id)
        .order("registered_at", { ascending: true });

      if (error) throw error;

      if (!data) {
        setWords([]);
        return;
      }

      type RawUserWord = {
        id: string;
        user_id: string;
        word_id: string;
        correct_count: number | null;
        incorrect_count: number | null;
        registered_at: string;
        words_master: WordMaster | WordMaster[] | null;
        user_word_history: UserWordHistory[] | null;
      };

      const mapped: UserWord[] = (data as RawUserWord[]).map((w) => ({
        id: w.id,
        user_id: w.user_id,
        word_id: w.word_id,
        correct_count: w.correct_count ?? 0,
        incorrect_count: w.incorrect_count ?? 0,
        registered_at: w.registered_at,
        words_master: Array.isArray(w.words_master)
          ? w.words_master[0]
          : (w.words_master as WordMaster),
        user_word_history: w.user_word_history ?? [],
      }));

      setWords(mapped);
      setCount(mapped.length);
      setMastered(mapped.filter((w) => w.correct_count >= 6).length);
      setUnlearned(mapped.filter((w) => w.correct_count === 0).length);

      const allHistories = mapped.flatMap((w) =>
        w.user_word_history.map((h) => ({ ...h, user_word_id: w.id }))
      );

      const totalCorrect = allHistories.filter((h) => h.is_correct).length;
      setAccuracy(
        allHistories.length > 0
          ? Math.round((totalCorrect / allHistories.length) * 100)
          : 0
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  /* ===== データ集計 ===== */
  const { aggregatedDailyData, aggregatedRegisterData } = useMemo(() => {
    if (loading || words.length === 0)
      return { aggregatedDailyData: [], aggregatedRegisterData: [] };

    const formatDate = (dateStr: string) => {
      const d = new Date(dateStr);
      switch (timeUnit) {
        case "year":
          return d.getFullYear().toString();
        case "month":
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        default:
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
            d.getDate()
          ).padStart(2, "0")}`;
      }
    };

    const countByDate: Record<string, number> = {};
    const registerByDate: Record<string, number> = {};
    const masteredByDate: Record<string, number> = {};

    words.forEach((w) => {
      const regKey = formatDate(w.registered_at);
      registerByDate[regKey] = (registerByDate[regKey] || 0) + 1;

      const corrects = w.user_word_history.filter((h) => h.is_correct);
      corrects.forEach((h) => {
        const key = formatDate(h.answered_at);
        countByDate[key] = (countByDate[key] || 0) + 1;
      });

      if (corrects.length >= 6) {
        const masteredKey = formatDate(corrects[5].answered_at);
        masteredByDate[masteredKey] = (masteredByDate[masteredKey] || 0) + 1;
      }
    });

    let cumulative1 = 0;
    const aggregatedDailyData = Object.entries(countByDate)
      .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
      .map(([date, corrects]) => {
        cumulative1 += corrects;
        return { date, corrects, cumulative1 };
      });

    const allKeys = Array.from(
      new Set([...Object.keys(registerByDate), ...Object.keys(masteredByDate)])
    ).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    let cumulative = 0;
    let masteredCumulative = 0;
    const aggregatedRegisterData = allKeys.map((date) => {
      const registered = registerByDate[date] ?? 0;
      const masteredToday = masteredByDate[date] ?? 0;
      cumulative += registered;
      masteredCumulative += masteredToday;
      return { date, registered, cumulative, masteredCumulative };
    });

    return { aggregatedDailyData, aggregatedRegisterData };
  }, [timeUnit, words, loading]);

  /* ===== モチベーションコメント ===== */
  const motivationMessage = useMemo(() => {
    if (count === 0) return "まだ始めたばかり！最初の一歩が大切です🔥";
    if (mastered >= count * 0.8)
      return "素晴らしい！ほとんどの単語をマスターしています！🌟";
    if (accuracy >= 80)
      return "正答率が非常に高いです！この調子で頑張りましょう💪";
    if (accuracy >= 50)
      return "安定してきましたね！コツコツ積み上げが大切です📘";
    return "焦らずいきましょう。毎日少しずつが一番の近道です🌱";
  }, [count, mastered, accuracy]);

  /* ===== ローディング・エラー表示 ===== */
  if (loading) {
    return (
      <div className="p-6 space-y-6 animate-pulse">
        <div className="h-8 bg-gray-300 rounded"></div>
        <div className="h-64 bg-gray-200 rounded"></div>
        <div className="h-64 bg-gray-200 rounded"></div>
      </div>
    );
  }

  if (error) return <p className="text-red-500">{error}</p>;

  /* ===== 表示 ===== */
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 p-6">
      <h1 className="text-3xl font-bold text-center text-indigo-700 mb-2">
        学習進捗 📊
      </h1>
      <p className="text-center text-gray-600 mb-6">
        {motivationMessage}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="登録語数" value={count} color="from-indigo-400 to-indigo-600" />
        <StatCard label="完全記憶" value={mastered} color="from-green-400 to-green-600" />
        <StatCard label="未学習" value={unlearned} color="from-red-400 to-red-600" />
        <StatCard label="正答率" value={`${accuracy}%`} color="from-yellow-400 to-yellow-600" />
      </div>

      <div className="flex gap-2 mb-4 justify-center">
        {(["day", "month", "year"] as TimeUnit[]).map((unit) => (
          <button
            key={unit}
            onClick={() => setTimeUnit(unit)}
            className={`px-4 py-2 rounded-lg font-medium shadow transition-all ${
              timeUnit === unit
                ? "bg-indigo-600 text-white scale-105"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            {unit === "day" ? "日" : unit === "month" ? "月" : "年"}
          </button>
        ))}
      </div>

      <ChartBox title="✅ 正解数・累積正解数推移">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={aggregatedDailyData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip />
            <Bar yAxisId="left" dataKey="cumulative1" fill="rgba(59,130,246,0.3)" name="累積正解数" />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="corrects"
              stroke="#3b82f6"
              strokeWidth={3}
              name="日別正解数"
              dot={{ r: 4, fill: "#2563eb" }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartBox>

      <ChartBox title="📚 登録単語数・累積登録数">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={aggregatedRegisterData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip />
            <Bar yAxisId="right" dataKey="cumulative" fill="rgba(59,130,246,0.3)" name="累積登録数" />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="registered"
              stroke="#10b981"
              strokeWidth={3}
              name="日別登録数"
              dot={{ r: 4, fill: "#059669" }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartBox>

      <ChartBox title="🌟 完全記憶累計">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={aggregatedRegisterData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="masteredCumulative"
              stroke="#f59e0b"
              strokeWidth={3}
              name="完全記憶累計"
              dot={{ r: 4, fill: "#b45309" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartBox>
    </div>
  );
}

/* ===== 下層コンポーネント ===== */
function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="bg-white shadow-lg rounded-2xl p-4 flex flex-col items-center space-y-2 border border-gray-100 hover:shadow-xl transition-all duration-300">
      <span className="text-gray-500 text-sm">{label}</span>
      <span
        className={`text-3xl font-extrabold bg-gradient-to-r ${color} bg-clip-text text-transparent`}
      >
        {value}
      </span>
    </div>
  );
}

function ChartBox({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white p-4 rounded-2xl shadow-md hover:shadow-lg transition-all mb-6">
      <h2 className="text-lg font-semibold mb-3 text-gray-700 border-l-4 border-indigo-400 pl-2">
        {title}
      </h2>
      <div className="h-64">{children}</div>
    </div>
  );
}
