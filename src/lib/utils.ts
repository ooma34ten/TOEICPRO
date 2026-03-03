import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// =============================
// JST 日付ヘルパー
// =============================

/** 現在の日本時間 (UTC+9) の日付文字列 "YYYY-MM-DD" を返す */
export function getJSTDateString(date?: Date): string {
  const d = date ?? new Date();
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().split("T")[0];
}

/** 日本時間で「昨日」の日付文字列を返す */
export function getJSTYesterday(): string {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return getJSTDateString(yesterday);
}

// =============================
// 重要度ヘルパー
// =============================

/** ★文字列 or 数字 → 数値 (1〜5) に変換 */
export function parseImportance(val: string | number | null | undefined): number {
  if (val == null || val === "") return 3; // デフォルト
  if (typeof val === "number") return Math.min(5, Math.max(1, Math.round(val)));
  const s = String(val).trim();
  // 数字なら直接変換
  const num = Number(s);
  if (!isNaN(num) && num >= 1 && num <= 5) return Math.round(num);
  // ★の個数をカウント（☆は無視）
  const starCount = (s.match(/★/g) || []).length;
  if (starCount >= 1 && starCount <= 5) return starCount;
  // ★☆混在の場合、全文字数で判定
  const totalChars = s.replace(/[^★☆]/g, "").length;
  if (totalChars >= 1 && totalChars <= 5) return (s.match(/★/g) || []).length || 3;
  return 3;
}

/** 数値 → "★★★" のように★のみで表示 */
export function importanceToStars(val: string | number | null | undefined): string {
  const n = parseImportance(val);
  return "★".repeat(n);
}

/** 重要度に応じたCSSクラスを返す */
export const getImportanceClasses = (importance: string | number | null | undefined) => {
  const level = parseImportance(importance);
  switch (level) {
    case 1:
      return "bg-gray-100 text-gray-800";
    case 2:
      return "bg-yellow-100 text-yellow-700";
    case 3:
      return "bg-yellow-200 text-yellow-800";
    case 4:
      return "bg-orange-200 text-orange-800";
    case 5:
      return "bg-red-300 text-red-900";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

// =============================
// 苦手判定ヘルパー
// =============================

/** 苦手な単語かどうかを判定 (解答5回以上 & 正答率40%以下) */
export function isWeakWord(total: number, successRate: number): boolean {
  return total >= 5 && successRate <= 0.4;
}

// =============================
// 品詞クラス
// =============================

export const getPartOfSpeechClasses = (part: string) => {
  switch (part) {
    case "名詞":
      return "bg-blue-100 text-blue-700";
    case "動詞":
      return "bg-green-100 text-green-700";
    case "形容詞":
      return "bg-purple-100 text-purple-700";
    case "副詞":
      return "bg-pink-100 text-pink-700";
    case "接続詞":
      return "bg-yellow-100 text-yellow-800";
    case "前置詞":
      return "bg-orange-100 text-orange-800";
    default:
      return "bg-gray-100 text-gray-700";
  }
};
