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
  // UTC を取得
  const utc = new Date(d.getTime() + d.getTimezoneOffset() * 60000);
  // JST = UTC + 9 hours
  const jst = new Date(utc.getTime() + 18 * 60 * 60 * 1000);

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
      return "bg-slate-100 text-slate-800";
    case 2:
      return "bg-teal-100 text-teal-800";
    case 3:
      return "bg-blue-100 text-blue-800";
    case 4:
      return "bg-indigo-100 text-indigo-800";
    case 5:
      return "bg-purple-100 text-purple-900";
    default:
      return "bg-slate-100 text-slate-800";
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

export const PART_OF_SPEECH_OPTIONS = [
  "名詞",
  "動詞",
  "形容詞",
  "副詞",
  "前置詞",
  "接続詞",
  "代名詞",
  "冠詞",
  "助動詞",
  "間投詞",
  "熟語・フレーズ",
  "その他"
] as const;

export type PartOfSpeech = typeof PART_OF_SPEECH_OPTIONS[number];

export function normalizePartOfSpeech(part: string | null | undefined): string | null {
  if (!part) return null;
  let s = part.trim();

  // 過去形、複数形などの詳細を大分類にマッピング
  if (s.includes("動詞")) return "動詞"; // 他動詞、自動詞、動詞(過去形)など
  if (s.includes("名詞")) return "名詞"; // 不可算名詞、代名詞は先に判定したいが、"代名詞"が含まれるなら別途判定する
  // ただし「代名詞」は「名詞」を含むので順番に注意する。
  // より堅固なマッピング:
  if (s.includes("代名詞")) return "代名詞";
  if (s.includes("名詞")) return "名詞";
  if (s.includes("動詞") && s.includes("助動詞")) return "助動詞";
  if (s.includes("動詞")) return "動詞";
  if (s.includes("形容詞")) return "形容詞";
  if (s.includes("副詞")) return "副詞";
  if (s.includes("前置詞")) return "前置詞";
  if (s.includes("接続詞")) return "接続詞";
  if (s.includes("冠詞")) return "冠詞";
  if (s.includes("間投詞")) return "間投詞";
  if (s.includes("熟語") || s.includes("フレーズ") || s.includes("イディオム")) return "熟語・フレーズ";

  // それでも該当しない場合は「その他」
  return "その他";
}

export const getPartOfSpeechClasses = (part: string) => {
  switch (part) {
    case "名詞":
    case "代名詞":
      return "bg-blue-100 text-blue-700";
    case "動詞":
    case "助動詞":
      return "bg-green-100 text-green-700";
    case "形容詞":
      return "bg-purple-100 text-purple-700";
    case "副詞":
      return "bg-pink-100 text-pink-700";
    case "接続詞":
      return "bg-indigo-100 text-indigo-800";
    case "前置詞":
      return "bg-orange-100 text-orange-800";
    case "熟語・フレーズ":
      return "bg-teal-100 text-teal-800";
    case "間投詞":
    case "冠詞":
    default:
      return "bg-gray-100 text-gray-700";
  }
};

/**
 * 配列をシャッフルする（Fisher-Yatesアルゴリズム）
 * @param array シャッフル対象の配列
 * @returns シャッフルされた配列
 */
export function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
