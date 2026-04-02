"use server";

import { createClient } from "@supabase/supabase-js";
import { getJSTDateString } from "@/lib/utils";
import type { CharacterType } from "@/lib/characters";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// =============================
// 定数
// =============================
const RACE_GOAL = 10000; // ゴール距離
const TOTAL_PARTICIPANTS = 10; // 合計参加者数
const CHARACTER_TYPES: CharacterType[] = ["cat", "dog", "rabbit", "fox", "bear", "panda", "lion", "frog"];

const CPU_NAMES = [
  "ハナコ", "タロウ", "サクラ", "ケンタ", "ミキ",
  "ユウト", "アオイ", "レン", "ヒナタ", "ソラ",
  "リコ", "カイト", "メイ", "シュウ", "ノア",
];

// CPU の1日あたりのペース（XP相当）: 変動あり
const CPU_PACE_RANGES = [
  { min: 900, max: 1400 },  // 超強
  { min: 700, max: 1100 },  // 強め
  { min: 500, max: 900 },   // 普通
  { min: 300, max: 700 },   // 弱め
  { min: 150, max: 450 },   // とても弱い
];

// =============================
// ヘルパー
// =============================

/** 今週の月曜日（JST）を取得 */
function getWeekStart(date?: Date): string {
  const d = date ?? new Date();
  // JST に変換
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const day = jst.getUTCDay(); // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? 6 : day - 1; // 月曜からの差分
  const monday = new Date(jst);
  monday.setUTCDate(monday.getUTCDate() - diff);
  return `${monday.getUTCFullYear()}-${String(monday.getUTCMonth() + 1).padStart(2, "0")}-${String(monday.getUTCDate()).padStart(2, "0")}`;
}

/** 今週の残り時間（ミリ秒） */
function getTimeRemainingMs(): number {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const day = jst.getUTCDay();
  const daysUntilMonday = day === 0 ? 1 : (8 - day);

  const nextMonday = new Date(jst);
  nextMonday.setUTCDate(nextMonday.getUTCDate() + daysUntilMonday);
  nextMonday.setUTCHours(0, 0, 0, 0);

  // UTC に戻す
  const nextMondayUTC = new Date(nextMonday.getTime() - 9 * 60 * 60 * 1000);
  return Math.max(0, nextMondayUTC.getTime() - now.getTime());
}

/** ランダム整数 */
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// =============================
// 公開型定義
// =============================

export type RaceParticipant = {
  id: string;
  user_id: string | null;
  week_start: string;
  distance: number;
  character_emoji: string;
  character_type: string;
  display_name: string;
  is_cpu: boolean;
  finished_at: string | null;
  cpu_total_xp?: number;
};

export type RaceData = {
  participants: RaceParticipant[];
  myParticipant: RaceParticipant | null;
  raceGoal: number;
  timeRemainingMs: number;
  weekStart: string;
  todayXp: number;
  userTotalXp: number;
};

export type RaceHistoryItem = {
  week_start: string;
  final_rank: number;
  final_distance: number;
  total_participants: number;
};

// =============================
// 公開アクション
// =============================

/** 今週のレースを取得/作成 */
export async function getOrCreateWeeklyRace(userId: string): Promise<RaceData> {
  const weekStart = getWeekStart();

  // 前週の結果を保存（まだの場合）
  await finalizeLastWeek(userId);

  // ユーザーの参加レコードを取得
  const { data: existing } = await supabase
    .from("race_participants")
    .select("*")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .maybeSingle();

  // ユーザーの累計XPを取得
  const { data: userStats } = await supabase
    .from("user_stats")
    .select("nickname, character_emoji, character_type, total_xp")
    .eq("user_id", userId)
    .single();

  const userTotalXp = userStats?.total_xp ?? 0;

  if (!existing) {
    // ユーザーの情報を取得
    const { data: userData } = await supabase.auth.admin.getUserById(userId);
    const displayName = userStats?.nickname || userData?.user?.email?.split("@")[0] || "プレイヤー";
    const characterEmoji = userStats?.character_emoji || "🐱";
    const characterType = userStats?.character_type || "cat";

    // ユーザーを登録
    await supabase.from("race_participants").insert({
      user_id: userId,
      week_start: weekStart,
      distance: 0,
      character_emoji: characterEmoji,
      character_type: characterType,
      display_name: displayName,
      is_cpu: false,
    });

    // 今週のCPUがなければ作成
    const { data: cpuExists } = await supabase
      .from("race_participants")
      .select("id")
      .eq("week_start", weekStart)
      .eq("is_cpu", true)
      .limit(1);

    if (!cpuExists || cpuExists.length === 0) {
      // リアルプレイヤー数を確認
      const { data: realPlayers } = await supabase
        .from("race_participants")
        .select("id")
        .eq("week_start", weekStart)
        .eq("is_cpu", false);

      const realCount = realPlayers?.length ?? 1;
      const cpuCount = Math.max(0, TOTAL_PARTICIPANTS - realCount);
      await createCpuParticipants(weekStart, characterType, cpuCount);
    }
  }

  // CPU の進行を更新（1日1回程度）
  await advanceCpuParticipants(weekStart);

  // 全参加者取得
  const { data: participants } = await supabase
    .from("race_participants")
    .select("*")
    .eq("week_start", weekStart)
    .order("distance", { ascending: false });

  // 今日のXPを取得
  const todayStr = getJSTDateString();
  const { data: todayLog } = await supabase
    .from("user_activity_logs")
    .select("xp_earned")
    .eq("user_id", userId)
    .eq("activity_date", todayStr)
    .maybeSingle();

  const allParticipants = (participants ?? []) as RaceParticipant[];
  const myParticipant = allParticipants.find(p => p.user_id === userId) ?? null;

  return {
    participants: allParticipants,
    myParticipant,
    raceGoal: RACE_GOAL,
    timeRemainingMs: getTimeRemainingMs(),
    weekStart,
    todayXp: todayLog?.xp_earned ?? 0,
    userTotalXp,
  };
}

/** レース距離を更新 */
export async function updateRaceDistance(userId: string, xpGained: number) {
  const weekStart = getWeekStart();

  const { data: participant } = await supabase
    .from("race_participants")
    .select("id, distance, finished_at")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .maybeSingle();

  if (!participant) return; // レースに参加していない場合はスキップ
  if (participant.finished_at) return; // 既にゴール済み

  const newDistance = participant.distance + xpGained;
  const updates: Record<string, unknown> = { distance: newDistance };

  if (newDistance >= RACE_GOAL) {
    updates.finished_at = new Date().toISOString();
  }

  await supabase
    .from("race_participants")
    .update(updates)
    .eq("id", participant.id);
}

/** キャラクタータイプ変更 */
export async function updateCharacterType(userId: string, characterType: CharacterType) {
  // user_stats のキャラを更新
  await supabase
    .from("user_stats")
    .update({ character_type: characterType })
    .eq("user_id", userId);

  // 今週のレース参加者のキャラも更新
  const weekStart = getWeekStart();
  await supabase
    .from("race_participants")
    .update({ character_type: characterType })
    .eq("user_id", userId)
    .eq("week_start", weekStart);
}

/** レース履歴を取得 */
export async function getRaceHistory(userId: string): Promise<RaceHistoryItem[]> {
  const { data } = await supabase
    .from("race_history")
    .select("week_start, final_rank, final_distance, total_participants")
    .eq("user_id", userId)
    .order("week_start", { ascending: false })
    .limit(10);

  return (data ?? []) as RaceHistoryItem[];
}

// =============================
// 内部関数
// =============================

/** CPU参加者を作成 */
async function createCpuParticipants(weekStart: string, userCharType: string, cpuCount: number) {
  const usedTypes = new Set([userCharType]);
  const usedNames = new Set<string>();
  const cpuInserts = [];

  for (let i = 0; i < cpuCount; i++) {
    // ユニークなキャラクタータイプを選択
    let charType = CHARACTER_TYPES[Math.floor(Math.random() * CHARACTER_TYPES.length)];
    let attempts = 0;
    while (usedTypes.has(charType) && attempts < 20) {
      charType = CHARACTER_TYPES[Math.floor(Math.random() * CHARACTER_TYPES.length)];
      attempts++;
    }
    usedTypes.add(charType);

    // ユニークな名前を選択
    let name = CPU_NAMES[Math.floor(Math.random() * CPU_NAMES.length)];
    attempts = 0;
    while (usedNames.has(name) && attempts < 20) {
      name = CPU_NAMES[Math.floor(Math.random() * CPU_NAMES.length)];
      attempts++;
    }
    usedNames.add(name);

    const paceRange = CPU_PACE_RANGES[i % CPU_PACE_RANGES.length];
    const dailyPace = randInt(paceRange.min, paceRange.max);

    // CPUの仮想XPレベル (キャラ進化用)
    const cpuTotalXp = randInt(500, 60000);

    // 週の途中から参加した場合、過去日分のCPU距離を計算
    const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const weekStartDate = new Date(weekStart + "T00:00:00Z");
    const daysSinceStart = Math.floor((jst.getTime() - weekStartDate.getTime()) / (1000 * 60 * 60 * 24));
    const initialDistance = daysSinceStart > 0 ? dailyPace * daysSinceStart + randInt(-200, 200) : 0;

    cpuInserts.push({
      user_id: null,
      week_start: weekStart,
      distance: Math.max(0, Math.min(initialDistance, RACE_GOAL)),
      character_emoji: "🤖",
      character_type: charType,
      display_name: `CPU ${name}`,
      is_cpu: true,
      cpu_daily_pace: dailyPace,
      cpu_total_xp: cpuTotalXp,
    });
  }

  if (cpuInserts.length > 0) {
    await supabase.from("race_participants").insert(cpuInserts);
  }
}

/** CPUを1日分進行させる */
async function advanceCpuParticipants(weekStart: string) {
  const { data: cpus } = await supabase
    .from("race_participants")
    .select("*")
    .eq("week_start", weekStart)
    .eq("is_cpu", true);

  if (!cpus || cpus.length === 0) return;

  const now = new Date();

  for (const cpu of cpus) {
    if (cpu.finished_at) continue;

    const weekStartDate = new Date(weekStart + "T00:00:00+09:00");
    const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);

    // 週開始からの経過日数
    const daysPassed = Math.floor((jstNow.getTime() - weekStartDate.getTime()) / (1000 * 60 * 60 * 24));

    // CPUの予定距離 (ランダム誤差あり)
    const expectedDistance = cpu.cpu_daily_pace * daysPassed + randInt(-100, 100);
    const newDistance = Math.max(cpu.distance, Math.min(expectedDistance, RACE_GOAL));

    if (newDistance !== cpu.distance) {
      const updates: Record<string, unknown> = { distance: newDistance };
      if (newDistance >= RACE_GOAL) {
        updates.finished_at = now.toISOString();
      }

      await supabase
        .from("race_participants")
        .update(updates)
        .eq("id", cpu.id);
    }
  }
}

/** 先週のレース結果を確定・保存 */
async function finalizeLastWeek(userId: string) {
  const lastWeekDate = new Date();
  lastWeekDate.setDate(lastWeekDate.getDate() - 7);
  const lastWeekStart = getWeekStart(lastWeekDate);
  const thisWeekStart = getWeekStart();

  // 今週と同じなら先週は無い
  if (lastWeekStart === thisWeekStart) return;

  // 既に保存済みか確認
  const { data: historyExists } = await supabase
    .from("race_history")
    .select("id")
    .eq("user_id", userId)
    .eq("week_start", lastWeekStart)
    .maybeSingle();

  if (historyExists) return;

  // 先週の参加者を取得
  const { data: lastWeekParticipants } = await supabase
    .from("race_participants")
    .select("*")
    .eq("week_start", lastWeekStart)
    .order("distance", { ascending: false });

  if (!lastWeekParticipants || lastWeekParticipants.length === 0) return;

  // ユーザーの順位を計算
  const userEntry = lastWeekParticipants.find(p => p.user_id === userId);
  if (!userEntry) return;

  const rank = lastWeekParticipants.findIndex(p => p.user_id === userId) + 1;

  await supabase.from("race_history").insert({
    user_id: userId,
    week_start: lastWeekStart,
    final_rank: rank,
    final_distance: userEntry.distance,
    total_participants: lastWeekParticipants.length,
  });
}
