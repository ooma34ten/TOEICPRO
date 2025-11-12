"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import type { ReactElement } from "react";
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

type TimeUnit = "day" | "month" | "year";

type ProgressRow = {
  date: string;
  daily_correct: number;
  registered: number;
  mastered: number;
};

type AggregatedData = {
  date: string;
  corrects: number;
  cumulativeCorrect: number;
  registered: number;
  cumulativeRegistered: number;
  masteredCumulative: number;
};

export default function ProgressPage() {
  const [data, setData] = useState<ProgressRow[]>([]);
  const [aggregatedData, setAggregatedData] = useState<AggregatedData[]>([]);
  const [count, setCount] = useState(0);
  const [mastered, setMastered] = useState(0);
  const [accuracy, setAccuracy] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeUnit, setTimeUnit] = useState<TimeUnit>("day");
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/auth/login");
      } else {
        await fetchProgress();
      }
    })();
  }, [router]);

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

      // 単語登録確認
      const { data: first } = await supabase
        .from("user_words")
        .select("registered_at")
        .eq("user_id", user.id)
        .order("registered_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!first) {
        setData([]);
        setAggregatedData([]);
        setCount(0);
        setMastered(0);
        setAccuracy(0);
        setLoading(false);
        return;
      }

      // RPC 呼び出し
      const { data, error } = await supabase.rpc("get_user_word_progress", { uid: user.id });
      
      console.log("📡 RPC status:", status);
console.log("📡 RPC data:", data);
console.log("📡 RPC error:", JSON.stringify(error, null, 2));
      
      
      if (error) throw error;

      setData(data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  // 🔹 時間単位（日／月／年）に応じて集計
  useEffect(() => {
    if (data.length === 0) return;

    const groupKey = (dateStr: string) => {
      const d = new Date(dateStr);
      if (timeUnit === "month") return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (timeUnit === "year") return `${d.getFullYear()}`;
      return dateStr; // day
    };

    const grouped = new Map<string, { corrects: number; registered: number; mastered: number }>();

    data.forEach((row) => {
      const key = groupKey(row.date);
      const g = grouped.get(key) ?? { corrects: 0, registered: 0, mastered: 0 };
      g.corrects += row.daily_correct;
      g.registered += row.registered;
      g.mastered += row.mastered;
      grouped.set(key, g);
    });

    let cumCorrect = 0;
    let cumRegistered = 0;
    let cumMastered = 0;

    const aggregated: AggregatedData[] = Array.from(grouped.entries())
      .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
      .map(([date, val]) => {
        cumCorrect += val.corrects;
        cumRegistered += val.registered;
        cumMastered += val.mastered;
        return {
          date,
          corrects: val.corrects,
          cumulativeCorrect: cumCorrect,
          registered: val.registered,
          cumulativeRegistered: cumRegistered,
          masteredCumulative: cumMastered,
        };
      });

    setAggregatedData(aggregated);

    // トータル統計
    const totalRegistered = aggregated.at(-1)?.cumulativeRegistered ?? 0;
    const totalMastered = aggregated.at(-1)?.masteredCumulative ?? 0;
    const totalCorrect = aggregated.at(-1)?.cumulativeCorrect ?? 0;

    setCount(totalRegistered);
    setMastered(totalMastered);
    setAccuracy(totalRegistered > 0 ? Math.round((totalCorrect / (totalRegistered * 6)) * 100) : 0);
  }, [data, timeUnit]);

  const motivationMessage = useMemo(() => {
    if (count === 0) return "まだ始めたばかり！最初の一歩が大切です🔥";
    if (mastered >= count * 0.8) return "素晴らしい！ほとんどの単語をマスターしています！🌟";
    if (accuracy >= 80) return "正答率が非常に高いです！この調子で頑張りましょう💪";
    if (accuracy >= 50) return "安定してきましたね！コツコツ積み上げが大切です📘";
    return "焦らずいきましょう。毎日少しずつが一番の近道です🌱";
  }, [count, mastered, accuracy]);

  if (loading) return <div className="p-6 space-y-6 animate-pulse">Loading...</div>;
  if (error) return <p className="text-red-500">{error}</p>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 p-6">
      <h1 className="text-3xl font-bold text-center text-indigo-700 mb-2">学習進捗 📊</h1>
      <p className="text-center text-gray-600 mb-6">{motivationMessage}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <StatCard label="登録語数" value={count} color="from-indigo-400 to-indigo-600" />
        <StatCard label="完全記憶" value={mastered} color="from-green-400 to-green-600" />
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

      {/* 正解数チャート */}
      <ChartBox title="✅ 正解数・累積正解数推移">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={aggregatedData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip />
            <Bar yAxisId="left" dataKey="cumulativeCorrect" fill="rgba(59,130,246,0.3)" name="累積正解数" />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="corrects"
              stroke="#3b82f6"
              strokeWidth={3}
              name="正解数"
              dot={{ r: 3, fill: "#2563eb" }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartBox>

      {/* 登録単語チャート */}
      <ChartBox title="📚 登録単語数・累積登録数">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={aggregatedData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip />
            <Bar yAxisId="right" dataKey="cumulativeRegistered" fill="rgba(16,185,129,0.3)" name="累積登録数" />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="registered"
              stroke="#10b981"
              strokeWidth={3}
              name="日別登録数"
              dot={{ r: 3, fill: "#059669" }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartBox>

      {/* 完全記憶チャート */}
      <ChartBox title="🌟 完全記憶累計">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={aggregatedData}>
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
              dot={{ r: 3, fill: "#b45309" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartBox>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
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

function ChartBox({ title, children }: { title: string; children: ReactElement }) {
  return (
    <div
      className="
        bg-white 
        p-2 sm:p-4 
        rounded-2xl 
        shadow-md hover:shadow-lg 
        transition-all mb-6 
        w-[100vw] sm:w-full 
        max-w-[900px] 
        mx-auto 
        -mx-6 sm:mx-auto
      "
    >
      <h2 className="text-lg font-semibold mb-3 text-gray-700 border-l-4 border-indigo-400 pl-2">
        {title}
      </h2>

      <div className="h-[250px] sm:h-[350px] md:h-[450px] lg:h-[500px]">
        <ResponsiveContainer width="100%" height="100%" minWidth={320}>
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
