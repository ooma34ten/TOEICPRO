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
import { getDashboardData } from "@/app/actions/getDashboardData";
import { PixelCharacterMini } from "@/components/PixelCharacter";
import { getCharacterDef, getStageIndex, type CharacterType } from "@/lib/characters";
import { getPreviousDayCumulative } from "@/lib/raceUtils";

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
  isLoading = false,
}: {
  title: string;
  value: string | number;
  icon: any;
  subtitle?: string;
  accentColor?: string;
  delay?: number;
  isLoading?: boolean;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3, delay }}
    className="bg-card border border-border p-4 rounded-xl flex flex-col justify-between"
  >
    <div className="flex items-center justify-between mb-3">
      <Icon className={cn("w-4 h-4", accentColor)} />
      <span className="text-[11px] font-medium text-muted-foreground">
        {title}
      </span>
    </div>
    {isLoading ? (
      <>
        <div className="h-8 w-16 bg-secondary/80 animate-pulse rounded-lg mb-1" />
        <div className="h-3 w-20 bg-secondary/80 animate-pulse rounded-md" />
      </>
    ) : (
      <>
        <div className="text-2xl font-bold text-foreground">
          {value}
        </div>
        {subtitle && (
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {subtitle}
          </div>
        )}
      </>
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
  isLoading = false,
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
  isLoading?: boolean;
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
        "group text-left p-5 flex flex-col justify-between rounded-2xl transition-all w-full border bg-card relative overflow-hidden",
        disabled
          ? "opacity-40 cursor-not-allowed border-border"
          : isCompleted
            ? "border-emerald-500/30 hover:border-emerald-500/50 hover:shadow-[0_4px_12px_rgba(16,185,129,0.08)] bg-linear-to-br from-card to-emerald-500/5"
            : "border-border hover:border-(--accent)/30 hover:shadow-md hover:-translate-y-0.5"
      )}
    >
      {/* Background completion effect */}
      {isCompleted && (
        <div className="absolute top-0 right-0 p-12 -m-8 bg-linear-to-bl from-emerald-500/10 to-transparent rounded-full pointer-events-none" />
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
          <div className="p-1.5 rounded-full bg-secondary text-muted-foreground group-hover:bg-accent group-hover:text-accent-foreground transition-colors shadow-sm shrink-0">
            <ChevronRight className="w-4 h-4" />
          </div>
        )}
      </div>
      
      <div className="flex-1 w-full relative z-10">
        <h3 className="text-base font-bold text-foreground mb-1.5">{title}</h3>
        <p className="text-[12.5px] text-muted-foreground leading-relaxed mb-4">
          {desc}
        </p>
      </div>

      {isLoading ? (
        <div className="w-full mt-auto pt-3 border-t border-(--border)/70 relative z-10">
          <div className="flex justify-between items-end mb-2">
            <span className="text-[11px] font-medium text-muted-foreground">進捗</span>
            <div className="h-4 w-12 bg-secondary/80 animate-pulse rounded-md" />
          </div>
          <div className="h-1.5 w-full bg-secondary/80 animate-pulse rounded-full" />
        </div>
      ) : isTask && (
        <div className="w-full mt-auto pt-3 border-t border-(--border)/70 relative z-10">
          <div className="flex justify-between items-end mb-2">
            <span className="text-[11px] font-medium text-muted-foreground">進捗</span>
            <span className={cn("text-[13px] font-bold", isCompleted ? "text-emerald-600 dark:text-emerald-400" : "text-foreground")}> 
              {current} <span className="text-[10px] text-muted-foreground font-normal">/ {target}問</span>
            </span>
          </div>
          <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
            <motion.div
              className={cn("h-full rounded-full transition-all duration-1000", isCompleted ? "bg-emerald-500" : "bg-accent")}
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
  const [chartPeriod, setChartPeriod] = useState<"week" | "month" | "year">("week");
  const [isGuest, setIsGuest] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [dashboard, setDashboard] = useState<any>(null);

  const greeting = getGreeting();

  useEffect(() => {
    const fetchDashboard = async () => {
      setLoading(true);
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
      if (!onboardingDone) setShowOnboarding(true);
      const dash = await getDashboardData(session.user.id, chartPeriod);
      setDashboard(dash);
      setStats(dash.stats);
      setUserName(dash.stats?.nickname || session.user.email?.split("@")[0] || "ユーザー");
      setLoading(false);
    };
    fetchDashboard();
  }, [router, chartPeriod]);

  const currentXp = stats?.total_xp || 0;
  const xpForCurrentLevel = ((stats?.level || 1) - 1) * 1000;
  const xpForNextLevel = (stats?.level || 1) * 1000;
  const xpProgress = (currentXp - xpForCurrentLevel) / (xpForNextLevel - xpForCurrentLevel);
  const goalProgress = stats ? (stats.daily_goal_target > 0 ? stats.daily_goal_current / stats.daily_goal_target : 0) : 0;
  const goalComplete = goalProgress >= 1;
  const streakLabel = getStreakLabel(stats?.streak_current || 0);

  // --- 新しいdashboardデータを利用した描画 ---
  return (
    <div className="pb-20">
      <OnboardingPopup isOpen={showOnboarding} onClose={() => setShowOnboarding(false)} />
      {isGuest && (
        <div className="mb-5 bg-amber-500/8 border border-amber-500/20 rounded-xl p-3.5 flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-amber-700 dark:text-amber-300">ゲストモードで利用中</p>
            <p className="text-[11px] text-amber-600/80 dark:text-amber-400/80">データの保存・記録はできません</p>
          </div>
          <button
            onClick={() => {
              localStorage.removeItem("guestMode");
              router.push("/auth/login");
            }}
            className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 text-white text-[12px] font-semibold rounded-lg hover:bg-amber-600 transition shrink-0"
          >
            <LogIn className="w-3.5 h-3.5" />ログイン
          </button>
        </div>
      )}
      <header className="mb-6">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[13px] text-muted-foreground mb-0.5">{greeting.subText}</p>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">
                {greeting.text}、<span className="text-accent">{loading ? "..." : userName}</span> さん
              </h1>
            </div>
            {(stats?.streak_current || 0) > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-orange-500/10 border border-orange-500/20">
                <Flame className="w-3.5 h-3.5 text-orange-500 fill-orange-500" />
                <span className="text-[12px] font-bold text-foreground">{stats?.streak_current}日連続</span>
                {streakLabel && (<span className="text-[11px]">{streakLabel}</span>)}
              </div>
            )}
          </div>
        </motion.div>
      </header>
      {/* 今日のタスク */}
      <div className="mb-6">
        <h2 className="text-base font-bold text-foreground flex items-center gap-2 mb-4">
          <CheckCircle2 className="w-5 h-5 text-accent" />今日のタスク
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ActionCard
            title="単語復習"
            desc="苦手な単語を重点的に復習します。忘却曲線に基づいた出題で効率よく暗記を進めましょう。"
            icon={Activity}
            accentColor="#22c55e"
            onClick={() => router.push("/words/review")}
            delay={0.1}
            disabled={loading}
            isLoading={loading}
            current={dashboard?.dailyTasks?.wordReviewCount ?? 0}
            target={dashboard?.dailyTasks?.wordReviewTarget ?? 10}
          />
          <ActionCard
            title="Part5 問題"
            desc="AIが自動生成するPart5形式の問題を解き、文法・語彙力を毎日鍛えましょう。"
            icon={BookOpen}
            accentColor="var(--accent)"
            onClick={() => router.push("/words/ai_teacher")}
            delay={0.15}
            disabled={loading}
            isLoading={loading}
            current={dashboard?.dailyTasks?.part5Count ?? 0}
            target={dashboard?.dailyTasks?.part5Target ?? 10}
          />
        </div>
      </div>
      {/* XPレベル */}
      <div className="mb-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-card border border-border p-5 rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-(--accent)/10 flex items-center justify-center">
                <Star className="w-3.5 h-3.5 text-accent" />
              </div>
              <span className="text-lg font-bold text-foreground flex items-center gap-1">
                Lv. {loading ? <div className="h-6 w-8 bg-secondary/80 animate-pulse rounded-md inline-block mx-1" /> : (stats?.level || 1)}
              </span>
            </div>
            <div className="flex items-center gap-1 bg-(--accent)/8 px-2 py-1 rounded-md">
              <Zap className="w-3 h-3 text-accent" />
              <span className="text-[12px] font-bold text-accent">
                {loading ? <div className="h-4 w-10 bg-accent/20 animate-pulse rounded-sm inline-block align-middle mx-1" /> : `${stats?.total_xp || 0} XP`}
              </span>
            </div>
          </div>
          <div className="mb-1.5">
            <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
              <span>次のレベルまで</span>
              <span className="font-semibold">
                {loading ? <div className="h-3 w-12 bg-secondary/80 animate-pulse rounded-[4px] inline-block" /> : `${xpForNextLevel - currentXp} XP`}
              </span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <motion.div className="h-full rounded-full bg-accent" initial={{ width: 0 }} animate={{ width: `${loading ? 0 : Math.min(xpProgress * 100, 100)}%` }} transition={{ duration: 0.8, ease: "easeOut" }} />
            </div>
          </div>
          <div className="text-[11px] text-muted-foreground">
            {loading ? <div className="h-3 w-20 bg-secondary/80 animate-pulse rounded-[4px] inline-block mt-1" /> : `${currentXp - xpForCurrentLevel} / ${xpForNextLevel - xpForCurrentLevel} XP`}
          </div>
        </motion.div>
      </div>
      {/* 統計カード */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <StatCard title="ストリーク" value={`${stats?.streak_current || 0} 日`} icon={Flame} accentColor="text-orange-500" delay={0.25} isLoading={loading} subtitle={stats?.streak_max ? `最高: ${stats.streak_max} 日` : undefined} />
        <StatCard title="合計 XP" value={stats?.total_xp || 0} icon={Zap} accentColor="text-[var(--accent)]" delay={0.3} isLoading={loading} subtitle={`Lv. ${stats?.level || 1}`} />
        <StatCard title="レベル" value={`Lv. ${stats?.level || 1}`} icon={Trophy} accentColor="text-violet-500" delay={0.35} isLoading={loading} subtitle={`次まで ${xpForNextLevel - currentXp} XP`} />
      </div>
      {/* レースウィジェット */}
      {loading ? (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42 }} className="mb-8">
          <div className="w-full border rounded-xl p-5 bg-card border-border flex flex-col justify-between h-[132px]">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">🏇 ウィークリーレース</h2>
              <div className="p-1.5 rounded-full bg-secondary text-muted-foreground"><ChevronRight className="w-4 h-4" /></div>
            </div>
            <div className="flex justify-center items-center flex-1">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-accent border-t-transparent"></div>
            </div>
          </div>
        </motion.div>
      ) : (!isGuest && dashboard?.raceData && dashboard.raceData.myParticipant && (() => {
        const raceData = dashboard.raceData;
        const todayStr = getJSTDateString();
        const hasViewedToday = raceData.lastRaceViewDate === todayStr;
        const isMonday = raceData.dayOfWeek === 1;
        let targetParticipants = [...raceData.participants];
        let widgetTitle = "🏇 ウィークリーレース";
        if (!hasViewedToday) {
          if (isMonday && raceData.recapParticipants) {
            targetParticipants = [...raceData.recapParticipants];
            widgetTitle = "🏇 先週の最終結果 (未確認)";
          } else {
            targetParticipants = raceData.participants.map((p: import("@/app/actions/race").RaceParticipant) => {
              const prev = getPreviousDayCumulative(p.daily_progress || {}, raceData.dayOfWeek);
              return { ...p, distance: prev };
            });
            widgetTitle = "🏇 昨日の結果 (未確認)";
          }
        }
        const sorted = targetParticipants.sort((a, b) => b.distance - a.distance);
        const myRank = sorted.findIndex(p => p.user_id === raceData.myParticipant?.user_id) + 1;
        const myDisplayDistance = sorted.find(p => p.user_id === raceData.myParticipant?.user_id)?.distance || 0;
        const myCharType = (raceData.myParticipant.character_type || "cat") as CharacterType;
        const userTotalXp = raceData.userTotalXp ?? 0;
        const maxDist = sorted[0]?.distance || 1;
        return (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42 }} className="mb-8">
            <button onClick={() => router.push("/words/race")} className={`w-full border rounded-xl p-5 hover:border-(--accent)/30 hover:shadow-md transition-all text-left group relative overflow-hidden ${hasViewedToday ? "bg-card border-border" : "bg-(--muted)/50 border-border opacity-80 mix-blend-luminosity"}`}>
              {!hasViewedToday && (<div className="absolute top-3 right-3 text-[10px] font-bold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">NEW</div>)}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-foreground flex items-center gap-2">{widgetTitle}</h2>
                  {hasViewedToday && raceData.rankInfo && (<span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border" style={{ backgroundColor: `${raceData.rankInfo.color}15`, borderColor: `${raceData.rankInfo.color}40`, color: raceData.rankInfo.color }}>{raceData.rankInfo.icon} {raceData.rankInfo.name}</span>)}
                </div>
                <div className="p-1.5 rounded-full bg-secondary text-muted-foreground group-hover:bg-accent group-hover:text-accent-foreground transition-colors"><ChevronRight className="w-4 h-4" /></div>
              </div>
              <div className="flex items-center gap-4 mb-3">
                <div className="flex items-center gap-3">
                  <PixelCharacterMini type={myCharType} totalXp={userTotalXp} />
                  <div>
                    <div className="text-[13px] font-bold text-foreground">{hasViewedToday ? (<>{myRank === 1 ? "🥇 1位" : myRank === 2 ? "🥈 2位" : myRank === 3 ? "🥉 3位" : `${myRank}位`}<span className="text-muted-foreground font-normal"> / {raceData.participants.length}人中</span></>) : (<span className="text-amber-600/90 dark:text-amber-400 font-semibold flex items-center gap-1">👀 タップして順位を確認</span>)}</div>
                    {hasViewedToday && (<div className="text-[11px] text-muted-foreground mt-0.5">今週 {myDisplayDistance.toLocaleString()} XP</div>)}
                  </div>
                </div>
              </div>
              <div className={`relative h-8 bg-(--secondary)/60 rounded-lg overflow-visible transition-all duration-500 ${hasViewedToday ? '' : 'blur-sm opacity-50'}`}>
                {[25, 50, 75].map(pct => (<div key={pct} className="absolute top-0 bottom-0 w-px bg-(--border)/40" style={{ left: `${pct}%` }} />))}
                <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-amber-500/30" />
                {sorted.slice(0, 6).map((p, i) => {
                  const progress = maxDist > 0 ? Math.min((p.distance / maxDist) * 90, 90) : 2;
                  const isMe = p.user_id === raceData.myParticipant?.user_id;
                  const charType = (p.character_type || "cat") as CharacterType;
                  const cpuXp = p.cpu_total_xp ?? 5000;
                  return (<motion.div key={p.id} className="absolute z-10" style={{ top: `${10 + i * 12}%` }} initial={{ left: 0 }} animate={{ left: `${Math.max(progress, 2)}%` }} transition={{ duration: 1.2, ease: "easeOut", delay: i * 0.05 }}><div className={`-translate-x-1/2 text-[10px] ${isMe ? "opacity-100 scale-125" : "opacity-60"}`}>{getCharacterDef(charType).stages[getStageIndex(isMe ? userTotalXp : cpuXp)].emoji}</div></motion.div>);
                })}
                <div className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] opacity-40">🏁</div>
              </div>
            </button>
          </motion.div>
        );
      })())}
      {/* チャート */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2"><TrendingUp className="w-4 h-4 text-accent" />{chartPeriod === "week" ? "週間" : chartPeriod === "month" ? "月間" : "年間"}学習進捗</h2>
          <div className="flex gap-1">{(["week", "month", "year"] as const).map((period) => (<button key={period} onClick={() => setChartPeriod(period)} className={`px-3 py-1 rounded-md text-[12px] font-medium transition-colors ${chartPeriod === period ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-secondary"}`}>{period === "week" ? "週" : period === "month" ? "月" : "年"}</button>))}</div>
        </div>
        {loading ? (
          <div className="h-56 flex justify-center items-center text-muted-foreground">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent border-t-transparent"></div>
          </div>
        ) : dashboard?.chartData?.length > 0 ? (<div className="h-56 w-full"><ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}><BarChart data={dashboard.chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} /><YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} /><Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--foreground)', boxShadow: '0 4px 12px rgb(0 0 0 / 0.1)', fontSize: '12px', }} cursor={{ fill: 'transparent' }} /><Bar dataKey="xp" fill="var(--accent)" radius={[4, 4, 4, 4]} barSize={16} /></BarChart></ResponsiveContainer></div>) : (<div className="h-56 flex flex-col items-center justify-center text-muted-foreground"><Activity className="w-10 h-10 mb-2 opacity-20" /><p className="text-sm font-medium">まだデータがありません</p><p className="text-[12px]">学習を始めると、ここに進捗が表示されます</p></div>)}
      </motion.div>
    </div>
  );
}
