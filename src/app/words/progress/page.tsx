"use client";

import { useEffect, useState } from "react";
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

type WordMaster = {
  id: string;
  importance?: string;
};

type UserWord = {
  id: string;
  user_id: string;
  word_id: string;
  correct_count: number;
  correct_dates?: string[];
  registered_at: string;
  words_master: WordMaster[];
};

type ProgressData = {
  date: string;
  corrects: number;
  cumulative1: number;
};

type RegisterData = {
  date: string;
  registered: number;
  cumulative: number;
  masteredCumulative: number;
};

type TimeUnit = "day" | "month" | "year";

export default function ProgressPage() {
  const [words, setWords] = useState<UserWord[]>([]);
  const [count, setCount] = useState(0);
  const [mastered, setMastered] = useState(0);
  const [unlearned, setUnlearned] = useState(0);
  const [accuracy, setAccuracy] = useState(0);
  const [aggregatedDailyData, setAggregatedDailyData] = useState<ProgressData[]>([]);
  const [aggregatedRegisterData, setAggregatedRegisterData] = useState<RegisterData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeUnit, setTimeUnit] = useState<TimeUnit>("day");
  const router = useRouter();

  // ログインチェック
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) router.replace("/auth/login");
      else setLoading(false);
    })();
  }, [router]);

  // データ取得
  useEffect(() => {
    const fetchProgress = async () => {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError("ログインが必要です");
        setLoading(false);
        return;
      }

      const { data: wordsData, error } = await supabase
        .from("user_words")
        .select(`
          id,
          user_id,
          word_id,
          correct_count,
          correct_dates,
          registered_at,
          words_master (id, importance)
        `)
        .eq("user_id", user.id)
        .order("registered_at", { ascending: true });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      const arr = (wordsData ?? []) as UserWord[];
      setWords(arr);

      // 概要
      setCount(arr.length);
      setMastered(arr.filter((x) => (x.correct_count ?? 0) >= 6).length);
      setUnlearned(arr.filter((x) => (x.correct_count ?? 0) === 0).length);

      // 正答率
      let totalCorrect = 0;
      let totalAnswers = 0;
      arr.forEach((w) => {
        totalCorrect += w.correct_count ?? 0;
        totalAnswers += w.correct_dates?.length ?? 0;
      });
      setAccuracy(totalAnswers > 0 ? Math.round((totalCorrect / totalAnswers) * 100) : 0);

      setLoading(false);
    };

    fetchProgress();
  }, []);

  // 時間単位ごとに集計
  useEffect(() => {
    if (loading || words.length === 0) return;

    const aggregateByTimeUnit = (data: UserWord[], unit: TimeUnit) => {
      const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        switch (unit) {
          case "year":
            return d.getFullYear().toString();
          case "month":
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          case "day":
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2,"0")}`;
        }
      };

      // 日別正解数・累積正解数
      const countByDate: Record<string, number> = {};
      data.forEach((w) => {
        (w.correct_dates || []).forEach((d) => {
          const key = formatDate(d);
          countByDate[key] = (countByDate[key] || 0) + 1;
        });
      });

      let cumulative1 = 0;
      const dailyChart: ProgressData[] = Object.entries(countByDate)
        .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
        .map(([date, corrects]) => {
          cumulative1 += corrects;
          return { date, corrects, cumulative1 };
        });

      // 登録数・累積登録数・完全記憶累計
      const registerByDate: Record<string, number> = {};
      const masteredByDate: Record<string, number> = {};

      data.forEach((w) => {
        const regKey = formatDate(w.registered_at);
        registerByDate[regKey] = (registerByDate[regKey] || 0) + 1;

        if ((w.correct_count ?? 0) >= 6 && w.correct_dates && w.correct_dates[5]) {
          const masteredKey = formatDate(w.correct_dates[5]);
          masteredByDate[masteredKey] = (masteredByDate[masteredKey] || 0) + 1;
        }
      });

      const allKeys = Array.from(
        new Set([...Object.keys(registerByDate), ...Object.keys(masteredByDate)])
      ).sort();

      let cumulative = 0;
      let masteredCumulative = 0;

      const registerChart: RegisterData[] = allKeys.map((date) => {
        const registered = registerByDate[date] ?? 0;
        const masteredToday = masteredByDate[date] ?? 0;

        cumulative += registered;
        masteredCumulative += masteredToday;

        return { date, registered, cumulative, masteredCumulative };
      });

      return { dailyChart, registerChart };
    };

    const { dailyChart, registerChart } = aggregateByTimeUnit(words, timeUnit);
    setAggregatedDailyData(dailyChart);
    setAggregatedRegisterData(registerChart);
  }, [timeUnit, words, loading]);

  if (loading) return <p>読み込み中...</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  return (
    <div className="space-y-6 p-4 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold text-center text-gray-800 mb-6">
        学習進捗 📊
      </h1>

      {/* 概要カード */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white shadow-md rounded-xl p-4 flex flex-col items-center space-y-2">
          <span className="text-gray-500 text-sm">登録語数</span>
          <span className="text-2xl font-bold text-indigo-600">{count}</span>
        </div>
        <div className="bg-white shadow-md rounded-xl p-4 flex flex-col items-center space-y-2">
          <span className="text-gray-500 text-sm">完全記憶</span>
          <span className="text-2xl font-bold text-green-600">{mastered}</span>
        </div>
        <div className="bg-white shadow-md rounded-xl p-4 flex flex-col items-center space-y-2">
          <span className="text-gray-500 text-sm">未学習</span>
          <span className="text-2xl font-bold text-red-500">{unlearned}</span>
        </div>
        <div className="bg-white shadow-md rounded-xl p-4 flex flex-col items-center space-y-2">
          <span className="text-gray-500 text-sm">正答率</span>
          <span className="text-2xl font-bold text-yellow-500">{accuracy}%</span>
        </div>
      </div>

      {/* 時間単位切替ボタン */}
      <div className="flex gap-2 mb-4 justify-center">
        {(["day","month","year"] as TimeUnit[]).map((unit) => (
          <button
            key={unit}
            onClick={() => setTimeUnit(unit)}
            className={`px-3 py-1 rounded ${
              timeUnit === unit ? "bg-indigo-500 text-white" : "bg-gray-200 text-gray-700"
            }`}
          >
            {unit === "day" ? "日" : unit === "month" ? "月" : "年"}
          </button>
        ))}
      </div>

      {/* 正解数・総正解数推移 */}
      <div className="bg-white p-4 rounded-xl shadow">
        <h2 className="text-lg font-semibold mb-2 flex items-center gap-2 text-gray-700">
          ✅ 正解数・総正解数推移
        </h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={aggregatedDailyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis yAxisId="left" allowDecimals={false} />
              <YAxis yAxisId="right" orientation="right" allowDecimals={false} />
              <Tooltip />
              <Bar
                yAxisId="left"
                dataKey="cumulative1"
                fill="rgba(59,130,246,0.3)"
                name="累積正解数"
                radius={[4, 4, 0, 0]}
              />
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
        </div>
      </div>

      {/* 登録単語数・累積登録数 */}
      <div className="bg-white p-4 rounded-xl shadow">
        <h2 className="text-lg font-semibold mb-2 flex items-center gap-2 text-gray-700">
          📚 登録単語数・累積登録数
        </h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={aggregatedRegisterData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis yAxisId="left" allowDecimals={false} />
              <YAxis yAxisId="right" orientation="right" allowDecimals={false} />
              <Tooltip />
              <Bar
                yAxisId="right"
                dataKey="cumulative"
                fill="rgba(59,130,246,0.3)"
                name="累積登録数"
                radius={[4, 4, 0, 0]}
              />
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
        </div>
      </div>

      {/* 完全記憶累計 */}
      <div className="bg-white p-4 rounded-xl shadow">
        <h2 className="text-lg font-semibold mb-2 flex items-center gap-2 text-gray-700">
          🌟 完全記憶累計
        </h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={aggregatedRegisterData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis allowDecimals={false} />
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
        </div>
      </div>
    </div>
  );
}
