"use client";

import React, { useMemo } from "react";
import { getCharacterDef, getStageIndex, getStageScale, type CharacterType } from "@/lib/characters";

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
}

export default function PixelCharacter({
  type,
  totalXp,
  pixelSize = 4,
  className = "",
  animated = true,
  stageOverride,
}: PixelCharacterProps) {
  const charDef = getCharacterDef(type);
  const stageIndex = stageOverride ?? getStageIndex(totalXp);
  const palette = charDef.palettes[stageIndex];
  const scale = getStageScale(stageIndex);
  const pixels = charDef.pixels;

  // ピクセルデータからSVG要素を生成 (メモ化)
  const { rects, width, height } = useMemo(() => {
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

    return { rects: allRects, width: w, height: h };
  }, [pixels, palette]);

  const svgWidth = width * pixelSize * scale;
  const svgHeight = height * pixelSize * scale;

  // Stage 5 のグロウエフェクト
  const isLegendary = stageIndex >= 4;
  // Stage 4+ のゴールデンアウラ
  const hasAura = stageIndex >= 3;

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
        viewBox={`0 0 ${width} ${height}`}
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
              key={i}
              x={r.x}
              y={r.y}
              width={1}
              height={1}
              fill={r.color}
            />
          ))}
        </g>

        {/* Stage 5: 王冠 */}
        {isLegendary && (
          <g>
            <rect x={3} y={-2} width={1} height={1} fill="#ffd700" />
            <rect x={5} y={-2} width={1} height={1} fill="#ffd700" />
            <rect x={7} y={-2} width={1} height={1} fill="#ffd700" />
            <rect x={3} y={-1} width={5} height={1} fill="#ffd700" />
            <rect x={4} y={-2} width={1} height={1} fill="#ff4500" />
            <rect x={6} y={-2} width={1} height={1} fill="#ff4500" />
          </g>
        )}

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
            className="absolute text-[8px] animate-bounce"
            style={{ top: "-4px", left: "10%", animationDelay: "0s", animationDuration: "2s" }}
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
}: {
  type: CharacterType;
  totalXp: number;
  className?: string;
  stageOverride?: number;
}) {
  return (
    <PixelCharacter
      type={type}
      totalXp={totalXp}
      pixelSize={2.5}
      className={className}
      animated={false}
      stageOverride={stageOverride}
    />
  );
}
