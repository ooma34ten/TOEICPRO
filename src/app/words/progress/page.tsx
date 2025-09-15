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

type Word = {
  id: string;
  correct_count: number;
  correct_dates?: string[];
  importance?: string;
  registered_at: string;
};

type ProgressData = { 
  date: string;
  corrects: number;
};

type RegisterData = {
  date: string;
  registered: number;
  cumulative: number;
  masteredCumulative: number; // 追加
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

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) router.replace("/auth/login");
      else setLoading(false);
    })();
  }, [router]);

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

      const { data: words, error } = await supabase
        .from("words")
        .select("id, correct_count, correct_dates, importance, registered_at")
        .eq("user_id", user.id);

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      const arr = (words ?? []) as Word[];

      // 概要計算
      setCount(arr.length);
      setMastered(arr.filter((x) => (x.correct_count ?? 0) >= 6).length);
      setUnlearned(arr.filter((x) => (x.correct_count ?? 0) === 0).length);

      let totalCorrect = 0;
      let totalAnswers = 0;
      arr.forEach((w) => {
        totalCorrect += w.correct_count ?? 0;
        totalAnswers += w.correct_dates?.length ?? 0;
      });
      setAccuracy(totalAnswers > 0 ? Math.round((totalCorrect / totalAnswers) * 100) : 0);

      // 日別正解数集計
      const countByDate: Record<string, number> = {};
      arr.forEach((w) => {
        (w.correct_dates || []).forEach((d) => {
          countByDate[d] = (countByDate[d] || 0) + 1;
        });
      });
      const dailyChart: ProgressData[] = Object.entries(countByDate)
        .sort(([a], [b]) => (a > b ? 1 : -1))
        .map(([date, corrects]) => ({ date, corrects }));
      setDailyData(dailyChart);

      // 日別登録数・累積登録数・完全記憶累計計算
      const registerByDate: Record<string, number> = {};
      arr.forEach((w) => {
        const date = w.registered_at.split("T")[0];
        registerByDate[date] = (registerByDate[date] || 0) + 1;
      });

      const dates = Object.keys(registerByDate).sort();
      let cumulative = 0;
      let masteredCumulative = 0;

      const registerChart: RegisterData[] = dates.map((date) => {
        const registered = registerByDate[date] ?? 0;
        cumulative += registered;

        // その日までに完全記憶になった単語数を累計
        const masteredCountUntilDate = arr.filter(
          (w) =>
            (w.correct_count ?? 0) >= 6 &&
            w.registered_at.split("T")[0] <= date
        ).length;
        masteredCumulative = masteredCountUntilDate;

        return { date, registered, cumulative, masteredCumulative };
      });

      setRegisterData(registerChart);
      setLoading(false);
    };

    fetchProgress();
  }, []);

  if (loading) return <p>読み込み中...</p>;
  if (error) return <p className="text-red-500">{error}</p>;

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

      {/* 日別正解数 */}
      <div className="bg-white p-4 rounded-xl shadow">
        <h2 className="text-lg font-semibold mb-2">正解数推移</h2>
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

      {/* 日別登録数・累積登録数 */}
      <div className="bg-white p-4 rounded-xl shadow">
        <h2 className="text-lg font-semibold mb-2">登録単語数・累積登録数</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={registerData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis yAxisId="left" allowDecimals={false} />
              <YAxis yAxisId="right" orientation="right" allowDecimals={false} />
              <Tooltip />
              {/* 累積登録数棒グラフ（半透明） */}
              <Bar
                yAxisId="right"
                dataKey="cumulative"
                fill="rgba(59, 130, 246, 0.5)"
                name="累積登録数"
              />
              {/* 日別登録数ライン */}
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="registered"
                stroke="#10b981"
                strokeWidth={2}
                name="日別登録数"
              />
              
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 完全記憶累計 */}
      <div className="bg-white p-4 rounded-xl shadow">
        <h2 className="text-lg font-semibold mb-2">完全記憶累計</h2>
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
                strokeWidth={2}
                name="完全記憶累計"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// src/app/words/progress/page.tsx
