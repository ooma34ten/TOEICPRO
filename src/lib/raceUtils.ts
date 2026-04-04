// =============================
// ランクシステム（10段階）
// =============================
export interface RankInfo {
  rank: number;       // 1(最高)〜10(最低)
  name: string;       // ランク名
  weeklyTarget: number; // そのランクの週間目標XP
  color: string;      // テーマカラー
  icon: string;       // アイコン絵文字
}

export const RANK_DEFS: RankInfo[] = [
  { rank: 1,  name: "チャンピオン",   weeklyTarget: 14000, color: "#ffd700", icon: "👑" },
  { rank: 2,  name: "マスター",       weeklyTarget: 11000, color: "#c0c0c0", icon: "🏆" },
  { rank: 3,  name: "エキスパート",   weeklyTarget: 9000,  color: "#cd7f32", icon: "🥇" },
  { rank: 4,  name: "ベテラン",       weeklyTarget: 7500,  color: "#9b59b6", icon: "⭐" },
  { rank: 5,  name: "アドバンス",     weeklyTarget: 6000,  color: "#3498db", icon: "💎" },
  { rank: 6,  name: "チャレンジャー", weeklyTarget: 5000,  color: "#2ecc71", icon: "🔥" },
  { rank: 7,  name: "レギュラー",     weeklyTarget: 4000,  color: "#1abc9c", icon: "⚡" },
  { rank: 8,  name: "アマチュア",     weeklyTarget: 3000,  color: "#e67e22", icon: "🌟" },
  { rank: 9,  name: "ルーキー",       weeklyTarget: 2000,  color: "#95a5a6", icon: "🌱" },
  { rank: 10, name: "ビギナー",       weeklyTarget: 1000,  color: "#bdc3c7", icon: "🐣" },
];

export function getRankInfo(rank: number): RankInfo {
  return RANK_DEFS.find(r => r.rank === rank) || RANK_DEFS[RANK_DEFS.length - 1];
}

export function getAllRankDefs(): RankInfo[] {
  return RANK_DEFS;
}

/** 前日の累積距離を計算 */
export function getPreviousDayCumulative(dailyProgress: Record<string, number>, dayOfWeek: number): number {
  if (dayOfWeek === 1) return 0;

  // 週の開始日を計算（月曜日）
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const day = jst.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(jst);
  monday.setUTCDate(monday.getUTCDate() - diff);
  const weekStart = `${monday.getUTCFullYear()}-${String(monday.getUTCMonth() + 1).padStart(2, "0")}-${String(monday.getUTCDate()).padStart(2, "0")}`;

  const weekStartDate = new Date(weekStart);
  const prevDate = new Date(weekStartDate);
  prevDate.setDate(prevDate.getDate() + dayOfWeek - 2); // dayOfWeek 1=月, prev=前日
  const prevDateStr = prevDate.toISOString().split('T')[0];

  return Object.entries(dailyProgress)
    .filter(([date]) => date <= prevDateStr)
    .reduce((sum: number, [, val]) => sum + val, 0);
}
