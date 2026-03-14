"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
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
    Quote,
} from "lucide-react";
import { cn, getJSTDateString } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import toast from "react-hot-toast";

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
}

// =============================
// 時間帯別グリーティング
// =============================
function getGreeting(): { text: string; emoji: string; subText: string } {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
        return {
            text: "おはようございます",
            emoji: "☀️",
            subText: "朝の学習は記憶に残りやすいです。今日も一歩前進しましょう！",
        };
    } else if (hour >= 12 && hour < 17) {
        return {
            text: "こんにちは",
            emoji: "💪",
            subText: "午後も集中して、目標に向かって進みましょう！",
        };
    } else if (hour >= 17 && hour < 21) {
        return {
            text: "おつかれさまです",
            emoji: "🌆",
            subText: "今日の復習を忘れずに。努力は必ず実を結びます！",
        };
    } else {
        return {
            text: "おつかれさまです",
            emoji: "🌙",
            subText: "夜の静かな時間に、じっくり学びましょう。",
        };
    }
}

// =============================
// モチベーション名言
// =============================
const MOTIVATIONAL_QUOTES = [
    { text: "千里の道も一歩から", author: "老子" },
    { text: "継続は力なり", author: "ことわざ" },
    { text: "努力は裏切らない", author: "ことわざ" },
    { text: "失敗は成功のもと", author: "ことわざ" },
    { text: "今日の一歩が、未来の大きな飛躍になる", author: "" },
    { text: "小さな進歩が、大きな成果を生む", author: "" },
    { text: "昨日の自分を超えよう", author: "" },
    { text: "学びに遅すぎることはない", author: "" },
    { text: "毎日の積み重ねが、あなたの実力になる", author: "" },
    { text: "目標を見失うな。一問一答が力になる", author: "" },
];

function getDailyQuote() {
    const today = new Date();
    const dayOfYear = Math.floor(
        (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000
    );
    return MOTIVATIONAL_QUOTES[dayOfYear % MOTIVATIONAL_QUOTES.length];
}

// =============================
// 円形プログレスリング
// =============================
const ProgressRing = ({
    progress,
    size = 120,
    strokeWidth = 8,
    color = "stroke-indigo-500",
    bgColor = "stroke-slate-200 dark:stroke-slate-700",
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
                    transition={{ duration: 1.2, ease: "easeOut" }}
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
// Components
// =============================

const StatCard = ({
    title,
    value,
    icon: Icon,
    color,
    delay = 0,
    subtitle,
}: {
    title: string;
    value: string | number;
    icon: any;
    color: string;
    delay?: number;
    subtitle?: string;
}) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay }}
        className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all"
    >
        <div className="flex items-center justify-between mb-4">
            <div className={cn("p-3 rounded-xl bg-opacity-10", color)}>
                <Icon className={cn("w-6 h-6", color.replace("bg-", "text-"))} />
            </div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full">
                {title}
            </span>
        </div>
        <div className="text-3xl font-bold text-slate-900 dark:text-white mb-1">
            {value}
        </div>
        <div className="text-sm text-slate-500 dark:text-slate-400">
            {subtitle || "たった今更新"}
        </div>
    </motion.div>
);

const ActionCard = ({
    title,
    desc,
    icon: Icon,
    gradient,
    onClick,
    delay = 0,
    disabled = false,
}: {
    title: string;
    desc: string;
    icon: any;
    gradient: string;
    onClick: () => void;
    delay?: number;
    disabled?: boolean;
}) => (
    <motion.button
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay }}
        onClick={(e: React.MouseEvent) => {
            if (disabled) {
                e.preventDefault();
                toast(`「${title}」は現在開発中です！\nリリースまで楽しみにお待ちください🚀`, {
                    icon: '🛠️',
                    style: {
                        borderRadius: '10px',
                        background: '#333',
                        color: '#fff',
                    },
                });
                return;
            }
            onClick();
        }}
        className={cn(
            "group relative overflow-hidden text-left p-6 rounded-3xl transition-all duration-300 w-full",
            gradient,
            disabled ? "grayscale opacity-60 cursor-not-allowed" : "transform hover:scale-[1.02] hover:shadow-xl"
        )}
    >
        <div className="absolute inset-0 bg-white/10 dark:bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="relative z-10 flex items-start justify-between">
            <div>
                <div className="bg-white/20 p-3 rounded-2xl inline-block mb-4 backdrop-blur-md">
                    <Icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">{title}</h3>
                <p className="text-white/80 text-sm font-medium leading-relaxed max-w-[90%]">
                    {desc}
                </p>
            </div>
            <div className="bg-white/20 p-2 rounded-full backdrop-blur-md transform group-hover:translate-x-1 transition-transform">
                <ChevronRight className="w-6 h-6 text-white" />
            </div>
        </div>
    </motion.button>
);

// =============================
// ストリークの色
// =============================
function getStreakStyle(streak: number) {
    if (streak >= 30) return { color: "text-violet-500", bgColor: "bg-violet-50 dark:bg-violet-900/30", borderColor: "border-violet-100 dark:border-violet-800", label: "🌈 伝説的！" };
    if (streak >= 14) return { color: "text-red-500", bgColor: "bg-red-50 dark:bg-red-900/30", borderColor: "border-red-100 dark:border-red-800", label: "🔥 すごい！" };
    if (streak >= 7) return { color: "text-orange-500", bgColor: "bg-orange-50 dark:bg-orange-900/30", borderColor: "border-orange-100 dark:border-orange-800", label: "💪 いい感じ！" };
    if (streak >= 3) return { color: "text-yellow-500", bgColor: "bg-yellow-50 dark:bg-yellow-900/30", borderColor: "border-yellow-100 dark:border-yellow-800", label: "✨ 調子いい！" };
    return { color: "text-slate-400", bgColor: "bg-slate-50 dark:bg-slate-800", borderColor: "border-slate-100 dark:border-slate-700", label: "" };
}

export default function Dashboard() {
    const router = useRouter();
    const [stats, setStats] = useState<UserStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [userName, setUserName] = useState("ゲスト");
    const [chartData, setChartData] = useState<any[]>([]);
    const [chartPeriod, setChartPeriod] = useState<"week" | "month" | "year">("week");

    const greeting = getGreeting();
    const dailyQuote = getDailyQuote();

    useEffect(() => {
        const fetchUserParams = async () => {
            const {
                data: { session },
            } = await supabase.auth.getSession();

            if (!session) {
                router.push("/auth/login");
                return;
            }

            setUserName(session.user.email?.split("@")[0] || "ユーザー");

            // Fetch real stats
            let { data, error } = await supabase
                .from("user_stats")
                .select("*")
                .eq("user_id", session.user.id)
                .maybeSingle();

            if (!data) {
                // Initialize stats if they don't exist
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

            // アクティビティデータをMapに変換
            const dataMap = new Map<string, number>();
            (activityData ?? []).forEach((log: any) => {
                const key = log.activity_date;
                dataMap.set(key, (dataMap.get(key) || 0) + log.xp_earned);
            });

            if (chartPeriod === "year") {
                // 年間表示: 過去12ヶ月を0埋め
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
                // 月間表示: 過去30日を0埋め
                const result: { name: string; xp: number }[] = [];
                for (let i = 29; i >= 0; i--) {
                    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
                    const dateKey = getJSTDateString(d);
                    const label = d.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" });
                    result.push({ name: label, xp: dataMap.get(dateKey) || 0 });
                }
                setChartData(result);
            } else {
                // 週間表示: 過去7日を0埋め
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
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    // XP Progress
    const currentXp = stats?.total_xp || 0;
    const xpForCurrentLevel = ((stats?.level || 1) - 1) * 1000;
    const xpForNextLevel = (stats?.level || 1) * 1000;
    const xpProgress = (currentXp - xpForCurrentLevel) / (xpForNextLevel - xpForCurrentLevel);

    // Daily Goal Progress
    const goalProgress = stats
        ? stats.daily_goal_target > 0
            ? stats.daily_goal_current / stats.daily_goal_target
            : 0
        : 0;
    const goalComplete = goalProgress >= 1;

    // Streak Style
    const streakStyle = getStreakStyle(stats?.streak_current || 0);

    return (
        <div className="min-h-screen pb-20">
            {/* Header Section */}
            <header className="mb-8">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between"
                >
                    <div>
                        <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-2">
                            {greeting.text}、<span className="text-indigo-600 dark:text-indigo-400">{userName}</span> さん {greeting.emoji}
                        </h1>
                        <p className="text-slate-600 dark:text-slate-400 text-lg">
                            {greeting.subText}
                        </p>
                    </div>
                    <div className="hidden sm:block">
                        <div className={cn(
                            "flex items-center space-x-2 px-4 py-2 rounded-full border transition-all",
                            streakStyle.bgColor, streakStyle.borderColor,
                            (stats?.streak_current || 0) >= 3 && "animate-pulse-glow"
                        )}>
                            <Flame className={cn(
                                "w-5 h-5 fill-current",
                                streakStyle.color,
                                (stats?.streak_current || 0) >= 7 && "animate-streak-fire"
                            )} />
                            <span className="font-bold text-slate-900 dark:text-slate-100">
                                {stats?.streak_current || 0} 日連続
                            </span>
                            {streakStyle.label && (
                                <span className="text-xs font-medium">{streakStyle.label}</span>
                            )}
                        </div>
                    </div>
                </motion.div>
            </header>

            {/* Daily Goal Ring + XP Progress Row */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8"
            >
                {/* 今日の目標リング */}
                <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm flex items-center gap-6">
                    <ProgressRing
                        progress={goalProgress}
                        size={100}
                        strokeWidth={8}
                        color={goalComplete ? "stroke-emerald-500" : "stroke-indigo-500"}
                    >
                        <div className="text-center">
                            {goalComplete ? (
                                <div className="animate-float">
                                    <Trophy className="w-8 h-8 text-emerald-500 mx-auto" />
                                </div>
                            ) : (
                                <>
                                    <div className="text-xl font-extrabold text-slate-900 dark:text-white">
                                        {stats?.daily_goal_current || 0}
                                    </div>
                                    <div className="text-[10px] text-slate-400">
                                        / {stats?.daily_goal_target || 10}
                                    </div>
                                </>
                            )}
                        </div>
                    </ProgressRing>
                    <div className="flex-1">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                            今日の目標
                        </h3>
                        {goalComplete ? (
                            <p className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                                <Sparkles className="w-4 h-4" />
                                達成おめでとう！素晴らしい！🎉
                            </p>
                        ) : (
                            <p className="text-slate-500 dark:text-slate-400 text-sm">
                                あと <span className="font-bold text-indigo-600 dark:text-indigo-400">{Math.max(0, (stats?.daily_goal_target || 10) - (stats?.daily_goal_current || 0))}</span> 問で目標達成！
                            </p>
                        )}
                    </div>
                </div>

                {/* XPレベルアッププログレス */}
                <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <div className="p-2 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 shadow-lg shadow-yellow-200 dark:shadow-yellow-900/30">
                                <Star className="w-5 h-5 text-white fill-white" />
                            </div>
                            <div>
                                <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
                                    Lv. {stats?.level || 1}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-1 bg-yellow-50 dark:bg-yellow-900/20 px-3 py-1.5 rounded-full">
                            <Zap className="w-4 h-4 text-yellow-500" />
                            <span className="text-sm font-bold text-yellow-700 dark:text-yellow-300">
                                {stats?.total_xp || 0} XP
                            </span>
                        </div>
                    </div>
                    <div className="mb-2">
                        <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                            <span>次のレベルまで</span>
                            <span className="font-bold">{xpForNextLevel - currentXp} XP</span>
                        </div>
                        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <motion.div
                                className="h-full rounded-full bg-gradient-to-r from-yellow-400 via-orange-400 to-pink-500 animate-shimmer"
                                style={{
                                    backgroundImage: "linear-gradient(90deg, #facc15, #fb923c, #ec4899, #facc15)",
                                }}
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(xpProgress * 100, 100)}%` }}
                                transition={{ duration: 1, ease: "easeOut" }}
                            />
                        </div>
                    </div>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                        {currentXp - xpForCurrentLevel} / {xpForNextLevel - xpForCurrentLevel} XP
                    </p>
                </div>
            </motion.div>

            {/* 名言カード */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mb-8"
            >
                <div className="bg-gradient-to-r from-indigo-500/10 via-violet-500/10 to-purple-500/10 dark:from-indigo-900/30 dark:via-violet-900/30 dark:to-purple-900/30 border border-indigo-100 dark:border-indigo-900/50 rounded-2xl p-5 flex items-start gap-4">
                    <div className="p-2.5 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 shrink-0">
                        <Quote className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                        <p className="text-lg font-bold text-slate-900 dark:text-white mb-1 italic">
                            「{dailyQuote.text}」
                        </p>
                        {dailyQuote.author && (
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                — {dailyQuote.author}
                            </p>
                        )}
                    </div>
                </div>
            </motion.div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                <StatCard
                    title="現在のストリーク"
                    value={`${stats?.streak_current || 0} 日`}
                    icon={Flame}
                    color="bg-orange-500 text-orange-500"
                    delay={0.3}
                    subtitle={stats?.streak_max ? `最高記録: ${stats.streak_max} 日` : ""}
                />
                <StatCard
                    title="今日の目標"
                    value={`${stats?.daily_goal_current || 0} / ${stats?.daily_goal_target || 10}`}
                    icon={Target}
                    color="bg-emerald-500 text-emerald-500"
                    delay={0.4}
                    subtitle={goalComplete ? "🎉 達成済み！" : `残り ${Math.max(0, (stats?.daily_goal_target || 10) - (stats?.daily_goal_current || 0))} 問`}
                />
                <StatCard
                    title="合計 XP"
                    value={stats?.total_xp || 0}
                    icon={Zap}
                    color="bg-yellow-500 text-yellow-500"
                    delay={0.5}
                    subtitle={`Lv. ${stats?.level || 1}`}
                />
                <StatCard
                    title="現在のレベル"
                    value={`Lv. ${stats?.level || 1}`}
                    icon={Trophy}
                    color="bg-indigo-500 text-indigo-500"
                    delay={0.6}
                    subtitle={`次のレベルまで ${xpForNextLevel - currentXp} XP`}
                />
            </div>

            {/* Main Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                <ActionCard
                    title="AI講師モード"
                    desc="AIとの英会話で実践的なスピーキングとリスニング力を鍛えましょう。"
                    icon={BookOpen}
                    gradient="bg-gradient-to-br from-indigo-600 to-violet-600"
                    onClick={() => router.push("/words/ai_teacher")}
                    delay={0.7}
                    disabled={true}
                />
                <ActionCard
                    title="スマート復習"
                    desc="苦手な単語を重点的に復習。忘却曲線に基づいた効率的な学習が可能です。"
                    icon={Activity}
                    gradient="bg-gradient-to-br from-emerald-500 to-teal-600"
                    onClick={() => router.push("/words/questions")}
                    delay={0.8}
                    disabled={true}
                />
            </div>

            {/* Progress Section */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 }}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-sm"
            >
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <TrendingUp className="w-6 h-6 text-indigo-500" />
                        {chartPeriod === "week" ? "週間" : chartPeriod === "month" ? "月間" : "年間"}学習進捗
                    </h2>
                    <select
                        value={chartPeriod}
                        onChange={(e) => setChartPeriod(e.target.value as "week" | "month" | "year")}
                        className="bg-slate-100 dark:bg-slate-800 border-none text-slate-600 dark:text-slate-400 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    >
                        <option value="week">今週</option>
                        <option value="month">今月</option>
                        <option value="year">今年</option>
                    </select>
                </div>
                {chartData.length > 0 ? (
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={chartData}
                                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                            >
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                                />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    cursor={{ fill: 'transparent' }}
                                />
                                <Bar
                                    dataKey="xp"
                                    fill="#4f46e5"
                                    radius={[6, 6, 6, 6]}
                                    barSize={20}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="h-64 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                        <Activity className="w-12 h-12 mb-3 opacity-30" />
                        <p className="font-medium">まだデータがありません</p>
                        <p className="text-sm">学習を始めると、ここに進捗が表示されます！</p>
                    </div>
                )}
            </motion.div>
        </div>
    );
}
