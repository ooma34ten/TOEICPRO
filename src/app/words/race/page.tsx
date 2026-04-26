"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getJSTDateString } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy,
  Clock,
  Zap,
  ChevronRight,
  Crown,
  Medal,
  Target,
  Flame,
  History,
  Sparkles,
  X,
  ArrowUp,
  ArrowDown,
  TrendingUp,
} from "lucide-react";
import {
  getOrCreateWeeklyRace,
  updateCharacterType,
  assignInitialCharacter,
  getRaceHistory,
  markRaceAsViewed,
  type RaceData,
  type RaceParticipant,
  type RaceHistoryItem,
} from "@/app/actions/race";
import { getRankInfo, RANK_DEFS, getAllRankDefs, getPreviousDayCumulative, getDayBeforeYesterdayCumulative, type RankInfo } from "@/lib/raceUtils";
import PixelCharacter, { PixelCharacterMini } from "@/components/PixelCharacter";
import CharacterCard from "@/components/CharacterCard";
import {
  getCharacterDef,
  getStageIndex,
  CHARACTER_DEFS,
  type CharacterType,
} from "@/lib/characters";

// =============================
// レースアニメーション状態
// =============================
type RacePhase = "loading" | "ready" | "countdown" | "racing" | "finished";

// =============================
// 順位バッジ
// =============================
const RankBadge = ({ rank }: { rank: number }) => {
  if (rank === 1) return (
    <div className="flex items-center justify-center w-7 h-7 rounded-full bg-yellow-400/20 border border-yellow-400/40">
      <Crown className="w-4 h-4 text-yellow-500 fill-yellow-500" />
    </div>
  );
  if (rank === 2) return (
    <div className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-300/20 border border-slate-400/40">
      <Medal className="w-4 h-4 text-slate-400" />
    </div>
  );
  if (rank === 3) return (
    <div className="flex items-center justify-center w-7 h-7 rounded-full bg-amber-600/20 border border-amber-600/40">
      <Medal className="w-4 h-4 text-amber-600" />
    </div>
  );
  return (
    <div className="flex items-center justify-center w-7 h-7 rounded-full bg-secondary border border-border">
      <span className="text-[11px] font-bold text-muted-foreground">{rank}</span>
    </div>
  );
};

// =============================
// カウントダウンタイマー
// =============================
const CountdownTimer = ({ initialMs }: { initialMs: number }) => {
  const [remaining, setRemaining] = useState(initialMs);

  useEffect(() => {
    const timer = setInterval(() => {
      setRemaining(prev => Math.max(0, prev - 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
  const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

  return (
    <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
      <Clock className="w-3.5 h-3.5" />
      <span>残り <span className="font-bold text-foreground">{days}日 {hours}時間 {minutes}分</span></span>
    </div>
  );
};

// =============================
// ランクバッジ
// =============================
const RankTierBadge = ({ rankInfo }: { rankInfo: RankInfo }) => (
  <div
    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border"
    style={{
      backgroundColor: `${rankInfo.color}15`,
      borderColor: `${rankInfo.color}40`,
      color: rankInfo.color,
    }}
  >
    <span>{rankInfo.icon}</span>
    <span>{rankInfo.name}</span>
  </div>
);

// =============================
// ランク詳細表示
// =============================
const RankDetailCard = ({ rankInfo, userRank }: { rankInfo: RankInfo; userRank: number }) => {
  const nextRank = userRank > 1 ? getRankInfo(userRank - 1) : null;
  const prevRank = userRank < 10 ? getRankInfo(userRank + 1) : null;

  return (
    <div className="bg-card border border-border rounded-xl p-4 mb-4">
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
          style={{ backgroundColor: `${rankInfo.color}20` }}
        >
          {rankInfo.icon}
        </div>
        <div>
          <h3 className="text-lg font-bold text-foreground">
            現在のレースランク : {rankInfo.name} ({rankInfo.rank})
          </h3>
          <p className="text-[12px] text-muted-foreground">
            週間目標: {rankInfo.weeklyTarget.toLocaleString()} XP
          </p>
        </div>
      </div>

      {/* ランク進捗 */}
      <div className="space-y-2">
        {nextRank && (
          <div className="text-[12px] text-muted-foreground">
            <span className="font-medium">次のランク:</span>
            <span className="ml-2 text-foreground">
              {nextRank.name} ({nextRank.rank})({nextRank.weeklyTarget.toLocaleString()} XP)
            </span>
          </div>
        )}
        {prevRank && (
          <div className="text-[12px] text-muted-foreground">
            <span className="font-medium">前のランク:</span>
            <span className="ml-2 text-foreground">
              {prevRank.name} ({prevRank.weeklyTarget.toLocaleString()} XP)
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

// =============================
// 🏇 競馬場レースアニメーション
// =============================
const HorseRaceAnimation = ({
  participants,
  myUserId,
  weeklyTarget,
  userTotalXp,
  phase,
  dayOfWeek,
}: {
  participants: RaceParticipant[];
  myUserId: string | null;
  weeklyTarget: number;
  userTotalXp: number;
  phase: RacePhase;
  dayOfWeek: number;
}) => {
  // 動的な現在距離を保持する（ソート用）
  const [liveDistances, setLiveDistances] = useState<Record<string, number>>({});

  // 各馬のアニメーション設定
  const animConfigs = useRef<Record<string, { start: number, final: number, delay: number, duration: number }>>({});

  // 1位の最大距離を取得してスケールを計算 (final position用)
  const maxFinalDistance = Math.max(...participants.map(p => p.distance), 1);
  const displayScale = maxFinalDistance > 0 ? 90 / maxFinalDistance : 1;

  // 初期化：スタート時の距離とアニメ設定を固定
  useEffect(() => {
    // 先々日の累積距離順でスタートレーンを並べる（前回のレース結果が反映される）
    const initialSorted = [...participants].sort((a, b) => {
      const prevA = getDayBeforeYesterdayCumulative(a.daily_progress || {}, dayOfWeek);
      const prevB = getDayBeforeYesterdayCumulative(b.daily_progress || {}, dayOfWeek);
      if (prevA === prevB) {
        if (a.user_id === myUserId) return 1;
        if (b.user_id === myUserId) return -1;
        return 0;
      }
      return prevB - prevA;
    });

    const newLive: Record<string, number> = {};
    initialSorted.forEach((p, index) => {
      // スタート位置は2日前までの累積距離（レース中の走行距離の起点）
      const startPos = getDayBeforeYesterdayCumulative(p.daily_progress || {}, dayOfWeek);

      // 同点時にプレイヤーが一番下（最下位位置）からスタートするよう微小なマイナスをつける
      const isMe = p.user_id === myUserId;
      const tieBreaker = isMe ? -0.1 : (participants.length - index) * 0.001;
      newLive[p.id] = startPos + tieBreaker;

      animConfigs.current[p.id] = {
        start: startPos,
        final: p.distance,
        delay: 0.8 + (Math.random() * 0.5) + (index * 0.15),
        duration: 7.0 + (Math.random() * 2.5),
      };
    });
    setLiveDistances(newLive);
  }, [participants, dayOfWeek, myUserId]);

  // タイミングと順位更新
  useEffect(() => {
    // レースが終了した時だけ、最終距離（＝最終順位）に更新してレーンを入れ替える
    if (phase === "finished") {
      const finalLive: Record<string, number> = {};
      participants.forEach(p => { finalLive[p.id] = p.distance; });
      setLiveDistances(finalLive);
    }
  }, [phase, participants]);

  // 枠のソート（liveDistancesの降順）
  const sortedParticipants = [...participants].sort((a, b) => {
    const distA = liveDistances[a.id] ?? a.distance;
    const distB = liveDistances[b.id] ?? b.distance;
    return distB - distA;
  });

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden relative">
      {/* トラックヘッダー */}
      <div className="px-4 pt-3 pb-1 flex items-center justify-between">
        <span className="text-[11px] font-bold text-muted-foreground">START</span>
        <div className="flex-1 mx-3 border-b border-dashed border-border" />
        <span className="text-[11px] font-bold text-muted-foreground">🏁</span>
      </div>

      {/* レーン */}
      <div className="px-2 pb-3 space-y-0.5 relative">
        {sortedParticipants.map((p, index) => {
          const isMe = p.user_id === myUserId;
          const charType = (p.character_type || "cat") as CharacterType;
          const cpuXp = p.cpu_total_xp ?? 5000;
          const xpForChar = isMe ? userTotalXp : cpuXp;
          const rank = index + 1;

          // 初期位置・終了位置は useRef に保存したものを使う
          const conf = animConfigs.current[p.id] || { start: 0, final: p.distance, delay: 0.8, duration: 7.0 };
          const startPosition = conf.start * displayScale;
          const finalPosition = conf.final * displayScale;
          const raceDelay = phase === "racing" ? conf.delay : 0;
          const raceDuration = phase === "racing" ? conf.duration : 0.3;

          return (
            <motion.div
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                layout: { type: "spring", stiffness: 300, damping: 30 },
                opacity: { duration: 0.2 }
              }}
              key={p.id}
              className={`relative flex items-center gap-1.5 rounded-lg px-1.5 py-1 z-10 bg-card ${isMe
                ? "bg-accent/8 border border-accent/20 shadow-sm"
                : ""
                }`}
            >
              {/* 順位 */}
              <span className={`text-[10px] font-bold w-4 text-center shrink-0 ${rank === 1 ? "text-yellow-500" :
                rank === 2 ? "text-slate-400" :
                  rank === 3 ? "text-amber-600" :
                    "text-muted-foreground"
                }`}>
                {phase === "finished" ? rank : ""}
              </span>

              {/* トラックレーン */}
              <div className="flex-1 relative h-9 bg-linear-to-r from-emerald-900/10 via-emerald-800/5 to-emerald-900/10 rounded border border-border/30">
                {/* 芝模様 */}
                <div className="absolute inset-0 opacity-10" style={{
                  backgroundImage: "repeating-linear-gradient(90deg, transparent, transparent 8px, rgba(34,197,94,0.15) 8px, rgba(34,197,94,0.15) 9px)"
                }} />

                {/* キャラクター */}
                <motion.div
                  className="absolute top-1/2 -translate-y-1/2 z-10"
                  initial={{ left: `${startPosition}%` }}
                  animate={{
                    left: phase === "racing" || phase === "finished"
                      ? `${Math.min(finalPosition, 92)}%`
                      : `${startPosition}%`
                  }}
                  transition={{
                    duration: raceDuration,
                    delay: raceDelay,
                    ease: [0.25, 0.46, 0.45, 0.94], // カスタムイージング
                  }}
                >
                  <div className="relative -translate-x-1/2">
                    {/* 走行エフェクト（レース中のみ） */}
                    {phase === "racing" && (
                      <motion.div
                        className="absolute -left-6 top-1/2 -translate-y-1/2 text-[8px] text-muted-foreground/30"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0, 0.6, 0] }}
                        transition={{ duration: 0.3, repeat: 8, delay: raceDelay }}
                      >
                        💨
                      </motion.div>
                    )}
                    <PixelCharacterMini type={charType} totalXp={xpForChar} showCrown={rank === 1} />
                  </div>
                </motion.div>

                {/* ゴールライン */}
                <div className="absolute right-0 top-0 bottom-0 w-px bg-amber-500/30" />
              </div>

              {/* 名前＋距離 */}
              <div className="w-20 shrink-0 text-right">
                <div className={`text-[9px] font-semibold truncate ${isMe ? "text-accent" : "text-muted-foreground"
                  }`}>
                  {isMe ? "あなた" : p.display_name.replace("CPU ", "")}
                </div>
                <motion.div
                  className="text-[9px] text-muted-foreground"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: phase === "finished" ? 1 : 0 }}
                  transition={{ delay: 4 }}
                >
                  {p.distance.toLocaleString()}xp
                </motion.div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* カウントダウンオーバーレイ */}
      <AnimatePresence>
        {phase === "countdown" && (
          <CountdownOverlay />
        )}
      </AnimatePresence>
    </div>
  );
};

// =============================
// カウントダウンオーバーレイ
// =============================
const CountdownOverlay = () => {
  const [count, setCount] = useState(3);

  useEffect(() => {
    if (count > 0) {
      const timer = setTimeout(() => setCount(count - 1), 600);
      return () => clearTimeout(timer);
    }
  }, [count]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-20 rounded-2xl"
    >
      <AnimatePresence mode="wait">
        {count > 0 ? (
          <motion.div
            key={count}
            initial={{ scale: 2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="text-6xl font-black text-white drop-shadow-lg"
          >
            {count}
          </motion.div>
        ) : (
          <motion.div
            key="go"
            initial={{ scale: 3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="text-5xl font-black text-accent drop-shadow-lg"
          >
            GO! 🏇
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// =============================
// ランキングテーブル
// =============================
const RankingTable = ({
  participants,
  myUserId,
  userTotalXp,
}: {
  participants: RaceParticipant[];
  myUserId: string | null;
  userTotalXp: number;
}) => {
  const sorted = [...participants].sort((a, b) => b.distance - a.distance);
  const leader = sorted[0];

  return (
    <div className="space-y-2">
      {sorted.map((p, index) => {
        const rank = index + 1;
        const isMe = p.user_id === myUserId;
        const charType = (p.character_type || "cat") as CharacterType;
        const charDef = getCharacterDef(charType);
        const cpuXp = p.cpu_total_xp ?? 5000;
        const xpForChar = isMe ? userTotalXp : cpuXp;
        const stageIdx = getStageIndex(xpForChar);
        const stage = charDef.stages[stageIdx];
        const distFromLeader = leader ? leader.distance - p.distance : 0;

        return (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`rounded-xl p-3 border transition-all ${isMe
              ? "bg-accent/5 border-accent/30 ring-1 ring-accent/20"
              : "bg-card border-border"
              }`}
          >
            <div className="flex items-center gap-2.5">
              <RankBadge rank={rank} />
              <div className="shrink-0">
                <PixelCharacterMini type={charType} totalXp={xpForChar} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={`text-[13px] font-bold truncate ${isMe ? "text-accent" : "text-foreground"
                    }`}>
                    {isMe ? `${p.display_name} (あなた)` : p.display_name}
                  </span>
                  {p.is_cpu && (
                    <span className="text-[8px] font-semibold bg-secondary text-muted-foreground px-1 py-0.5 rounded border border-border">
                      CPU
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span>{stage.name} {charDef.nameJa}</span>
                  <span>•</span>
                  <span className="font-bold text-foreground">{p.distance.toLocaleString()} XP</span>
                  {rank > 1 && distFromLeader > 0 && (
                    <span className="text-red-400">(-{distFromLeader.toLocaleString()})</span>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

// =============================
// ガチャモーダル
// =============================
const CharacterModal = ({
  isOpen,
  onClose,
  currentType,
  totalXp,
  onComplete,
  initialGachaDone,
}: {
  isOpen: boolean;
  onClose: () => void;
  currentType: CharacterType;
  totalXp: number;
  onComplete: (type: CharacterType) => Promise<void>;
  initialGachaDone: boolean;
}) => {
  const [isSpinning, setIsSpinning] = useState(false);
  const [displayType, setDisplayType] = useState<CharacterType>(currentType);
  const [selectedType, setSelectedType] = useState<CharacterType | null>(null);

  useEffect(() => {
    setDisplayType(currentType);
    setSelectedType(null);
  }, [currentType, isOpen]);

  if (!isOpen) return null;

  const handleSpin = async () => {
    if (isSpinning || initialGachaDone) return;
    setIsSpinning(true);
    const interval = setInterval(() => {
      const nextType = CHARACTER_DEFS[Math.floor(Math.random() * CHARACTER_DEFS.length)].type;
      setDisplayType(nextType);
    }, 100);

    await new Promise((resolve) => setTimeout(resolve, 2200));
    clearInterval(interval);

    const finalType = CHARACTER_DEFS[Math.floor(Math.random() * CHARACTER_DEFS.length)].type;
    setDisplayType(finalType);
    setSelectedType(finalType);
    await onComplete(finalType);
    setIsSpinning(false);
    onClose();
  };

  const charDef = getCharacterDef(displayType);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="bg-card rounded-2xl p-6 max-w-sm w-full border border-border shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-foreground">キャラクターガチャ</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary transition">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="flex flex-col items-center gap-4 mb-5">
          <div className="w-28 h-28 rounded-3xl bg-secondary flex items-center justify-center text-4xl">
            {charDef.stages[0].emoji}
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-foreground">{charDef.nameJa}</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {selectedType ? "結果が決定しました！" : "ガチャを回してキャラクターを決定します。"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 mb-4">
          {CHARACTER_DEFS.map((def) => (
            <div
              key={def.type}
              className={`p-3 rounded-xl text-center border ${def.type === displayType ? "border-accent bg-accent/10" : "border-border bg-secondary"}`}>
              <div className="text-2xl">{def.stages[0].emoji}</div>
              <div className="text-[10px] text-muted-foreground mt-1">{def.nameJa}</div>
            </div>
          ))}
        </div>

        <button
          onClick={handleSpin}
          disabled={isSpinning || initialGachaDone}
          className="w-full py-3 rounded-2xl bg-accent text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {initialGachaDone ? "キャラクターは確定しています" : isSpinning ? "回しています..." : "ガチャを回す"}
        </button>
      </motion.div>
    </motion.div>
  );
};

// =============================
// メインページ
// =============================
export default function RacePage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [raceData, setRaceData] = useState<RaceData | null>(null);
  const [history, setHistory] = useState<RaceHistoryItem[]>([]);
  const [showCharacterModal, setShowCharacterModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [activeTab, setActiveTab] = useState<"track" | "ranking">("track");
  const [showRacePopup, setShowRacePopup] = useState(false);

  const [viewMode, setViewMode] = useState<"recap" | "current">("current");
  const hasViewedTodayRef = useRef(false);

  // レースアニメーション状態
  const [racePhase, setRacePhase] = useState<RacePhase>("loading");
  const animationTriggered = useRef(false);
  const raceTimers = useRef<NodeJS.Timeout[]>([]);

  // 認証
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/auth/login");
        return;
      }
      setUserId(data.session.user.id);
    })();
  }, [router]);

  // レースデータ取得
  const fetchRaceData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const data = await getOrCreateWeeklyRace(userId);
      setRaceData(data);
      const hist = await getRaceHistory(userId);
      setHistory(hist);
    } catch (err) {
      console.error("Failed to load race data:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchRaceData(); }, [fetchRaceData]);

  // レースアニメーション自動開始
  useEffect(() => {
    if (!raceData || animationTriggered.current) return;
    animationTriggered.current = true;

    // JST 00:00切替で厳密に未読/既読判定
    const todayJST = getJSTDateString();
    const hasViewedTodayJST = raceData.lastRaceViewDate === todayJST;
    hasViewedTodayRef.current = hasViewedTodayJST;

    let initialMode: "recap" | "current" = "current";
    if (!hasViewedTodayJST && raceData.recapParticipants) {
      initialMode = "recap";
    }
    setViewMode(initialMode);

    if ((hasViewedTodayJST || raceData.dayOfWeek === 1) && initialMode === "current") {
      setRacePhase("finished");
      return;
    }

    // 未閲覧時はポップアップを表示
    setShowRacePopup(true);

    // JST 00:00切替で既読マーク
    if (initialMode === "current" && userId) {
      markRaceAsViewed(userId).catch(console.error);
    }

    // Phase: ready → countdown → racing → finished
    setRacePhase("ready");
    raceTimers.current.forEach(clearTimeout);
    raceTimers.current = [];
    const t1 = setTimeout(() => setRacePhase("countdown"), 500);
    const t2 = setTimeout(() => setRacePhase("racing"), 2800);
    const t3 = setTimeout(() => {
      setRacePhase("finished");
    }, 15000);
    raceTimers.current = [t1, t2, t3];

    return () => { raceTimers.current.forEach(clearTimeout); raceTimers.current = []; };
  }, [raceData, userId]);

  // 今週のレースへ切り替え
  const handleGoToCurrentRace = useCallback(() => {
    setViewMode("current");

    // JST 00:00切替で既読マーク
    if (userId) {
      markRaceAsViewed(userId)
        .then(fetchRaceData)
        .catch(console.error);
      hasViewedTodayRef.current = true;
    }

    // 既存タイマーをクリア
    raceTimers.current.forEach(clearTimeout);
    raceTimers.current = [];

    // ポップアップが開いたままアニメーションをリセット
    setShowRacePopup(true);
    if (raceData?.dayOfWeek === 1) {
      setRacePhase("finished");
    } else {
      setRacePhase("ready");
      const t1 = setTimeout(() => setRacePhase("countdown"), 500);
      const t2 = setTimeout(() => setRacePhase("racing"), 2800);
      const t3 = setTimeout(() => {
        setRacePhase("finished");
      }, 15000);
      raceTimers.current = [t1, t2, t3];
    }
  }, [userId, fetchRaceData]);

  const handleGachaComplete = async (charType: CharacterType) => {
    if (!userId) return;
    await assignInitialCharacter(userId, charType);
    setShowCharacterModal(false);
    await fetchRaceData();
  };

  const myRank = raceData
    ? [...raceData.participants]
      .sort((a, b) => b.distance - a.distance)
      .findIndex((p) => p.user_id === userId) + 1
    : 0;

  const myCharType = ((raceData?.myParticipant?.character_type) || "cat") as CharacterType;
  const canChangeCharacter = !raceData?.characterGachaDone;

  // ローディング
  if (loading || !raceData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-12 h-12 border-4 border-border border-t-accent rounded-full mb-4"
        />
        <p className="text-muted-foreground text-sm font-medium">レースを読み込み中...</p>
      </div>
    );
  }

  if (!raceData.characterGachaDone && !raceData.myParticipant) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-card border border-border rounded-3xl p-8 text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">キャラクターを選択しよう</h1>
          <p className="text-muted-foreground text-sm mb-6">
            登録時に初回ガチャでキャラクターが決まります。今日のレースには今日の得点は反映されません。
          </p>
          <button
            onClick={() => setShowCharacterModal(true)}
            className="w-full px-4 py-3 rounded-2xl bg-accent text-white font-bold hover:opacity-90 transition"
          >
            ガチャを回す
          </button>
          <p className="text-[11px] text-muted-foreground mt-4">
            まだキャラクターが決まっていません。ランダムで1匹が選ばれます。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-24">
      <AnimatePresence>
        {showCharacterModal && (
          <CharacterModal
            isOpen={showCharacterModal}
            onClose={() => setShowCharacterModal(false)}
            currentType={myCharType}
            totalXp={raceData.userTotalXp}
            onComplete={handleGachaComplete}
            initialGachaDone={raceData.characterGachaDone}
          />
        )}
      </AnimatePresence>

      {/* レースポップアップモーダル */}
      <AnimatePresence>
        {showRacePopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md flex flex-col items-center justify-center z-60 p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              className="w-full max-w-2xl max-h-[calc(100vh-72px)] overflow-y-auto pb-24 md:pb-8"
              style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
            >
              {/* ポップアップヘッダー */}
              <div className="text-center mb-4">
                <h2 className="text-xl font-bold text-white flex items-center justify-center gap-2 mb-1">
                  {viewMode === "recap" ? "🏇 先週の最終結果" : "🏇 昨日まで中間結果"}
                </h2>
                {viewMode === "current" && <RankTierBadge rankInfo={raceData.rankInfo} />}
              </div>

              {/* レースアニメーション */}
              <HorseRaceAnimation
                participants={viewMode === "recap" && raceData.recapParticipants ? raceData.recapParticipants : raceData.participants}
                myUserId={userId}
                weeklyTarget={raceData.weeklyTarget}
                userTotalXp={raceData.userTotalXp}
                phase={racePhase}
                dayOfWeek={raceData.dayOfWeek}
              />

              {/* レース結果＋アクションボタン */}
              <AnimatePresence>
                {racePhase === "finished" && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="mt-4 space-y-3"
                  >
                    {/* 結果サマリー */}
                    <div className="bg-white/10 backdrop-blur rounded-xl p-4 text-center">
                      <div className="text-3xl font-black text-white mb-1">
                        {(() => {
                          const popupParticipants = viewMode === "recap" && raceData.recapParticipants ? raceData.recapParticipants : raceData.participants;
                          const sorted = [...popupParticipants].sort((a, b) => b.distance - a.distance);
                          const rank = sorted.findIndex(p => p.user_id === userId) + 1;
                          return rank === 1 ? "🥇 1位" : rank === 2 ? "🥈 2位" : rank === 3 ? "🥉 3位" : `${rank}位`;
                        })()}
                      </div>
                      <p className="text-[13px] text-white/70">
                        {viewMode === "recap" ? "先週の最終結果" : `${raceData.participants.length}人中`}
                      </p>
                    </div>

                    {/* ボタン */}
                    <div className="flex gap-3">
                      {viewMode === "recap" && (
                        <button
                          onClick={handleGoToCurrentRace}
                          className="flex-1 py-3 rounded-xl bg-accent text-white font-bold text-[14px] hover:opacity-90 transition shadow-lg flex items-center justify-center gap-2"
                        >
                          今週のレースを見る <ChevronRight className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => { setShowRacePopup(false); fetchRaceData(); }}
                        className={`${viewMode === "recap" ? "flex-1" : "w-full"} py-3 rounded-xl bg-white/15 text-white font-bold text-[14px] hover:bg-white/25 transition backdrop-blur flex items-center justify-center gap-2`}
                      >
                        <X className="w-4 h-4" />
                        閉じる
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-2xl mx-auto">
        {/* ヘッダー + ランク */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-4"
        >
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2 mb-1">
              {viewMode === "recap" ? "🏇 先週の最終結果" : "🏇 ウィークリーレース"}
            </h1>
            {viewMode === "current" && <RankTierBadge rankInfo={raceData.rankInfo} />}
            {raceData.raceId && viewMode === "current" && (
              <p className="text-[11px] text-muted-foreground mt-2">
                レースID: <span className="font-semibold text-foreground">{raceData.raceId.slice(0, 8)}</span>
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {viewMode === "recap" && (
              <motion.button
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleGoToCurrentRace}
                className="flex items-center gap-1.5 px-3 py-2 bg-accent text-white rounded-lg text-[13px] font-bold shadow-md hover:shadow-lg transition-all"
              >
                今週のレースを見る <ChevronRight className="w-4 h-4" />
              </motion.button>
            )}
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="p-2 rounded-lg bg-secondary border border-border hover:bg-muted transition"
            >
              <History className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </motion.div>

        {/* ランク詳細 */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <RankDetailCard rankInfo={raceData.rankInfo} userRank={raceData.userRank} />
        </motion.div>

        {/* ステータスカード */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-3 gap-3 mb-4"
        >
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-foreground">
              {myRank > 0 ? `${myRank}位` : "-"}
            </div>
            <div className="text-[10px] text-muted-foreground font-medium mt-0.5 flex items-center justify-center gap-1">
              <Target className="w-3 h-3" /> {raceData.participants.length}人中
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-accent">
              {raceData.myParticipant?.distance.toLocaleString() ?? 0}
            </div>
            <div className="text-[10px] text-muted-foreground font-medium mt-0.5 flex items-center justify-center gap-1">
              <Flame className="w-3 h-3" /> 今週XP
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-emerald-500">
              +{raceData.todayXp}
            </div>
            <div className="text-[10px] text-muted-foreground font-medium mt-0.5 flex items-center justify-center gap-1">
              <Zap className="w-3 h-3" /> 今日
            </div>
          </div>
        </motion.div>

        {/* 目標XP表示 + カウントダウン */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="flex items-center justify-between bg-card border border-border rounded-xl px-4 py-3 mb-4"
        >
          <div className="flex items-center gap-3">
            <CountdownTimer initialMs={raceData.timeRemainingMs} />
            <span className="text-[11px] text-muted-foreground">
              目標: <span className="font-bold text-foreground">{raceData.weeklyTarget.toLocaleString()} XP/週</span>
            </span>
          </div>
          {canChangeCharacter ? (
            <button
              onClick={() => setShowCharacterModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary border border-border rounded-lg hover:bg-muted transition text-[12px] font-medium text-foreground"
            >
              <PixelCharacterMini type={myCharType} totalXp={raceData.userTotalXp} />
              ガチャを回す
            </button>
          ) : (
            <button
              disabled
              className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary border border-border rounded-lg text-[12px] font-medium text-muted-foreground cursor-not-allowed"
            >
              <PixelCharacterMini type={myCharType} totalXp={raceData.userTotalXp} />
              キャラクター確定済み
            </button>
          )}
        </motion.div>

        {/* マイキャラクターカード */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="mb-4"
        >
          <CharacterCard
            type={myCharType}
            totalXp={raceData.userTotalXp}
            onClick={canChangeCharacter ? () => setShowCharacterModal(true) : undefined}
          />
        </motion.div>

        {/* タブ切替 */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-4"
        >
          <div className="flex gap-1 bg-secondary p-1 rounded-xl">
            <button
              onClick={() => setActiveTab("track")}
              className={`flex-1 py-2 px-3 rounded-lg text-[13px] font-semibold transition-all ${activeTab === "track"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground"
                }`}
            >
              🏇 レーストラック
            </button>
            <button
              onClick={() => setActiveTab("ranking")}
              className={`flex-1 py-2 px-3 rounded-lg text-[13px] font-semibold transition-all ${activeTab === "ranking"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground"
                }`}
            >
              🏆 ランキング
            </button>
          </div>
        </motion.div>

        {/* メインビュー */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mb-6"
        >
          {activeTab === "track" ? (
            showRacePopup ? (
              /* ポップアップ表示中はインラインは非表示（二重レンダリング防止） */
              <div className="bg-card border border-border rounded-2xl p-8 text-center text-muted-foreground text-sm">
                🏇 レースアニメーションを表示中...
              </div>
            ) : (
              <HorseRaceAnimation
                participants={viewMode === "recap" && raceData.recapParticipants ? raceData.recapParticipants : raceData.participants}
                myUserId={userId}
                weeklyTarget={raceData.weeklyTarget}
                userTotalXp={raceData.userTotalXp}
                phase={racePhase}
                dayOfWeek={raceData.dayOfWeek}
              />
            )
          ) : (
            <RankingTable
              participants={viewMode === "recap" && raceData.recapParticipants ? raceData.recapParticipants : raceData.participants}
              myUserId={userId}
              userTotalXp={raceData.userTotalXp}
            />
          )}
        </motion.div>

        {/* 学習CTA */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-linear-to-r from-accent/5 to-accent/10 border border-accent/20 rounded-xl p-5 mb-6"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-accent" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-foreground mb-1">XPを稼いで1位を目指そう！</h3>
              <p className="text-[12px] text-muted-foreground leading-relaxed mb-3">
                今週一番多くXPを稼いだ人が優勝！1位になるとランクが上がります。
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => router.push("/words/review")}
                  className="flex-1 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-[12px] font-semibold hover:opacity-90 transition flex items-center justify-center gap-1.5"
                >
                  単語復習 <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => router.push("/words/ai_teacher")}
                  className="flex-1 px-3 py-2 bg-secondary text-foreground rounded-lg text-[12px] font-semibold border border-border hover:bg-muted transition flex items-center justify-center gap-1.5"
                >
                  Part5 <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* 過去のレース履歴 */}
        <AnimatePresence>
          {showHistory && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-6"
            >
              <h2 className="text-base font-bold text-foreground flex items-center gap-2 mb-3">
                <History className="w-4 h-4 text-muted-foreground" />
                過去のレース
              </h2>
              {history.length === 0 ? (
                <div className="bg-card border border-border rounded-xl p-6 text-center">
                  <p className="text-muted-foreground text-sm">まだ履歴がありません</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {history.map((h) => (
                    <div key={h.week_start} className="bg-card border border-border rounded-xl p-3.5 flex items-center justify-between">
                      <div>
                        <span className="text-[12px] text-muted-foreground">{h.week_start} 〜</span>
                        <div className="text-[13px] font-semibold text-foreground">
                          {h.final_distance.toLocaleString()} XP
                        </div>
                        {h.rank_before !== undefined && h.rank_after !== undefined && h.rank_before !== h.rank_after && (
                          <div className={`text-[10px] font-bold flex items-center gap-0.5 ${h.rank_after < h.rank_before ? "text-emerald-500" : "text-red-400"
                            }`}>
                            {h.rank_after < h.rank_before ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                            {getRankInfo(h.rank_before).name} → {getRankInfo(h.rank_after).name}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-lg font-bold ${h.final_rank === 1 ? "text-yellow-500" :
                          h.final_rank === 2 ? "text-slate-400" :
                            h.final_rank === 3 ? "text-amber-600" :
                              "text-muted-foreground"
                          }`}>
                          {h.final_rank === 1 ? "🥇" : h.final_rank === 2 ? "🥈" : h.final_rank === 3 ? "🥉" : `${h.final_rank}位`}
                        </span>
                        <span className="text-[11px] text-muted-foreground">/ {h.total_participants}人</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ルール */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="bg-card border border-border rounded-xl p-5"
        >
          <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">📖 ルール</h3>
          <ul className="space-y-2 text-[12px] text-muted-foreground leading-relaxed">
            <li className="flex gap-2">
              <span className="text-accent font-bold shrink-0">•</span>
              月曜〜日曜の1週間で、最も多くXPを稼いだ人が優勝
            </li>
            <li className="flex gap-2">
              <span className="text-accent font-bold shrink-0">•</span>
              <strong>1位</strong>はランクが1つ上昇、<strong>最下位</strong>はランクが1つ下降
            </li>
            <li className="flex gap-2">
              <span className="text-accent font-bold shrink-0">•</span>
              ランクが上がるほど目標XPが高くなり、CPUも強くなります
            </li>
            <li className="flex gap-2">
              <span className="text-accent font-bold shrink-0">•</span>
              10人のプレイヤーで競争（足りない場合はCPUが参加）
            </li>
            <li className="flex gap-2">
              <span className="text-accent font-bold shrink-0">•</span>
              今日獲得した得点は今日のレース結果には反映されません
            </li>
            <li className="flex gap-2">
              <span className="text-accent font-bold shrink-0">•</span>
              レース状況は1日1回更新されます
            </li>
          </ul>
        </motion.div>
      </div>
    </div>
  );
}
