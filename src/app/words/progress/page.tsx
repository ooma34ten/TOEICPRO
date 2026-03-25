"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  AreaChart,
  Area,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { BookOpen, CheckCircle, TrendingUp, Award } from "lucide-react";

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

// =============================
// カスタム Tooltip
// =============================
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--card)] rounded-xl p-3 shadow-lg border border-[var(--border)] text-sm">
      <p className="font-bold text-[var(--foreground)] mb-1">{label}</p>
      {payload.map((entry: any, idx: number) => (
        <div key={idx} className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-[var(--muted-foreground)]">{entry.name}:</span>
          <span className="font-bold text-[var(--foreground)]">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

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
        if (localStorage.getItem("guestMode") === "true") {
          setLoading(false);
          return;
        }
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

      const { data, error } = await supabase.rpc("get_user_word_progress", { uid: user.id });

      if (error) throw error;

      setData(data ?? []);
    } catch (err) {
      console.error("fetchProgress error:", err);
      let errorMessage = "エラーが発生しました。";
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === 'object' && err !== null) {
        errorMessage = JSON.stringify(err);
      } else {
        errorMessage = String(err);
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 時間単位に応じて集計
  useEffect(() => {
    if (data.length === 0) return;

    const groupKey = (dateStr: string) => {
      const d = new Date(dateStr);
      if (timeUnit === "month") return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (timeUnit === "year") return `${d.getFullYear()}`;
      return dateStr;
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

    const totalRegistered = aggregated.at(-1)?.cumulativeRegistered ?? 0;
    const totalMastered = aggregated.at(-1)?.masteredCumulative ?? 0;
    const totalCorrect = aggregated.at(-1)?.cumulativeCorrect ?? 0;

    setCount(totalRegistered);
    setMastered(totalMastered);
    setAccuracy(totalRegistered > 0 ? Math.round((totalCorrect / (totalRegistered * 6)) * 100) : 0);
  }, [data, timeUnit]);

  const motivationMessage = useMemo(() => {
    if (count === 0) return { text: "まだ始めたばかり！最初の一歩が大切です🔥", emoji: "🚀" };
    if (mastered >= count * 0.8) return { text: "素晴らしい！ほとんどの単語をマスターしています！🌟", emoji: "👑" };
    if (accuracy >= 80) return { text: "正答率が非常に高いです！この調子で頑張りましょう💪", emoji: "🎯" };
    if (accuracy >= 50) return { text: "安定してきましたね！コツコツ積み上げが大切です📘", emoji: "📈" };
    return { text: "焦らずいきましょう。毎日少しずつが一番の近道です🌱", emoji: "🌱" };
  }, [count, mastered, accuracy]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--background)]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full mb-4"
        />
        <p className="text-[var(--muted-foreground)] text-sm font-medium">読み込み中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--background)]">
        <div className="bg-[var(--card)] rounded-xl p-8 text-center max-w-md border border-red-500/20">
          <p className="text-red-600 dark:text-red-400 text-sm font-medium">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-6 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg font-semibold text-sm hover:opacity-90 transition"
          >
            再読み込み
          </button>
        </div>
      </div>
    );
  }

  const statCards = [
    { label: "登録語数", value: count, icon: BookOpen, gradient: "from-[var(--accent)] to-blue-500", bgLight: "bg-[var(--accent)]/10" },
    { label: "完全記憶", value: mastered, icon: Award, gradient: "from-emerald-500 to-teal-500", bgLight: "bg-emerald-500/10" },
    { label: "正答率", value: `${accuracy}%`, icon: TrendingUp, gradient: "from-amber-500 to-orange-500", bgLight: "bg-amber-500/10" },
    { label: "マスター率", value: count > 0 ? `${Math.round((mastered / count) * 100)}%` : "0%", icon: CheckCircle, gradient: "from-violet-500 to-purple-500", bgLight: "bg-violet-500/10" },
  ];

  return (
    <div className="min-h-screen bg-[var(--background)] p-4 md:p-6 pb-20">
      {/* ヘッダー */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-6"
      >
        <h1 className="text-2xl font-bold text-[var(--foreground)] mb-3">
          📊 学習進捗
        </h1>
        <div className="inline-flex items-center gap-2 bg-[var(--card)] px-4 py-2 rounded-full border border-[var(--border)]">
          <span className="text-lg">{motivationMessage.emoji}</span>
          <p className="text-sm font-medium text-[var(--muted-foreground)]">
            {motivationMessage.text}
          </p>
        </div>
      </motion.div>

      {/* 統計カード */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6 max-w-4xl mx-auto">
        {statCards.map((card, idx) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-[var(--card)] rounded-xl p-4 border border-[var(--border)] hover:border-[var(--accent)]/30 transition-all"
          >
            <div className={`${card.bgLight} p-2 rounded-xl inline-flex mb-2`}>
              <card.icon className={`w-5 h-5 bg-gradient-to-r ${card.gradient} bg-clip-text`} style={{ color: `var(--tw-gradient-from)` }} />
            </div>
            <div className={`text-2xl font-bold bg-gradient-to-r ${card.gradient} bg-clip-text text-transparent`}>
              {card.value}
            </div>
            <p className="text-xs font-medium text-[var(--muted-foreground)] mt-1">{card.label}</p>
          </motion.div>
        ))}
      </div>

      {/* 期間ボタン */}
      <div className="flex gap-1 mb-6 justify-center">
        {(["day", "month", "year"] as TimeUnit[]).map((unit) => (
          <button
            key={unit}
            onClick={() => setTimeUnit(unit)}
            className={`px-5 py-2 rounded-full font-bold text-sm transition-all ${timeUnit === unit
                ? "bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/20"
                : "bg-[var(--card)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] border border-[var(--border)]"
              }`}
          >
            {unit === "day" ? "日別" : unit === "month" ? "月別" : "年別"}
          </button>
        ))}
      </div>

      {/* チャートセクション */}
      <div className="max-w-4xl mx-auto space-y-6">
        {/* 正解数チャート */}
        <ChartBox title="正解数 推移" subtitle="日別正解数と累積正解数">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={aggregatedData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="gradCorrects" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              />
              <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="cumulativeCorrect"
                fill="url(#gradCorrects)"
                stroke="none"
                name="累積正解数"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="corrects"
                stroke="#6366f1"
                strokeWidth={2.5}
                name="正解数"
                dot={{ r: 3, fill: "#6366f1", strokeWidth: 0 }}
                activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartBox>

        {/* 登録単語チャート */}
        <ChartBox title="登録単語数 推移" subtitle="日別登録数と累積登録数">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={aggregatedData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="gradRegistered" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              />
              <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                yAxisId="right"
                type="monotone"
                dataKey="cumulativeRegistered"
                fill="url(#gradRegistered)"
                stroke="none"
                name="累積登録数"
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="registered"
                stroke="#10b981"
                strokeWidth={2.5}
                name="登録数"
                dot={{ r: 3, fill: "#10b981", strokeWidth: 0 }}
                activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartBox>

        {/* 完全記憶チャート */}
        <ChartBox title="完全記憶 推移" subtitle="完全記憶の累計推移">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={aggregatedData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="gradMastered" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="masteredCumulative"
                stroke="#f59e0b"
                strokeWidth={2.5}
                fill="url(#gradMastered)"
                name="完全記憶累計"
                dot={{ r: 3, fill: "#f59e0b", strokeWidth: 0 }}
                activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartBox>
      </div>
    </div>
  );
}

// =============================
// チャートボックス
// =============================
function ChartBox({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactElement;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[var(--card)] p-4 md:p-6 rounded-xl border border-[var(--border)] shadow-sm"
    >
      <div className="mb-4">
        <h2 className="text-base font-bold text-[var(--foreground)]">{title}</h2>
        <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">{subtitle}</p>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[500px] h-[280px] md:h-[350px]">
          {children}
        </div>
      </div>
    </motion.div>
  );
}
