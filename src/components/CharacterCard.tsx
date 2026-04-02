"use client";

import React from "react";
import { motion } from "framer-motion";
import { Star, Sparkles, ChevronRight } from "lucide-react";
import PixelCharacter from "@/components/PixelCharacter";
import {
  getCharacterDef,
  getStageIndex,
  getXpToNextStage,
  CHARACTER_DEFS,
  type CharacterType,
} from "@/lib/characters";

// =============================
// キャラクターカード — 育成状態表示
// =============================

interface CharacterCardProps {
  type: CharacterType;
  totalXp: number;
  /** カード全体をクリックした時 */
  onClick?: () => void;
  /** コンパクト表示 */
  compact?: boolean;
}

export default function CharacterCard({
  type,
  totalXp,
  onClick,
  compact = false,
}: CharacterCardProps) {
  const charDef = getCharacterDef(type);
  const stageIndex = getStageIndex(totalXp);
  const stage = charDef.stages[stageIndex];
  const nextStageInfo = getXpToNextStage(totalXp);
  const isMaxStage = stageIndex >= 4;

  if (compact) {
    return (
      <motion.button
        onClick={onClick}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="flex items-center gap-3 p-3 bg-[var(--card)] border border-[var(--border)] rounded-xl hover:border-[var(--accent)]/30 transition-all w-full text-left group"
      >
        <div className="shrink-0">
          <PixelCharacter type={type} totalXp={totalXp} pixelSize={3} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[13px] font-bold text-[var(--foreground)] truncate">
              {charDef.nameJa}
            </span>
            <span className="text-[10px] font-semibold text-[var(--accent)] bg-[var(--accent)]/10 px-1.5 py-0.5 rounded">
              {stage.name}
            </span>
          </div>
          <div className="text-[11px] text-[var(--muted-foreground)]">
            {stage.title}
          </div>
          {nextStageInfo && (
            <div className="mt-1.5">
              <div className="h-1 bg-[var(--secondary)] rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-[var(--accent)] rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((nextStageInfo.current / nextStageInfo.needed) * 100, 100)}%` }}
                  transition={{ duration: 0.8 }}
                />
              </div>
            </div>
          )}
        </div>
        <ChevronRight className="w-4 h-4 text-[var(--muted-foreground)] group-hover:text-[var(--accent)] transition shrink-0" />
      </motion.button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5 relative overflow-hidden"
    >
      {/* 背景グラデーション */}
      {isMaxStage && (
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-orange-500/5 pointer-events-none" />
      )}

      {/* タイトル */}
      <div className="flex items-center justify-between mb-4 relative z-10">
        <h3 className="text-sm font-bold text-[var(--foreground)] flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-[var(--accent)]" />
          マイキャラクター
        </h3>
        {onClick && (
          <button
            onClick={onClick}
            className="text-[11px] text-[var(--accent)] font-semibold hover:underline"
          >
            変更する
          </button>
        )}
      </div>

      {/* キャラクター表示エリア */}
      <div className="flex items-center gap-4 mb-4 relative z-10">
        <div className="shrink-0 flex items-center justify-center p-2">
          <PixelCharacter type={type} totalXp={totalXp} pixelSize={5} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg font-bold text-[var(--foreground)]">
              {charDef.nameJa}
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              isMaxStage
                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25"
                : "bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]/20"
            }`}>
              {stage.name}
            </span>
          </div>
          <div className="text-[13px] font-semibold text-[var(--accent)] mb-0.5">
            {stage.title}
          </div>
          <div className="text-[11px] text-[var(--muted-foreground)]">
            {stage.description}
          </div>
        </div>
      </div>

      {/* 進化プログレス */}
      <div className="relative z-10">
        {nextStageInfo ? (
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[11px] text-[var(--muted-foreground)] font-medium">
                次の進化まで
              </span>
              <span className="text-[12px] font-bold text-[var(--foreground)]">
                {nextStageInfo.current.toLocaleString()}{" "}
                <span className="text-[10px] text-[var(--muted-foreground)] font-normal">
                  / {nextStageInfo.needed.toLocaleString()} XP
                </span>
              </span>
            </div>
            <div className="h-2 bg-[var(--secondary)] rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-[var(--accent)] to-amber-400"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min((nextStageInfo.current / nextStageInfo.needed) * 100, 100)}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
              />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 p-2 bg-amber-500/8 rounded-lg border border-amber-500/15">
            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
            <span className="text-[12px] font-bold text-amber-600 dark:text-amber-400">
              最大レベルに到達！
            </span>
          </div>
        )}
      </div>

      {/* 進化段階インジケーター */}
      <div className="flex items-center gap-1.5 mt-3 relative z-10">
        {charDef.stages.map((s, i) => (
          <div
            key={i}
            className={`flex-1 h-1 rounded-full transition-colors ${
              i <= stageIndex
                ? i === stageIndex
                  ? "bg-[var(--accent)]"
                  : "bg-[var(--accent)]/50"
                : "bg-[var(--secondary)]"
            }`}
            title={s.name}
          />
        ))}
      </div>
    </motion.div>
  );
}

// =============================
// キャラクター選択グリッド
// =============================

interface CharacterSelectGridProps {
  currentType: CharacterType;
  totalXp: number;
  onSelect: (type: CharacterType) => void;
}

export function CharacterSelectGrid({ currentType, totalXp, onSelect }: CharacterSelectGridProps) {
  return (
    <div className="grid grid-cols-4 gap-3">
      {CHARACTER_DEFS.map((charDef) => {
        const isSelected = charDef.type === currentType;

        return (
          <motion.button
            key={charDef.type}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSelect(charDef.type)}
            className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all border ${
              isSelected
                ? "bg-[var(--accent)]/10 border-[var(--accent)]/40 ring-2 ring-[var(--accent)]/20"
                : "bg-[var(--secondary)] border-[var(--border)] hover:border-[var(--accent)]/30"
            }`}
          >
            <PixelCharacter
              type={charDef.type}
              totalXp={totalXp}
              pixelSize={3}
              animated={false}
            />
            <span className="text-[10px] font-medium text-[var(--muted-foreground)]">
              {charDef.nameJa}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
