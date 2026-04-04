"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Trophy,
  Flame,
  Target,
  BookOpen,
  ChevronRight,
  Zap,
  Star,
  Activity,
  Sparkles,
  TrendingUp,
  LogIn,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { cn, getJSTDateString } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import toast from "react-hot-toast";
import OnboardingPopup from "@/components/OnboardingPopup";
import { getDailyTasksCount } from "@/app/actions/getDailyTasks";
import { getOrCreateWeeklyRace, type RaceData } from "@/app/actions/race";
import { PixelCharacterMini } from "@/components/PixelCharacter";
import { getCharacterDef, getStageIndex, type CharacterType } from "@/lib/characters";

// =============================
// 型定義
// =============================
interface UserStats {
  streak_current: number;
  streak_max: number;
  total_xp: number;
  level: number;
  daily_goal_current: number;
  daily_goal_target: number;
  nickname?: string | null;
}

// =============================
// 時間帯別グリーティング
// =============================
function getGreeting(): { text: string; subText: string } {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return {
      text: "おはようございます",
      subText: "朝の学習は記憶に残りやすいです",
    };
  } else if (hour >= 12 && hour < 17) {
    return {
      text: "こんにちは",
      subText: "午後も集中して進めましょう",
    };
  } else if (hour >= 17 && hour < 21) {
    return {
      text: "おつかれさまです",
      subText: "今日の復習を忘れずに",
    };
  } else {
    return {
      text: "おつかれさまです",
      subText: "夜の静かな時間にじっくり学びましょう",
    };
  }
}

// =============================
// 円形プログレスリング
// =============================
const ProgressRing = ({
  progress,
  size = 120,
  strokeWidth = 8,
  color = "stroke-[var(--accent)]",
  bgColor = "stroke-[var(--border)]",
  children,
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  bgColor?: string;
  children?: React.ReactNode;
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - Math.min(progress, 1) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="none"
          className={bgColor}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          className={color}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: "easeOut" }}
          style={{ strokeDasharray: circumference }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
};

// =============================
// StatCard
// =============================
const StatCard = ({
  title,
  value,
  icon: Icon,
  subtitle,
  accentColor = "text-[var(--accent)]",
  delay = 0,
}: {
  title: string;
  value: string | number;
  icon: any;
  subtitle?: string;
  accentColor?: string;
  delay?: number;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3, delay }}
    className="bg-[var(--card)] border border-[var(--border)] p-4 rounded-xl"
  >
    <div className="flex items-center justify-between mb-3">
      <Icon className={cn("w-4 h-4", accentColor)} />
      <span className="text-[11px] font-medium text-[var(--muted-foreground)]">
        {title}
      </span>
    </div>
    <div className="text-2xl font-bold text-[var(--foreground)]">
      {value}
    </div>
    {subtitle && (
      <div className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
        {subtitle}
      </div>
    )}
  </motion.div>
);

// =============================
// ActionCard
// =============================
const ActionCard = ({
  title,
  desc,
  icon: Icon,
  onClick,
  delay = 0,
  disabled = false,
  accentColor = "var(--accent)",
  current,
  target,
}: {
  title: string;
  desc: string;
  icon: any;
  onClick: () => void;
  delay?: number;
  disabled?: boolean;
  accentColor?: string;
  current?: number;
  target?: number;
}) => {
  const isTask = current !== undefined && target !== undefined;
  const isCompleted = isTask && current >= target;
  const progressPercent = isTask ? Math.min((current / target) * 100, 100) : 0;

  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      onClick={(e: React.MouseEvent) => {
        if (disabled) {
          e.preventDefault();
          toast(`「${title}」は現在開発中です！\nリリースまで楽しみにお待ちください🚀`, {
            icon: '🛠️',
            style: { borderRadius: '8px', background: 'var(--card)', color: 'var(--foreground)', border: '1px solid var(--border)' },
          });
          return;
        }
        onClick();
      }}
      className={cn(
        "group text-left p-5 flex flex-col justify-between rounded-2xl transition-all w-full border bg-[var(--card)] relative overflow-hidden",
        disabled
          ? "opacity-40 cursor-not-allowed border-[var(--border)]"
          : isCompleted
            ? "border-emerald-500/30 hover:border-emerald-500/50 hover:shadow-[0_4px_12px_rgba(16,185,129,0.08)] bg-gradient-to-br from-[var(--card)] to-emerald-500/5"
            : "border-[var(--border)] hover:border-[var(--accent)]/30 hover:shadow-md hover:-translate-y-0.5"
      )}
    >
      {/* Background completion effect */}
      {isCompleted && (
        <div className="absolute top-0 right-0 p-12 -m-8 bg-gradient-to-bl from-emerald-500/10 to-transparent rounded-full pointer-events-none" />
      )}

      <div className="flex items-start justify-between w-full mb-4 relative z-10">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
          style={{ backgroundColor: `color-mix(in srgb, ${accentColor} 12%, transparent)` }}
        >
          <Icon className="w-5 h-5" style={{ color: accentColor }} />
        </div>
        
        {isCompleted ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 shadow-sm">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">クリア！</span>
          </div>
        ) : (
          <div className="p-1.5 rounded-full bg-[var(--secondary)] text-[var(--muted-foreground)] group-hover:bg-[var(--accent)] group-hover:text-[var(--accent-foreground)] transition-colors shadow-sm shrink-0">
            <ChevronRight className="w-4 h-4" />
          </div>
        )}
      </div>
      
      <div className="flex-1 w-full relative z-10">
        <h3 className="text-base font-bold text-[var(--foreground)] mb-1.5">{title}</h3>
        <p className="text-[12.5px] text-[var(--muted-foreground)] leading-relaxed mb-4">
          {desc}
        </p>
      </div>

      {isTask && (
        <div className="w-full mt-auto pt-3 border-t border-[var(--border)]/70 relative z-10">
          <div className="flex justify-between items-end mb-2">
            <span className="text-[11px] font-medium text-[var(--muted-foreground)]">進捗</span>
            <span className={cn("text-[13px] font-bold", isCompleted ? "text-emerald-600 dark:text-emerald-400" : "text-[var(--foreground)]")}>
              {current} <span className="text-[10px] text-[var(--muted-foreground)] font-normal">/ {target}問</span>
            </span>
          </div>
          <div className="h-1.5 w-full bg-[var(--secondary)] rounded-full overflow-hidden">
            <motion.div
              className={cn("h-full rounded-full transition-all duration-1000", isCompleted ? "bg-emerald-500" : "bg-[var(--accent)]")}
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}
    </motion.button>
  );
};

// =============================
// ストリークスタイル
// =============================
function getStreakLabel(streak: number) {
  if (streak >= 30) return "🌈 伝説的！";
  if (streak >= 14) return "🔥 すごい！";
  if (streak >= 7) return "💪 いい感じ！";
  if (streak >= 3) return "✨ 調子いい！";
  return "";
}

export default function Dashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("ゲスト");
  const [wordReviewCount, setWordReviewCount] = useState(0);
  const [part5Count, setPart5Count] = useState(0);
  const [wordTarget, setWordTarget] = useState(10);
  const [part5Target, setPart5Target] = useState(10);
  const [chartData, setChartData] = useState<any[]>([]);
  const [chartPeriod, setChartPeriod] = useState<"week" | "month" | "year">("week");
  const [isGuest, setIsGuest] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [raceData, setRaceData] = useState<RaceData | null>(null);

  const greeting = getGreeting();

  useEffect(() => {
    const fetchUserParams = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        const guestFlag = localStorage.getItem("guestMode");
        if (guestFlag === "true") {
          setIsGuest(true);
          setUserName("ゲスト");
          setStats({
            streak_current: 0,
            streak_max: 0,
            total_xp: 0,
            level: 1,
            daily_goal_current: 0,
            daily_goal_target: 10,
          });
          setLoading(false);
          return;
        }
        router.push("/auth/login");
        return;
      }

      localStorage.removeItem("guestMode");
      setIsGuest(false);

      const onboardingDone = localStorage.getItem("onboarding_done");
      if (!onboardingDone) {
        setShowOnboarding(true);
      }

      let { data, error } = await supabase
        .from("user_stats")
        .select("*")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (!data) {
        const { data: newData, error: insertError } = await supabase
          .from("user_stats")
          .upsert({
            user_id: session.user.id,
            streak_current: 0,
            streak_max: 0,
            total_xp: 0,
            level: 1,
            daily_goal_current: 0,
            daily_goal_target: 10,
            last_activity_date: new Date().toISOString().split('T')[0]
          }, { onConflict: 'user_id' })
          .select()
          .single();

        if (newData) {
          data = newData;
        } else {
          console.error("Failed to initialize stats", insertError, insertError?.message);
        }
      }

      if (data) {
        setStats(data);
        setUserName(data.nickname || session.user.email?.split("@")[0] || "ユーザー");
      } else {
        setUserName(session.user.email?.split("@")[0] || "ユーザー");
      }

      // 毎日のタスク進捗を取得 (Server ActionでRLSを回避)
      try {
        const counts = await getDailyTasksCount(session.user.id);
        setWordReviewCount(counts.wordReviewCount);
        setWordTarget(counts.wordReviewTarget);
        setPart5Count(counts.part5Count);
        setPart5Target(counts.part5Target);
      } catch (err) {
        console.error("Failed to fetch daily tasks via server action", err);
      }

      // レースデータ取得
      try {
        const race = await getOrCreateWeeklyRace(session.user.id);
        setRaceData(race);
      } catch (err) {
        console.error("Failed to fetch race data", err);
      }

      setLoading(false);
    };

    const fetchChartData = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      let daysToSubtract = 7;
      if (chartPeriod === "month") daysToSubtract = 30;
      if (chartPeriod === "year") daysToSubtract = 365;

      const startDate = getJSTDateString(new Date(Date.now() - daysToSubtract * 24 * 60 * 60 * 1000));

      const { data: activityData } = await supabase
        .from("user_activity_logs")
        .select("activity_date, xp_earned")
        .eq("user_id", session.user.id)
        .gte("activity_date", startDate)
        .order("activity_date", { ascending: true });

      const dataMap = new Map<string, number>();
      (activityData ?? []).forEach((log: any) => {
        const key = log.activity_date;
        dataMap.set(key, (dataMap.get(key) || 0) + log.xp_earned);
      });

      if (chartPeriod === "year") {
        const now = new Date();
        const monthlyData: { name: string; xp: number }[] = [];
        const monthlyMap = new Map<string, number>();
        (activityData ?? []).forEach((log: any) => {
          const d = new Date(log.activity_date);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          monthlyMap.set(key, (monthlyMap.get(key) || 0) + log.xp_earned);
        });
        for (let i = 11; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          const label = d.toLocaleDateString("ja-JP", { month: "short" });
          monthlyData.push({ name: label, xp: monthlyMap.get(key) || 0 });
        }
        setChartData(monthlyData);
      } else if (chartPeriod === "month") {
        const result: { name: string; xp: number }[] = [];
        for (let i = 29; i >= 0; i--) {
          const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
          const dateKey = getJSTDateString(d);
          const label = d.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" });
          result.push({ name: label, xp: dataMap.get(dateKey) || 0 });
        }
        setChartData(result);
      } else {
        const result: { name: string; xp: number }[] = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
          const dateKey = getJSTDateString(d);
          const label = d.toLocaleDateString("ja-JP", { weekday: "short" });
          result.push({ name: label, xp: dataMap.get(dateKey) || 0 });
        }
        setChartData(result);
      }
    };

    if (loading) {
      fetchUserParams();
    }
    fetchChartData();
  }, [router, chartPeriod, loading]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--accent)] border-t-transparent"></div>
      </div>
    );
  }

  const currentXp = stats?.total_xp || 0;
  const xpForCurrentLevel = ((stats?.level || 1) - 1) * 1000;
  const xpForNextLevel = (stats?.level || 1) * 1000;
  const xpProgress = (currentXp - xpForCurrentLevel) / (xpForNextLevel - xpForCurrentLevel);

  const goalProgress = stats
    ? stats.daily_goal_target > 0
      ? stats.daily_goal_current / stats.daily_goal_target
      : 0
    : 0;
  const goalComplete = goalProgress >= 1;

  const streakLabel = getStreakLabel(stats?.streak_current || 0);

  return (
    <div className="pb-20">
      <OnboardingPopup isOpen={showOnboarding} onClose={() => setShowOnboarding(false)} />

      {/* ゲストモードバナー */}
      {isGuest && (
        <div className="mb-5 bg-amber-500/8 border border-amber-500/20 rounded-xl p-3.5 flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-amber-700 dark:text-amber-300">
              ゲストモードで利用中
            </p>
            <p className="text-[11px] text-amber-600/80 dark:text-amber-400/80">
              データの保存・記録はできません
            </p>
          </div>
          <button
            onClick={() => {
              localStorage.removeItem("guestMode");
              router.push("/auth/login");
            }}
            className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 text-white text-[12px] font-semibold rounded-lg hover:bg-amber-600 transition shrink-0"
          >
            <LogIn className="w-3.5 h-3.5" />
            ログイン
          </button>
        </div>
      )}

      {/* ヘッダー */}
      <header className="mb-6">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[13px] text-[var(--muted-foreground)] mb-0.5">{greeting.subText}</p>
              <h1 className="text-2xl font-bold text-[var(--foreground)] tracking-tight">
                {greeting.text}、<span className="text-[var(--accent)]">{userName}</span> さん
              </h1>
            </div>
            {(stats?.streak_current || 0) > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-orange-500/10 border border-orange-500/20">
                <Flame className="w-3.5 h-3.5 text-orange-500 fill-orange-500" />
                <span className="text-[12px] font-bold text-[var(--foreground)]">
                  {stats?.streak_current}日連続
                </span>
                {streakLabel && (
                  <span className="text-[11px]">{streakLabel}</span>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </header>

      {/* XPレベル (単独で表示) */}
      <div className="mb-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-[var(--card)] border border-[var(--border)] p-5 rounded-xl"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center">
                <Star className="w-3.5 h-3.5 text-[var(--accent)]" />
              </div>
              <span className="text-lg font-bold text-[var(--foreground)]">
                Lv. {stats?.level || 1}
              </span>
            </div>
            <div className="flex items-center gap-1 bg-[var(--accent)]/8 px-2 py-1 rounded-md">
              <Zap className="w-3 h-3 text-[var(--accent)]" />
              <span className="text-[12px] font-bold text-[var(--accent)]">
                {stats?.total_xp || 0} XP
              </span>
            </div>
          </div>
          <div className="mb-1.5">
            <div className="flex justify-between text-[11px] text-[var(--muted-foreground)] mb-1">
              <span>次のレベルまで</span>
              <span className="font-semibold">{xpForNextLevel - currentXp} XP</span>
            </div>
            <div className="h-2 bg-[var(--secondary)] rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-[var(--accent)]"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(xpProgress * 100, 100)}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>
          </div>
          <p className="text-[11px] text-[var(--muted-foreground)]">
            {currentXp - xpForCurrentLevel} / {xpForNextLevel - xpForCurrentLevel} XP
          </p>
        </motion.div>
      </div>

      {/* 統計カード */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <StatCard
          title="ストリーク"
          value={`${stats?.streak_current || 0} 日`}
          icon={Flame}
          accentColor="text-orange-500"
          delay={0.15}
          subtitle={stats?.streak_max ? `最高: ${stats.streak_max} 日` : undefined}
        />
        <StatCard
          title="合計 XP"
          value={stats?.total_xp || 0}
          icon={Zap}
          accentColor="text-[var(--accent)]"
          delay={0.25}
          subtitle={`Lv. ${stats?.level || 1}`}
        />
        <StatCard
          title="レベル"
          value={`Lv. ${stats?.level || 1}`}
          icon={Trophy}
          accentColor="text-violet-500"
          delay={0.3}
          subtitle={`次まで ${xpForNextLevel - currentXp} XP`}
        />
      </div>

      {/* 今日のタスク */}
      <div className="mb-8">
        <h2 className="text-base font-bold text-[var(--foreground)] flex items-center gap-2 mb-4">
          <CheckCircle2 className="w-5 h-5 text-[var(--accent)]" />
          今日のタスク
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ActionCard
            title="単語復習"
            desc="苦手な単語を重点的に復習します。忘却曲線に基づいた出題で効率よく暗記を進めましょう。"
            icon={Activity}
            accentColor="#22c55e"
            onClick={() => router.push("/words/review")}
            delay={0.35}
            disabled={false}
            current={wordReviewCount}
            target={wordTarget}
          />
          <ActionCard
            title="Part5 問題"
            desc="AIが自動生成するPart5形式の問題を解き、文法・語彙力を毎日鍛えましょう。"
            icon={BookOpen}
            accentColor="var(--accent)"
            onClick={() => router.push("/words/ai_teacher")}
            delay={0.4}
            disabled={false}
            current={part5Count}
            target={part5Target}
          />
        </div>
      </div>

      {/* レースウィジェット */}
      {!isGuest && raceData && raceData.myParticipant && (() => {
        const myCharType = (raceData.myParticipant.character_type || "cat") as CharacterType;
        const sorted = [...raceData.participants].sort((a, b) => b.distance - a.distance);
        const myRank = sorted.findIndex(p => p.user_id === raceData.myParticipant?.user_id) + 1;
        const userTotalXp = raceData.userTotalXp ?? 0;
        const maxDist = sorted[0]?.distance || 1;

        return (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.42 }}
            className="mb-8"
          >
            <button
              onClick={() => router.push("/words/race")}
              className="w-full bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 hover:border-[var(--accent)]/30 hover:shadow-md transition-all text-left group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-[var(--foreground)] flex items-center gap-2">
                    🏇 ウィークリーレース
                  </h2>
                  {raceData.rankInfo && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border" style={{
                      backgroundColor: `${raceData.rankInfo.color}15`,
                      borderColor: `${raceData.rankInfo.color}40`,
                      color: raceData.rankInfo.color,
                    }}>
                      {raceData.rankInfo.icon} {raceData.rankInfo.name}
                    </span>
                  )}
                </div>
                <div className="p-1.5 rounded-full bg-[var(--secondary)] text-[var(--muted-foreground)] group-hover:bg-[var(--accent)] group-hover:text-[var(--accent-foreground)] transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-center gap-4 mb-3">
                <div className="flex items-center gap-3">
                  <PixelCharacterMini type={myCharType} totalXp={userTotalXp} />
                  <div>
                    <div className="text-[13px] font-bold text-[var(--foreground)]">
                      {myRank === 1 ? "🥇 1位" : myRank === 2 ? "🥈 2位" : myRank === 3 ? "🥉 3位" : `${myRank}位`}
                      <span className="text-[var(--muted-foreground)] font-normal"> / {raceData.participants.length}人中</span>
                    </div>
                    <div className="text-[11px] text-[var(--muted-foreground)]">
                      今週 {raceData.myParticipant.distance.toLocaleString()} XP
                    </div>
                  </div>
                </div>
              </div>
              {/* ミニトラックビュー */}
              <div className="relative h-8 bg-[var(--secondary)]/60 rounded-lg overflow-visible">
                {[25, 50, 75].map(pct => (
                  <div key={pct} className="absolute top-0 bottom-0 w-px bg-[var(--border)]/40" style={{ left: `${pct}%` }} />
                ))}
                <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-amber-500/30" />
                {sorted.slice(0, 6).map((p, i) => {
                  const progress = maxDist > 0 ? Math.min((p.distance / maxDist) * 90, 90) : 2;
                  const isMe = p.user_id === raceData.myParticipant?.user_id;
                  const charType = (p.character_type || "cat") as CharacterType;
                  const cpuXp = p.cpu_total_xp ?? 5000;
                  return (
                    <motion.div
                      key={p.id}
                      className="absolute z-10"
                      style={{ top: `${10 + i * 12}%` }}
                      initial={{ left: 0 }}
                      animate={{ left: `${Math.max(progress, 2)}%` }}
                      transition={{ duration: 1.2, ease: "easeOut", delay: i * 0.05 }}
                    >
                      <div className={`-translate-x-1/2 text-[10px] ${isMe ? "opacity-100 scale-125" : "opacity-60"}`}>
                        {getCharacterDef(charType).stages[getStageIndex(isMe ? userTotalXp : cpuXp)].emoji}
                      </div>
                    </motion.div>
                  );
                })}
                <div className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] opacity-40">🏁</div>
              </div>
            </button>
          </motion.div>
        );
      })()}

      {/* チャート */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-[var(--foreground)] flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[var(--accent)]" />
            {chartPeriod === "week" ? "週間" : chartPeriod === "month" ? "月間" : "年間"}学習進捗
          </h2>
          <div className="flex gap-1">
            {(["week", "month", "year"] as const).map((period) => (
              <button
                key={period}
                onClick={() => setChartPeriod(period)}
                className={`px-3 py-1 rounded-md text-[12px] font-medium transition-colors ${
                  chartPeriod === period
                    ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--secondary)]"
                }`}
              >
                {period === "week" ? "週" : period === "month" ? "月" : "年"}
              </button>
            ))}
          </div>
        </div>
        {chartData.length > 0 ? (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 5, right: 5, left: -25, bottom: 0 }}
              >
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'var(--card)',
                    color: 'var(--foreground)',
                    boxShadow: '0 4px 12px rgb(0 0 0 / 0.1)',
                    fontSize: '12px',
                  }}
                  cursor={{ fill: 'transparent' }}
                />
                <Bar
                  dataKey="xp"
                  fill="var(--accent)"
                  radius={[4, 4, 4, 4]}
                  barSize={16}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-56 flex flex-col items-center justify-center text-[var(--muted-foreground)]">
            <Activity className="w-10 h-10 mb-2 opacity-20" />
            <p className="text-sm font-medium">まだデータがありません</p>
            <p className="text-[12px]">学習を始めると、ここに進捗が表示されます</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
