"use server";

import { createClient } from "@supabase/supabase-js";
import { getJSTDateString, getJSTYesterday } from "@/lib/utils";
import { updateRaceDistance } from "@/app/actions/race";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// Use Service Role Key to allow updating stats (bypass RLS)
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

export async function updateUserStats(userId: string, xpGained: number, questionsAnswered: number) {
    const today = getJSTDateString();

    // 1. Get current stats
    const { data: stats, error } = await supabase
        .from("user_stats")
        .select("*")
        .eq("user_id", userId)
        .single();

    if (error || !stats) {
        console.error("Error fetching stats:", error);
        return null;
    }

    // 2. Calculate new values
    let newStreak = stats.streak_current;
    let lastActivity = stats.last_activity_date;

    if (lastActivity !== today) {
        const yesterdayStr = getJSTYesterday();

        if (lastActivity === yesterdayStr) {
            newStreak += 1;
        } else {
            newStreak = 1; // Reset if broken, or 1 if new day
        }
    }

    const newTotalXP = stats.total_xp + xpGained;
    const newLevel = Math.floor(newTotalXP / 1000) + 1; // Simple level formula
    const newDailyGoalCurrent = (lastActivity === today ? stats.daily_goal_current : 0) + questionsAnswered;

    // 3. Update database
    const { data: updatedStats, error: updateError } = await supabase
        .from("user_stats")
        .update({
            streak_current: newStreak,
            streak_max: Math.max(newStreak, stats.streak_max),
            total_xp: newTotalXP,
            level: newLevel,
            daily_goal_current: newDailyGoalCurrent,
            last_activity_date: today,
        })
        .eq("user_id", userId)
        .select()
        .single();

    if (updateError) {
        console.error("Error updating stats:", updateError);
        return null;
    }

    // 4. Log activity for chart
    const { data: logData, error: logError } = await supabase
        .from("user_activity_logs")
        .select("id, xp_earned, questions_answered") // Added questions_answered to select
        .eq("user_id", userId)
        .eq("activity_date", today)
        .single();

    if (logData) {
        // Update existing log
        await supabase
            .from("user_activity_logs")
            .update({
                xp_earned: logData.xp_earned + xpGained,
                questions_answered: (logData.questions_answered || 0) + questionsAnswered
            })
            .eq("id", logData.id);
    } else {
        // Insert new log
        await supabase
            .from("user_activity_logs")
            .insert({
                user_id: userId,
                activity_date: today,
                xp_earned: xpGained,
                questions_answered: questionsAnswered
            });
    }

    // 5. Update race distance (1 XP = 1m)
    try {
        await updateRaceDistance(userId, xpGained);
    } catch (raceError) {
        // レース更新のエラーはスキップ（メインの学習を妨げない）
        console.error("Race distance update failed:", raceError);
    }

    return updatedStats;
}
