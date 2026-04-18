"use client";

import React, { useMemo } from "react";
import { getCharacterDef, getStageIndex, getStageScale, type CharacterType } from "@/lib/characters";
import { PIXEL_ITEMS } from "@/lib/items";

// =============================
// SVG ベースのドット絵レンダラー
// =============================

interface PixelCharacterProps {
  type: CharacterType;
  totalXp: number;
  /** ピクセルのサイズ (px)。デフォルト4 */
  pixelSize?: number;
  /** 追加のCSSクラス */
  className?: string;
  /** アニメーションを有効にするか */
  animated?: boolean;
  /** 明示的にステージを指定する場合 (XPベースを上書き) */
  stageOverride?: number;
  /** 1位用王冠表示 */
  showCrown?: boolean;
}

export default function PixelCharacter({
  type,
  totalXp,
  pixelSize = 4,
  className = "",
  animated = true,
  stageOverride,
  showCrown = false,
}: PixelCharacterProps) {
  const charDef = getCharacterDef(type);
  const stageIndex = stageOverride ?? getStageIndex(totalXp);
  // 体色は常にインデックス0（初期パレット）に固定
  const palette = charDef.palettes[0];
  const scale = getStageScale(stageIndex);
  const pixels = charDef.pixels;

  // ピクセルデータからSVG要素を生成 (メモ化)
  const { rects, itemRects, width, height } = useMemo(() => {
    const allRects: { x: number; y: number; color: string }[] = [];
    const h = pixels.length;
    const w = pixels[0]?.length ?? 0;

    for (let row = 0; row < h; row++) {
      const line = pixels[row];
      for (let col = 0; col < w; col++) {
        const ch = line[col];
        if (ch === "0") continue; // transparent
        const idx = parseInt(ch, 16);
        if (isNaN(idx) || idx < 1 || idx > 10) continue;
        const color = palette[idx - 1]; // palette[0] = color index 1
        if (!color) continue;
        allRects.push({ x: col, y: row, color });
      }
    }

    // アイテム（装備）データの生成
    const equippedItems: string[] = [];
    if (stageIndex >= 1) equippedItems.push("ribbon");
    if (stageIndex >= 2) equippedItems.push("glasses");
    if (stageIndex >= 3) equippedItems.push("hero_sword"); // 新アイテム: 勇者の剣
    if (stageIndex >= 4) equippedItems.push("legend_badge");

    // 王冠は1位の場合（showCrownがtrueの場合）のみ
    if (showCrown) equippedItems.push("crown");

    const iRects: { x: number; y: number; color: string }[] = [];
    equippedItems.forEach(itemId => {
      const itemDef = PIXEL_ITEMS[itemId];
      if (!itemDef) return;
      const offset = charDef.itemOffsets?.[itemId] || { x: 0, y: 0 };
      const itemH = itemDef.pixels.length;
      const itemW = itemDef.pixels[0]?.length ?? 0;

      for (let r = 0; r < itemH; r++) {
        const line = itemDef.pixels[r];
        for (let c = 0; c < itemW; c++) {
          const ch = line[c];
          if (ch === "0") continue;
          const color = itemDef.palette[ch];
          if (color) {
            iRects.push({ x: c + offset.x, y: r + offset.y, color });
          }
        }
      }
    });

    return { rects: allRects, itemRects: iRects, width: w, height: h };
  }, [pixels, palette, stageIndex, charDef.itemOffsets]);

  // はみ出し（見切れ）を防ぐためのパディング
  const PADDING_X = 4;
  const PADDING_TOP = 6;
  const PADDING_BOTTOM = 2;
  const viewWidth = width + PADDING_X * 2;
  const viewHeight = height + PADDING_TOP + PADDING_BOTTOM;

  const svgWidth = viewWidth * pixelSize * scale;
  const svgHeight = viewHeight * pixelSize * scale;

  // Stage 5 のグロウエフェクト
  const isLegendary = stageIndex >= 4;
  // Stage 4+ のゴールデンアウラ
  const hasAura = stageIndex >= 3;
  // 1位用王冠表示
  const showCrownDot = showCrown || isLegendary;

  return (
    <div
      className={`inline-flex items-center justify-center relative ${className}`}
      style={{ width: svgWidth, height: svgHeight }}
    >
      {/* オーラエフェクト (Stage 4+) */}
      {hasAura && (
        <div
          className="absolute inset-0 rounded-full animate-pulse"
          style={{
            background: isLegendary
              ? "radial-gradient(ellipse, rgba(255,215,0,0.25) 0%, transparent 70%)"
              : "radial-gradient(ellipse, rgba(255,215,0,0.12) 0%, transparent 70%)",
            transform: "scale(1.5)",
            filter: "blur(4px)",
          }}
        />
      )}

      {/* メインSVG */}
      <svg
        width={svgWidth}
        height={svgHeight}
        viewBox={`-${PADDING_X} -${PADDING_TOP} ${viewWidth} ${viewHeight}`}
        style={{
          imageRendering: "pixelated",
          position: "relative",
          zIndex: 1,
        }}
        className={`${animated ? "transition-transform duration-500 hover:scale-110 animate-pulse" : ""}`}
      >
        {/* グロウフィルター (Stage 5) */}
        {isLegendary && (
          <defs>
            <filter id={`glow-${type}`}>
              <feGaussianBlur stdDeviation="0.4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
        )}

        <g filter={isLegendary ? `url(#glow-${type})` : undefined}>
          {rects.map((r, i) => (
            <rect
              key={`base-${i}`}
              x={r.x}
              y={r.y}
              width={1}
              height={1}
              fill={r.color}
            />
          ))}
          {/* アイテム（装備）レイヤー */}
          {itemRects.map((r, i) => (
            <rect
              key={`item-${i}`}
              x={r.x}
              y={r.y}
              width={1}
              height={1}
              fill={r.color}
            />
          ))}
        </g>

        {/* （旧）1位用王冠: 独自のSVG画像を使う古い実装は削除・コメントアウト */}

        {/* Stage 4: 星マーク */}
        {stageIndex === 3 && (
          <g>
            <rect x={4} y={-1} width={1} height={1} fill="#ffd700" />
            <rect x={5} y={-1} width={1} height={1} fill="#ffd700" />
            <rect x={6} y={-1} width={1} height={1} fill="#ffd700" />
            <rect x={5} y={-2} width={1} height={1} fill="#ffd700" />
          </g>
        )}
      </svg>

      {/* キラキラパーティクル (Stage 5) */}
      {isLegendary && animated && (
        <>
          <span
            className="absolute text-[12px] animate-bounce"
            style={{ top: "0px", left: "15%", animationDelay: "0s", animationDuration: "2s" }}
          >
            ✦
          </span>
          <span
            className="absolute text-[6px] animate-bounce"
            style={{ top: "20%", right: "-2px", animationDelay: "0.7s", animationDuration: "2.5s" }}
          >
            ✦
          </span>
          <span
            className="absolute text-[7px] animate-bounce"
            style={{ bottom: "10%", left: "-4px", animationDelay: "1.3s", animationDuration: "1.8s" }}
          >
            ✧
          </span>
        </>
      )}
    </div>
  );
}

// =============================
// ミニ版 (レーストラック用)
// =============================
export function PixelCharacterMini({
  type,
  totalXp,
  className = "",
  stageOverride,
  showCrown = false,
}: {
  type: CharacterType;
  totalXp: number;
  className?: string;
  stageOverride?: number;
  showCrown?: boolean;
}) {
  return (
    <PixelCharacter
      type={type}
      totalXp={totalXp}
      pixelSize={2.5}
      className={className}
      animated={false}
      stageOverride={stageOverride}
      showCrown={showCrown}
    />
  );
}
