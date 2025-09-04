"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

type Word = {
  id: string;
  correct_count: number;
  correct_dates?: string[];
  importance?: string;
};

type ProgressData = {
  date: string;
  corrects: number;
};

export default function ProgressPage() {
  const [count, setCount] = useState(0);
  const [mastered, setMastered] = useState(0);
  const [unlearned, setUnlearned] = useState(0);
  const [accuracy, setAccuracy] = useState(0);
  const [dailyData, setDailyData] = useState<ProgressData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);

      const { data: words } = await supabase
        .from("words")
        .select("id, correct_count, correct_dates, importance");

      const arr = (words ?? []) as Word[];

      // 総数
      setCount(arr.length);

      // 完全記憶（正解6回以上）
      setMastered(arr.filter((x) => (x.correct_count ?? 0) >= 6).length);

      // 未学習（正解0回）
      setUnlearned(arr.filter((x) => (x.correct_count ?? 0) === 0).length);

      // 正答率（正解数 ÷ 全回答数）
      let totalCorrect = 0;
      let totalAnswers = 0;
      arr.forEach((w) => {
        totalCorrect += w.correct_count ?? 0;
        totalAnswers += (w.correct_dates?.length ?? 0);
      });
      setAccuracy(totalAnswers > 0 ? Math.round((totalCorrect / totalAnswers) * 100) : 0);

      // 日別集計
      const countByDate: Record<string, number> = {};
      arr.forEach((w) => {
        (w.correct_dates || []).forEach((d) => {
          countByDate[d] = (countByDate[d] || 0) + 1;
        });
      });
      const chartData = Object.entries(countByDate)
        .sort(([a], [b]) => (a > b ? 1 : -1))
        .map(([date, corrects]) => ({ date, corrects }));
      setDailyData(chartData);

      setLoading(false);
    })();
  }, []);

  if (loading) return <p>読み込み中...</p>;

  return (
    <div className="space-y-6 p-4">
      <h1 className="text-2xl font-bold">学習進捗</h1>

      {/* 概要 */}
      <div className="bg-white p-4 rounded-xl shadow space-y-1">
        <p>登録語数: <b>{count}</b></p>
        <p>完全記憶（正解6回以上）: <b>{mastered}</b></p>
        <p>未学習（正解0回）: <b>{unlearned}</b></p>
        <p>正答率: <b>{accuracy}%</b></p>
      </div>

      {/* 日別推移グラフ */}
      <div className="bg-white p-4 rounded-xl shadow">
        <h2 className="text-lg font-semibold mb-2">日ごとの正解数推移</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="corrects" stroke="#3b82f6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

