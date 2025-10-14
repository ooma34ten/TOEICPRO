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
  words_master: WordMaster[]; // ← 配列に変更
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

export default function ProgressPage() {
  const [count, setCount] = useState(0);
  const [mastered, setMastered] = useState(0);
  const [unlearned, setUnlearned] = useState(0);
  const [accuracy, setAccuracy] = useState(0);
  const [dailyData, setDailyData] = useState<ProgressData[]>([]);
  const [registerData, setRegisterData] = useState<RegisterData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // ログインチェック
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) router.replace("/auth/login");
      else setLoading(false);
    })();
  }, [router]);

  // 学習データ取得
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

      // 新しいDB構造に対応
      const { data: words, error } = await supabase
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
            importance
          )
        `)
        .eq("user_id", user.id)
        .order("registered_at", { ascending: true });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      const arr = (words ?? []) as UserWord[];

      // 概要集計
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

      // 日別正解数・総正解数
      const countByDate: Record<string, number> = {};
      arr.forEach((w) => {
        (w.correct_dates || []).forEach((d) => {
          countByDate[d] = (countByDate[d] || 0) + 1;
        });
      });

      let cumulative1 = 0;
      const dailyChart: ProgressData[] = Object.entries(countByDate)
        .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
        .map(([date, corrects]) => {
          cumulative1 += corrects;
          return { date, corrects, cumulative1 }; // ← 累積を追加
        });

      setDailyData(dailyChart);


      // 日別登録数・累積登録数・完全記憶累計
const registerByDate: Record<string, number> = {};
arr.forEach((w) => {
  const date = w.registered_at.split("T")[0];
  registerByDate[date] = (registerByDate[date] || 0) + 1;
});

// 完全記憶日だけを抽出（6回目の正解日）
const masteredByDate: Record<string, number> = {};
arr.forEach((w) => {
  if ((w.correct_count ?? 0) >= 6 && w.correct_dates && w.correct_dates[5]) {
    const masteredDate = w.correct_dates[5]; // 6回目の正解日
    masteredByDate[masteredDate] = (masteredByDate[masteredDate] || 0) + 1;
  }
});

// グラフ用に日付順の配列を作る
const allDates = Array.from(new Set([...Object.keys(masteredByDate)])).sort();

let masteredCumulative = 0;

const masteredChart: { date: string; masteredCumulative: number }[] = allDates.map((date) => {
  const masteredToday = masteredByDate[date] ?? 0;
  masteredCumulative += masteredToday;
  return { date, masteredCumulative };
});

// React state にセット
setRegisterData(prev => {
  // prev は既存の registerData（登録数・累積登録数など）
  // 日付ごとに masteredCumulative を上書きして統合
  const merged = prev.map((row) => {
    const masteredRow = masteredChart.find((m) => m.date === row.date);
    return {
      ...row,
      masteredCumulative: masteredRow ? masteredRow.masteredCumulative : row.masteredCumulative,
    };
  });
  return merged;
});


      setLoading(false);
    };

    fetchProgress();
  }, []);

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

      {/* 正解数・総正解数推移 */}
      <div className="bg-white p-4 rounded-xl shadow">
        <h2 className="text-lg font-semibold mb-2 flex items-center gap-2 text-gray-700">
          ✅ 正解数・総正解数推移
        </h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={dailyData}>
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
            <ComposedChart data={registerData}>
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
            <LineChart data={registerData}>
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
