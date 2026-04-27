"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath, unstable_noStore as noStore } from "next/cache";
import { getJSTDateString } from "@/lib/utils";
import { getCharacterDef, type CharacterType } from "@/lib/characters";
import { RANK_DEFS, getRankInfo, getAllRankDefs, getPreviousDayCumulative, type RankInfo } from "@/lib/raceUtils";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// =============================
// 定数
// =============================
const TOTAL_PARTICIPANTS = 10;
const CHARACTER_TYPES: CharacterType[] = ["cat", "dog", "rabbit", "fox", "bear", "panda", "lion", "frog"];

const CPU_NAMES = [
  "ハナコ", "タロウ", "サクラ", "ケンタ", "ミキ",
  "ユウト", "アオイ", "レン", "ヒナタ", "ソラ",
  "リコ", "カイト", "メイ", "シュウ", "ノア",
];

/** ランクに応じたCPUのペース範囲を返す */
function getCpuPaceForRank(rank: number): { min: number; max: number }[] {
  const rankInfo = RANK_DEFS.find(r => r.rank === rank) || RANK_DEFS[RANK_DEFS.length - 1];
  const target = rankInfo.weeklyTarget;
  // CPUは目標前後の強さ (1日あたり = 週目標 / 7)
  const dailyBase = Math.round(target / 7);
  return [
    { min: Math.round(dailyBase * 1.1), max: Math.round(dailyBase * 1.5) },  // 強い
    { min: Math.round(dailyBase * 0.9), max: Math.round(dailyBase * 1.2) },  // やや強い
    { min: Math.round(dailyBase * 0.7), max: Math.round(dailyBase * 1.0) },  // 普通
    { min: Math.round(dailyBase * 0.5), max: Math.round(dailyBase * 0.8) },  // やや弱い
    { min: Math.round(dailyBase * 0.3), max: Math.round(dailyBase * 0.6) },  // 弱い
    { min: Math.round(dailyBase * 0.2), max: Math.round(dailyBase * 0.5) },  // とても弱い
    { min: Math.round(dailyBase * 0.8), max: Math.round(dailyBase * 1.1) },  // 中上
    { min: Math.round(dailyBase * 0.6), max: Math.round(dailyBase * 0.9) },  // 中下
    { min: Math.round(dailyBase * 0.4), max: Math.round(dailyBase * 0.7) },  // 弱中
  ];
}

// =============================
// ヘルパー
// =============================

/** 今週の月曜日（JST）を取得 */
function getWeekStart(date?: Date): string {
  const d = date ?? new Date();
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const day = jst.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(jst);
  monday.setUTCDate(monday.getUTCDate() - diff);
  return `${monday.getUTCFullYear()}-${String(monday.getUTCMonth() + 1).padStart(2, "0")}-${String(monday.getUTCDate()).padStart(2, "0")}`;
}

/** 今週の残り時間（ミリ秒）— 日曜23:59:59まで */
function getTimeRemainingMs(): number {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const day = jst.getUTCDay();
  const daysUntilMonday = day === 0 ? 1 : (8 - day);
  const nextMonday = new Date(jst);
  nextMonday.setUTCDate(nextMonday.getUTCDate() + daysUntilMonday);
  nextMonday.setUTCHours(0, 0, 0, 0);
  const nextMondayUTC = new Date(nextMonday.getTime() - 9 * 60 * 60 * 1000);
  return Math.max(0, nextMondayUTC.getTime() - now.getTime());
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** 現在JST何日目（月=1, 火=2, ..., 日=7） */
function getDayOfWeek(): number {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const day = jst.getUTCDay();
  return day === 0 ? 7 : day;
}

function generateUuid(): string {
  if (typeof globalThis?.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `${Math.floor(Math.random() * 0xffff).toString(16).padStart(4, "0")}-${Math.floor(Math.random() * 0xffff).toString(16).padStart(4, "0")}`;
}

function getCharacterEmoji(type: CharacterType): string {
  const def = getCharacterDef(type);
  return def.stages[0]?.emoji || "🐱";
}

async function findOrCreateRaceIdForUser(weekStart: string, userId: string): Promise<string> {
  const { data: existing } = await supabase
    .from("race_participants")
    .select("race_id")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .maybeSingle();

  if (existing?.race_id) {
    return existing.race_id;
  }

  const { data: raceRows } = await supabase
    .from("race_participants")
    .select("race_id")
    .eq("week_start", weekStart);

  const counts: Record<string, number> = {};
  (raceRows ?? []).forEach((row: any) => {
    if (!row.race_id) return;
    counts[row.race_id] = (counts[row.race_id] || 0) + 1;
  });

  const openRace = Object.entries(counts).find(([, count]) => count < TOTAL_PARTICIPANTS);
  if (openRace) {
    return openRace[0];
  }

  return generateUuid();
}

async function fillRaceWithCpuParticipants(weekStart: string, raceId: string, seedCharacterType: string, userRank: number) {
  const { data: current } = await supabase
    .from("race_participants")
    .select("id, is_cpu")
    .eq("week_start", weekStart)
    .eq("race_id", raceId);

  const currentCount = (current ?? []).length;
  const cpuCount = Math.max(0, TOTAL_PARTICIPANTS - currentCount);
  if (cpuCount <= 0) return;

  await createCpuParticipants(weekStart, raceId, seedCharacterType, cpuCount, userRank);
}

async function createUserRaceParticipant(userId: string, weekStart: string, raceId: string, characterEmoji: string, characterType: string, displayName: string) {
  await supabase.from("race_participants").insert({
    user_id: userId,
    week_start: weekStart,
    race_id: raceId,
    distance: 0,
    character_emoji: characterEmoji,
    character_type: characterType,
    display_name: displayName,
    is_cpu: false,
    daily_progress: {},
  });
}

// =============================
// 公開型定義
// =============================

export type RaceParticipant = {
  id: string;
  user_id: string | null;
  week_start: string;
  race_id: string;
  distance: number;
  character_emoji: string;
  character_type: string;
  display_name: string;
  is_cpu: boolean;
  finished_at: string | null;
  cpu_total_xp?: number;
  cpu_daily_pace?: number;
  last_cpu_advance_date?: string;
  daily_progress?: Record<string, number>;
};

export type RaceData = {
  participants: RaceParticipant[];
  myParticipant: RaceParticipant | null;
  weeklyTarget: number;
  timeRemainingMs: number;
  weekStart: string;
  todayXp: number;
  userTotalXp: number;
  userRank: number;
  rankInfo: RankInfo;
  dayOfWeek: number;
  lastRaceViewDate?: string | null;
  raceId: string | null;
  characterGachaDone: boolean;
  recapParticipants?: RaceParticipant[];
};

export type RaceHistoryItem = {
  week_start: string;
  race_id?: string;
  final_rank: number;
  final_distance: number;
  total_participants: number;
  rank_before?: number;
  rank_after?: number;
};

// =============================
// 公開アクション
// =============================

/** 今週のレースを取得/作成 */
export async function getOrCreateWeeklyRace(userId: string): Promise<RaceData> {
  noStore();
  const weekStart = getWeekStart();

  // 前週の結果を保存（まだの場合）
  await finalizeLastWeek(userId);

  // ユーザーの累計XP＆ランク＆最終確認日を取得
  const { data: userStats } = await supabase
    .from("user_stats")
    .select("nickname, character_emoji, character_type, total_xp, race_rank, last_race_view_date, character_gacha_done")
    .eq("user_id", userId)
    .single();

  const userTotalXp = userStats?.total_xp ?? 0;
  const userRank = userStats?.race_rank ?? 10;
  const lastRaceViewDate = userStats?.last_race_view_date ?? null;
  const characterGachaDone = userStats?.character_gacha_done ?? false;
  const rankInfo = getRankInfo(userRank);

  // ユーザーの参加レコードを取得
  let { data: existing } = await supabase
    .from("race_participants")
    .select("*")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .maybeSingle();

  let raceId = existing?.race_id ?? null;
  let participants: RaceParticipant[] = [];

  if (existing && !raceId) {
    raceId = await findOrCreateRaceIdForUser(weekStart, userId);
    await supabase
      .from("race_participants")
      .update({ race_id: raceId })
      .eq("id", existing.id);
    existing = { ...existing, race_id: raceId } as any;
  }

  if (characterGachaDone || existing) {
    if (!existing) {
      const { data: userData } = await supabase.auth.admin.getUserById(userId);
      const displayName = userStats?.nickname || userData?.user?.email?.split("@")[0] || "プレイヤー";
      const characterEmoji = userStats?.character_emoji || "🐱";
      const characterType = userStats?.character_type || "cat";
      raceId = raceId || await findOrCreateRaceIdForUser(weekStart, userId);

      await createUserRaceParticipant(userId, weekStart, raceId, characterEmoji, characterType, displayName);
      existing = {
        id: "",
        user_id: userId,
        week_start: weekStart,
        race_id: raceId,
        distance: 0,
        character_emoji: characterEmoji,
        character_type: characterType,
        display_name: displayName,
        is_cpu: false,
        finished_at: null,
        daily_progress: {},
      } as any;
    }

    if (raceId) {
      await fillRaceWithCpuParticipants(weekStart, raceId, existing.character_type || userStats?.character_type || "cat", userRank);
    }

    const { data } = await supabase
      .from("race_participants")
      .select("*")
      .eq("week_start", weekStart)
      .eq("race_id", raceId)
      .order("distance", { ascending: false });

    participants = (data ?? []) as RaceParticipant[];
  }

  // CPUの進行を更新（1日1回相当）
  await advanceCpuParticipants(weekStart, userRank);

  // 今日のXPを取得
  const todayStr = getJSTDateString();
  const { data: todayLog } = await supabase
    .from("user_activity_logs")
    .select("xp_earned")
    .eq("user_id", userId)
    .eq("activity_date", todayStr)
    .maybeSingle();

  const allParticipants = participants
    .map((p) => ({
      ...p,
      distance: getPreviousDayCumulative(p.daily_progress || {}, getDayOfWeek()),
    }))
    .sort((a, b) => b.distance - a.distance);

  const myParticipant = allParticipants.find((p) => p.user_id === userId) ?? null;

  const res: RaceData = {
    participants: allParticipants,
    myParticipant,
    weeklyTarget: rankInfo.weeklyTarget,
    timeRemainingMs: getTimeRemainingMs(),
    weekStart,
    todayXp: todayLog?.xp_earned ?? 0,
    userTotalXp,
    userRank,
    rankInfo,
    dayOfWeek: getDayOfWeek(),
    lastRaceViewDate,
    raceId,
    characterGachaDone,
  };

  // 月曜日かつ最後にレースを見たのが今日以外（先週である）場合、リキャップ用の先週のデータを取得
  if (getDayOfWeek() === 1 && lastRaceViewDate !== getJSTDateString()) {
    const lastWeekDate = new Date();
    lastWeekDate.setDate(lastWeekDate.getDate() - 7);
    const lastWeekStart = getWeekStart(lastWeekDate);

    const { data: lastWeekEntry } = await supabase
      .from("race_participants")
      .select("race_id")
      .eq("user_id", userId)
      .eq("week_start", lastWeekStart)
      .maybeSingle();

    let lastWeekParticipantsQuery = supabase
      .from("race_participants")
      .select("*")
      .eq("week_start", lastWeekStart)
      .order("distance", { ascending: false });

    if (lastWeekEntry?.race_id) {
      lastWeekParticipantsQuery = lastWeekParticipantsQuery.eq("race_id", lastWeekEntry.race_id);
    }

    const { data: lastWeekP } = await lastWeekParticipantsQuery;

    if (lastWeekP && lastWeekP.length > 0) {
      const fullLastWeekP = lastWeekP
        .map((p: any) => ({
          ...p,
          distance: Object.values(p.daily_progress || {}).reduce((sum: number, val) => sum + (val as number), 0),
        }))
        .sort((a: any, b: any) => b.distance - a.distance);
      res.recapParticipants = fullLastWeekP;
    }
  }

  return res;
}

/** レースを確認済みにする */
export async function markRaceAsViewed(userId: string) {
  const todayStr = getJSTDateString();
  const { data, error } = await supabase
    .from("user_stats")
    .update({ last_race_view_date: todayStr })
    .eq("user_id", userId)
    .select("last_race_view_date")
    .single();
  revalidatePath("/words/race");
}

/** レース距離(=今週獲得XP)を更新 */
export async function updateRaceDistance(userId: string, xpGained: number) {
  const weekStart = getWeekStart();

  const { data: participant } = await supabase
    .from("race_participants")
    .select("id, distance, finished_at, daily_progress")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .maybeSingle();

  if (!participant) return;

  // ゴール後もスコアを伸ばせるように、リターン処理を削除
  // if (participant.finished_at) return;

  // ユーザーのランクを取得して目標値チェック
  const { data: userStats } = await supabase
    .from("user_stats")
    .select("race_rank")
    .eq("user_id", userId)
    .single();

  const userRank = userStats?.race_rank ?? 10;
  const rankInfo = getRankInfo(userRank);
  const weeklyTarget = rankInfo.weeklyTarget;

  const todayStr = getJSTDateString();
  const currentProgress = participant.daily_progress || {};
  currentProgress[todayStr] = (currentProgress[todayStr] || 0) + xpGained;

  const newDistance = Object.values(currentProgress).reduce((sum: number, val) => sum + (val as number), 0);
  
  // 上限（cappedDistance）を撤廃し、獲得したそのままの数値を採用
  const isFinished = newDistance >= weeklyTarget;
  
  // 既にゴールしている場合は記録済みの時間を維持、新規ゴールの場合は現在の時間
  const finishedAt = participant.finished_at || (isFinished ? new Date().toISOString() : null);

  await supabase
    .from("race_participants")
    .update({ distance: newDistance, finished_at: finishedAt, daily_progress: currentProgress })
    .eq("id", participant.id);
}

/** キャラクタータイプ変更 */
export async function updateCharacterType(userId: string, characterType: CharacterType) {
  const { data: stats } = await supabase
    .from("user_stats")
    .select("character_gacha_done")
    .eq("user_id", userId)
    .single();

  if (stats?.character_gacha_done) {
    return;
  }

  await supabase
    .from("user_stats")
    .update({ character_type: characterType })
    .eq("user_id", userId);

  const weekStart = getWeekStart();
  await supabase
    .from("race_participants")
    .update({ character_type: characterType })
    .eq("user_id", userId)
    .eq("week_start", weekStart);
}

/** 初回ガチャでキャラクターを確定 */
export async function assignInitialCharacter(userId: string, characterType: CharacterType) {
  const weekStart = getWeekStart();
  const characterEmoji = getCharacterEmoji(characterType);

  const { data: userData } = await supabase.auth.admin.getUserById(userId);
  const { data: stats } = await supabase
    .from("user_stats")
    .select("nickname, total_xp, race_rank, character_gacha_done")
    .eq("user_id", userId)
    .single();

  if (stats?.character_gacha_done) {
    return;
  }

  await supabase
    .from("user_stats")
    .update({ character_type: characterType, character_emoji: characterEmoji, character_gacha_done: true })
    .eq("user_id", userId);

  const displayName = stats?.nickname || userData?.user?.email?.split("@")[0] || "プレイヤー";
  let raceId = await findOrCreateRaceIdForUser(weekStart, userId);

  const { data: existing } = await supabase
    .from("race_participants")
    .select("*")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .maybeSingle();

  if (existing) {
    raceId = existing.race_id || raceId;
    await supabase
      .from("race_participants")
      .update({ character_type: characterType, character_emoji: characterEmoji, race_id: raceId })
      .eq("id", existing.id);
  } else {
    await createUserRaceParticipant(userId, weekStart, raceId, characterEmoji, characterType, displayName);
  }

  const userRank = stats?.race_rank ?? 10;
  await fillRaceWithCpuParticipants(weekStart, raceId, characterType, userRank);
}

/** レース履歴を取得 */
export async function getRaceHistory(userId: string): Promise<RaceHistoryItem[]> {
  const { data } = await supabase
    .from("race_history")
    .select("week_start, race_id, final_rank, final_distance, total_participants, rank_before, rank_after")
    .eq("user_id", userId)
    .order("week_start", { ascending: false })
    .limit(10);

  return (data ?? []) as RaceHistoryItem[];
}

// =============================
// 内部関数
// =============================

/** CPU参加者を作成（ランクに合わせた強さ） */
async function createCpuParticipants(weekStart: string, raceId: string, userCharType: string, cpuCount: number, userRank: number) {
  const usedTypes = new Set([userCharType]);
  const usedNames = new Set<string>();
  const cpuInserts = [];
  const paceRanges = getCpuPaceForRank(userRank);

  for (let i = 0; i < cpuCount; i++) {
    let charType = CHARACTER_TYPES[Math.floor(Math.random() * CHARACTER_TYPES.length)];
    let attempts = 0;
    while (usedTypes.has(charType) && attempts < 20) {
      charType = CHARACTER_TYPES[Math.floor(Math.random() * CHARACTER_TYPES.length)];
      attempts++;
    }
    usedTypes.add(charType);

    let name = CPU_NAMES[Math.floor(Math.random() * CPU_NAMES.length)];
    attempts = 0;
    while (usedNames.has(name) && attempts < 20) {
      name = CPU_NAMES[Math.floor(Math.random() * CPU_NAMES.length)];
      attempts++;
    }
    usedNames.add(name);

    const rankTarget = getRankInfo(userRank).weeklyTarget;
    const baseDaily = rankTarget / 7;
    const cpuDailyPace = randInt(Math.max(1, Math.floor(baseDaily * 0.5)), Math.ceil(baseDaily * 1.5));

    const cpuTotalXp = randInt(Math.max(0, Math.floor(rankTarget * 0.2)), Math.min(rankTarget, Math.floor(rankTarget * 0.8)));

    // CPUは1日ずつ進む仕様なので初期は0にしておく
    const initialDistance = 0;
    const initialDailyProgress = {};

    cpuInserts.push({
      user_id: null,
      week_start: weekStart,
      race_id: raceId,
      distance: initialDistance,
      character_emoji: "🤖",
      character_type: charType,
      display_name: `CPU ${name}`,
      is_cpu: true,
      cpu_daily_pace: cpuDailyPace,
      cpu_total_xp: cpuTotalXp,
      daily_progress: initialDailyProgress,
    });
  }

  if (cpuInserts.length > 0) {
    await supabase.from("race_participants").insert(cpuInserts);
  }
}

/** CPUを1日分進行させる */
async function advanceCpuParticipants(weekStart: string, userRank: number) {
  const { data: cpus } = await supabase
    .from("race_participants")
    .select("*")
    .eq("week_start", weekStart)
    .eq("is_cpu", true);

  if (!cpus || cpus.length === 0) return;

  const targetCap = getRankInfo(userRank).weeklyTarget;
  const today = getJSTDateString(); // 今日の日付（YYYY-MM-DD形式）

  for (const cpu of cpus) {
    // 既に目標に達していたらスキップ
    if (cpu.distance >= targetCap) continue;

    // 今日既に進行した場合はスキップ
    if (cpu.last_cpu_advance_date === today) continue;

    const baseDaily = targetCap / 7;
    const dailyMin = Math.max(1, Math.floor(baseDaily * 0.5));
    const dailyMax = Math.ceil(baseDaily * 1.5);
    const step = randInt(dailyMin, dailyMax);

    const currentProgress = cpu.daily_progress || {};
    currentProgress[today] = (currentProgress[today] || 0) + step;

    const newDistance = Object.values(currentProgress).reduce((sum: number, val) => sum + (val as number), 0);
    const cappedDistance = Math.min(newDistance, targetCap);

    if (cappedDistance > cpu.distance) {
      await supabase
        .from("race_participants")
        .update({ distance: cappedDistance, last_cpu_advance_date: today, daily_progress: currentProgress })
        .eq("id", cpu.id);
    }
  }
}

/** 先週のレース結果を確定・ランク変動 */
async function finalizeLastWeek(userId: string) {
  const lastWeekDate = new Date();
  lastWeekDate.setDate(lastWeekDate.getDate() - 7);
  const lastWeekStart = getWeekStart(lastWeekDate);
  const thisWeekStart = getWeekStart();

  if (lastWeekStart === thisWeekStart) return;

  // 既に保存済みか確認
  const { data: historyExists } = await supabase
    .from("race_history")
    .select("id")
    .eq("user_id", userId)
    .eq("week_start", lastWeekStart)
    .maybeSingle();

  if (historyExists) return;

  // 先週の参加者を取得（XP=distance順）
  const { data: lastWeekParticipants } = await supabase
    .from("race_participants")
    .select("*")
    .eq("week_start", lastWeekStart)
    .order("distance", { ascending: false });

  if (!lastWeekParticipants || lastWeekParticipants.length === 0) return;

  const userEntry = lastWeekParticipants.find(p => p.user_id === userId);
  if (!userEntry) return;

  const userPlacement = lastWeekParticipants.findIndex(p => p.user_id === userId) + 1;
  const totalP = lastWeekParticipants.length;

  // 現在のランクを取得
  const { data: stats } = await supabase
    .from("user_stats")
    .select("race_rank")
    .eq("user_id", userId)
    .single();

  const currentRank = stats?.race_rank ?? 10;
  let newRank = currentRank;

  // 1位 → ランク1つ上がる (数値-1)、最下位 → ランク1つ下がる (数値+1)
  if (userPlacement === 1) {
    newRank = Math.max(1, currentRank - 1);
  } else if (userPlacement === totalP) {
    newRank = Math.min(10, currentRank + 1);
  }

  // ランク更新
  if (newRank !== currentRank) {
    await supabase
      .from("user_stats")
      .update({ race_rank: newRank })
      .eq("user_id", userId);
  }

  // 履歴保存
  await supabase.from("race_history").insert({
    user_id: userId,
    week_start: lastWeekStart,
    race_id: userEntry.race_id || null,
    final_rank: userPlacement,
    final_distance: userEntry.distance,
    total_participants: totalP,
    rank_before: currentRank,
    rank_after: newRank,
  });
}
