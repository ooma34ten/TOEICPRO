"use server";

import { createClient } from "@supabase/supabase-js";
import { getJSTDateString } from "@/lib/utils";
import { getDailyTasksCount } from "@/app/actions/getDailyTasks";
import { getOrCreateWeeklyRace } from "@/app/actions/race";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

export async function getDashboardData(userId: string, chartPeriod: "week" | "month" | "year") {
  // ユーザーステータス
  const { data: stats } = await supabaseAdmin
    .from("user_stats")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  // タスク進捗
  const dailyTasks = await getDailyTasksCount(userId);

  // レースデータ
  const raceData = await getOrCreateWeeklyRace(userId);

  // チャートデータ
  let daysToSubtract = 7;
  if (chartPeriod === "month") daysToSubtract = 30;
  if (chartPeriod === "year") daysToSubtract = 365;
  const startDate = getJSTDateString(new Date(Date.now() - daysToSubtract * 24 * 60 * 60 * 1000));
  const { data: activityData } = await supabaseAdmin
    .from("user_activity_logs")
    .select("activity_date, xp_earned")
    .eq("user_id", userId)
    .gte("activity_date", startDate)
    .order("activity_date", { ascending: true });

  // チャートデータ整形
  const dataMap = new Map<string, number>();
  (activityData ?? []).forEach((log: any) => {
    const key = log.activity_date;
    dataMap.set(key, (dataMap.get(key) || 0) + log.xp_earned);
  });
  let chartData: { name: string; xp: number }[] = [];
  if (chartPeriod === "year") {
    const now = new Date();
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
      chartData.push({ name: label, xp: monthlyMap.get(key) || 0 });
    }
  } else if (chartPeriod === "month") {
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dateKey = getJSTDateString(d);
      const label = d.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" });
      chartData.push({ name: label, xp: dataMap.get(dateKey) || 0 });
    }
  } else {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dateKey = getJSTDateString(d);
      const label = d.toLocaleDateString("ja-JP", { weekday: "short" });
      chartData.push({ name: label, xp: dataMap.get(dateKey) || 0 });
    }
  }

  return {
    stats,
    dailyTasks,
    raceData,
    chartData,
  };
}
