"use server";

import { createClient } from "@supabase/supabase-js";
import { getJSTDateString, getJSTYesterday } from "@/lib/utils";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

export async function getDailyTasksCount(userId: string) {
  try {
    const jstToday = getJSTDateString();
    const todayStart = new Date(`${jstToday}T00:00:00+09:00`).toISOString();

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString();

    const { data: recentTests } = await supabaseAdmin
      .from("test_results")
      .select("created_at, correct_count, accuracy")
      .eq("user_id", userId)
      .gte("created_at", thirtyDaysAgoStr);

    let part5Count = 0;
    let part5Target = 10;

    if (recentTests) {
      const p5DailyCounts: Record<string, number> = {};
      
      recentTests.forEach(t => {
        const jstDate = getJSTDateString(new Date(t.created_at));
        // ai_teacher は1問ごとに test_results レコードを作るため、1レコード = 1問
        p5DailyCounts[jstDate] = (p5DailyCounts[jstDate] || 0) + 1;
      });

      part5Count = p5DailyCounts[jstToday] || 0;
      
      const yesterdayStr = getJSTYesterday();
      let p5YesterdayCount = p5DailyCounts[yesterdayStr];

      if (p5YesterdayCount === undefined) {
        const sortedDates = Object.keys(p5DailyCounts).filter(d => d < jstToday).sort((a,b) => b.localeCompare(a));
        p5YesterdayCount = sortedDates.length > 0 ? p5DailyCounts[sortedDates[0]] : 0;
      }

      const p5Dates = Object.keys(p5DailyCounts);
      const p5Avg30 = p5Dates.length > 0 ? p5Dates.reduce((sum, d) => sum + p5DailyCounts[d], 0) / p5Dates.length : 0;
      
      const p5FirstRaw = Math.min(p5YesterdayCount, Math.ceil(p5Avg30));
      const p5SecondRaw = Math.max(p5YesterdayCount, Math.ceil(p5Avg30), 20);

      // Round to nearest 10 since ai_teacher issues 10 questions at a time
      const p5FirstTarget = Math.max(10, Math.ceil(p5FirstRaw / 10) * 10);
      const p5SecondTarget = Math.max(20, Math.ceil(p5SecondRaw / 10) * 10);

      part5Target = part5Count < p5FirstTarget ? p5FirstTarget : p5SecondTarget;
    }

    let wordReviewCount = 0;
    let wordReviewTarget = 10;

    try {
      const { data: progressData } = await supabaseAdmin.rpc("get_user_word_progress", { uid: userId });
      
      const rows = (progressData as { date: string; daily_correct: number }[]) ?? [];
      const todayCount = rows.find((r) => r.date === jstToday)?.daily_correct ?? 0;
      
      const yesterdayStr = getJSTYesterday();
      let yesterdayCount = rows.find((r) => r.date === yesterdayStr)?.daily_correct;
      if (yesterdayCount === undefined) {
        const prevRow = [...rows]
          .filter((r) => r.date < jstToday)
          .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
        yesterdayCount = prevRow?.daily_correct ?? 0;
      }
      
      const last30 = rows.slice(-30);
      const avg30 = last30.length > 0 ? last30.reduce((sum, r) => sum + r.daily_correct, 0) / last30.length : 0;
      
      const firstTarget = Math.min(yesterdayCount, Math.ceil(avg30));
      const secondTarget = Math.max(yesterdayCount, Math.ceil(avg30), 20);
      
      wordReviewCount = todayCount;
      // If current count < firstTarget, the goal is firstTarget. Else, secondTarget.
      wordReviewTarget = todayCount < firstTarget ? firstTarget : secondTarget;
      if (wordReviewTarget <= 0) wordReviewTarget = 20; // Fallback for edge cases
    } catch (err) {
      console.error("Error calculating word target", err);
    }

    return {
      wordReviewCount,
      wordReviewTarget,
      part5Count,
      part5Target,
    };
  } catch (error) {
    console.error("Failed to fetch daily tasks count:", error);
    return {
      wordReviewCount: 0,
      wordReviewTarget: 10,
      part5Count: 0,
      part5Target: 10,
    };
  }
}

