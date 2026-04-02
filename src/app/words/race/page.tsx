"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
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
  Minus,
} from "lucide-react";
import {
  getOrCreateWeeklyRace,
  updateCharacterType,
  getRaceHistory,
  type RaceData,
  type RaceParticipant,
  type RaceHistoryItem,
} from "@/app/actions/race";
import PixelCharacter, { PixelCharacterMini } from "@/components/PixelCharacter";
import CharacterCard, { CharacterSelectGrid } from "@/components/CharacterCard";
import {
  getCharacterDef,
  getStageIndex,
  CHARACTER_DEFS,
  type CharacterType,
} from "@/lib/characters";

// =============================
// 順位バッジ
// =============================
const RankBadge = ({ rank }: { rank: number }) => {
  if (rank === 1) {
    return (
      <div className="flex items-center justify-center w-7 h-7 rounded-full bg-yellow-400/20 border border-yellow-400/40">
        <Crown className="w-4 h-4 text-yellow-500 fill-yellow-500" />
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-300/20 border border-slate-400/40">
        <Medal className="w-4 h-4 text-slate-400" />
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="flex items-center justify-center w-7 h-7 rounded-full bg-amber-600/20 border border-amber-600/40">
        <Medal className="w-4 h-4 text-amber-600" />
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center w-7 h-7 rounded-full bg-[var(--secondary)] border border-[var(--border)]">
      <span className="text-[11px] font-bold text-[var(--muted-foreground)]">{rank}</span>
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
    <div className="flex items-center gap-1.5 text-[12px] text-[var(--muted-foreground)]">
      <Clock className="w-3.5 h-3.5" />
      <span>
        残り <span className="font-bold text-[var(--foreground)]">{days}日 {hours}時間 {minutes}分</span>
      </span>
    </div>
  );
};

// =============================
// 競馬場トラック — 鳥瞰図ビュー
// =============================
const HorseRaceTrack = ({
  participants,
  myUserId,
  raceGoal,
  userTotalXp,
}: {
  participants: RaceParticipant[];
  myUserId: string | null;
  raceGoal: number;
  userTotalXp: number;
}) => {
  const sorted = [...participants].sort((a, b) => b.distance - a.distance);

  // トラックのパーセントマーカー
  const markers = [0, 25, 50, 75, 100];

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 overflow-hidden">
      {/* マーカーヘッダー */}
      <div className="relative h-6 mb-1">
        {markers.map(pct => (
          <div
            key={pct}
            className="absolute top-0 text-[9px] font-bold text-[var(--muted-foreground)]"
            style={{ left: `${pct}%`, transform: "translateX(-50%)" }}
          >
            {pct === 100 ? "🏁" : `${pct}%`}
          </div>
        ))}
      </div>

      {/* レーン */}
      <div className="space-y-1">
        {sorted.map((p, index) => {
          const progress = Math.min((p.distance / raceGoal) * 100, 100);
          const isMe = p.user_id === myUserId;
          const isFinished = p.finished_at !== null;
          const rank = index + 1;
          const charType = (p.character_type || "cat") as CharacterType;
          const cpuXp = p.cpu_total_xp ?? 5000;
          const xpForChar = isMe ? userTotalXp : cpuXp;

          return (
            <div
              key={p.id}
              className={`relative flex items-center gap-2 rounded-lg px-2 py-1 transition-all ${
                isMe
                  ? "bg-[var(--accent)]/8 border border-[var(--accent)]/20"
                  : "border border-transparent"
              }`}
            >
              {/* 順位 */}
              <span className={`text-[10px] font-bold w-5 text-center shrink-0 ${
                rank === 1 ? "text-yellow-500" :
                rank === 2 ? "text-slate-400" :
                rank === 3 ? "text-amber-600" :
                "text-[var(--muted-foreground)]"
              }`}>
                {rank}
              </span>

              {/* トラック */}
              <div className="flex-1 relative h-8 bg-[var(--secondary)]/60 rounded overflow-visible">
                {/* 距離マーカーライン */}
                {[25, 50, 75].map(pct => (
                  <div
                    key={pct}
                    className="absolute top-0 bottom-0 w-px bg-[var(--border)]/50"
                    style={{ left: `${pct}%` }}
                  />
                ))}

                {/* ゴールライン */}
                <div className="absolute top-0 bottom-0 right-0 w-0.5 bg-amber-500/40" />

                {/* キャラクター */}
                <motion.div
                  className="absolute top-1/2 -translate-y-1/2 z-10"
                  initial={{ left: 0 }}
                  animate={{ left: `${Math.min(Math.max(progress, 1), 95)}%` }}
                  transition={{ duration: 1.5, ease: "easeOut", delay: index * 0.08 }}
                >
                  <div className="relative -translate-x-1/2">
                    <PixelCharacterMini
                      type={charType}
                      totalXp={xpForChar}
                    />
                  </div>
                </motion.div>

                {/* ゴール済みフラグ */}
                {isFinished && (
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px]">
                    🏁
                  </div>
                )}
              </div>

              {/* 名前 */}
              <span className={`text-[9px] font-medium w-16 truncate shrink-0 ${
                isMe ? "text-[var(--accent)] font-bold" : "text-[var(--muted-foreground)]"
              }`}>
                {isMe ? "あなた" : p.display_name.replace("CPU ", "")}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// =============================
// ランキングテーブル
// =============================
const RankingTable = ({
  participants,
  myUserId,
  raceGoal,
  userTotalXp,
}: {
  participants: RaceParticipant[];
  myUserId: string | null;
  raceGoal: number;
  userTotalXp: number;
}) => {
  const sorted = [...participants].sort((a, b) => b.distance - a.distance);
  const leader = sorted[0];

  return (
    <div className="space-y-2">
      {sorted.map((p, index) => {
        const rank = index + 1;
        const progress = Math.min((p.distance / raceGoal) * 100, 100);
        const isMe = p.user_id === myUserId;
        const isFinished = p.finished_at !== null;
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
            className={`rounded-xl p-3 border transition-all ${
              isMe
                ? "bg-[var(--accent)]/5 border-[var(--accent)]/30 ring-1 ring-[var(--accent)]/20"
                : "bg-[var(--card)] border-[var(--border)]"
            }`}
          >
            <div className="flex items-center gap-2.5">
              {/* 順位 */}
              <RankBadge rank={rank} />

              {/* キャラ */}
              <div className="shrink-0">
                <PixelCharacterMini type={charType} totalXp={xpForChar} />
              </div>

              {/* 名前・情報 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={`text-[13px] font-bold truncate ${
                    isMe ? "text-[var(--accent)]" : "text-[var(--foreground)]"
                  }`}>
                    {isMe ? `${p.display_name} (あなた)` : p.display_name}
                  </span>
                  {p.is_cpu && (
                    <span className="text-[8px] font-semibold bg-[var(--secondary)] text-[var(--muted-foreground)] px-1 py-0.5 rounded border border-[var(--border)]">
                      CPU
                    </span>
                  )}
                  {isFinished && (
                    <span className="text-[8px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1 py-0.5 rounded border border-emerald-500/20">
                      🏁 ゴール
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-[var(--muted-foreground)]">
                  <span>{stage.name} {charDef.nameJa}</span>
                  <span>•</span>
                  <span className="font-semibold">{p.distance.toLocaleString()}m</span>
                  {rank > 1 && distFromLeader > 0 && (
                    <span className="text-red-400">(-{distFromLeader.toLocaleString()})</span>
                  )}
                </div>
              </div>

              {/* プログレス値 */}
              <div className="text-right shrink-0">
                <div className="text-[13px] font-bold text-[var(--foreground)]">
                  {Math.round(progress)}%
                </div>
              </div>
            </div>

            {/* プログレスバー */}
            <div className="mt-2 h-1.5 bg-[var(--secondary)] rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${
                  isFinished
                    ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                    : isMe
                      ? "bg-gradient-to-r from-[var(--accent)] to-amber-400"
                      : rank <= 3
                        ? "bg-gradient-to-r from-blue-500 to-cyan-400"
                        : "bg-gradient-to-r from-slate-400 to-slate-300 dark:from-slate-600 dark:to-slate-500"
                }`}
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(progress, 1)}%` }}
                transition={{ duration: 1, ease: "easeOut", delay: index * 0.08 }}
              />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

// =============================
// キャラクター選択モーダル
// =============================
const CharacterModal = ({
  isOpen,
  onClose,
  currentType,
  totalXp,
  onSelect,
}: {
  isOpen: boolean;
  onClose: () => void;
  currentType: CharacterType;
  totalXp: number;
  onSelect: (type: CharacterType) => void;
}) => {
  if (!isOpen) return null;

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
        className="bg-[var(--card)] rounded-2xl p-6 max-w-sm w-full border border-[var(--border)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-[var(--foreground)]">キャラクター選択</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[var(--secondary)] transition">
            <X className="w-5 h-5 text-[var(--muted-foreground)]" />
          </button>
        </div>

        <CharacterSelectGrid
          currentType={currentType}
          totalXp={totalXp}
          onSelect={onSelect}
        />

        <p className="text-[11px] text-[var(--muted-foreground)] text-center mt-4">
          タップしてキャラクターを変更（進化段階はXPで決まります）
        </p>
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

  // 認証チェック
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

  useEffect(() => {
    fetchRaceData();
  }, [fetchRaceData]);

  // キャラクター変更
  const handleCharacterSelect = async (charType: CharacterType) => {
    if (!userId) return;
    await updateCharacterType(userId, charType);
    setShowCharacterModal(false);
    await fetchRaceData();
  };

  // 自分の順位を計算
  const myRank = raceData
    ? [...raceData.participants]
        .sort((a, b) => b.distance - a.distance)
        .findIndex((p) => p.user_id === userId) + 1
    : 0;

  const myCharType = ((raceData?.myParticipant?.character_type) || "cat") as CharacterType;

  // ローディング
  if (loading || !raceData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-12 h-12 border-4 border-[var(--border)] border-t-[var(--accent)] rounded-full mb-4"
        />
        <p className="text-[var(--muted-foreground)] text-sm font-medium">レースを読み込み中...</p>
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
            onSelect={handleCharacterSelect}
          />
        )}
      </AnimatePresence>

      <div className="max-w-2xl mx-auto">
        {/* ヘッダー */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-5"
        >
          <h1 className="text-xl font-bold text-[var(--foreground)] flex items-center gap-2">
            🏇 ウィークリーレース
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="p-2 rounded-lg bg-[var(--secondary)] border border-[var(--border)] hover:bg-[var(--muted)] transition"
              title="履歴"
            >
              <History className="w-4 h-4 text-[var(--muted-foreground)]" />
            </button>
          </div>
        </motion.div>

        {/* ステータスカード */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-3 gap-3 mb-5"
        >
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3.5 text-center">
            <div className="text-2xl font-bold text-[var(--foreground)]">
              {myRank > 0 ? `${myRank}位` : "-"}
            </div>
            <div className="text-[10px] text-[var(--muted-foreground)] font-medium mt-0.5 flex items-center justify-center gap-1">
              <Target className="w-3 h-3" /> {raceData.participants.length}人中
            </div>
          </div>

          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3.5 text-center">
            <div className="text-2xl font-bold text-[var(--accent)]">
              {raceData.myParticipant?.distance.toLocaleString() ?? 0}
            </div>
            <div className="text-[10px] text-[var(--muted-foreground)] font-medium mt-0.5 flex items-center justify-center gap-1">
              <Flame className="w-3 h-3" /> 走行距離 (m)
            </div>
          </div>

          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3.5 text-center">
            <div className="text-2xl font-bold text-emerald-500">
              +{raceData.todayXp}
            </div>
            <div className="text-[10px] text-[var(--muted-foreground)] font-medium mt-0.5 flex items-center justify-center gap-1">
              <Zap className="w-3 h-3" /> 今日の獲得
            </div>
          </div>
        </motion.div>

        {/* カウントダウン + キャラ変更 */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="flex items-center justify-between bg-[var(--card)] border border-[var(--border)] rounded-xl px-4 py-3 mb-5"
        >
          <CountdownTimer initialMs={raceData.timeRemainingMs} />
          <button
            onClick={() => setShowCharacterModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--secondary)] border border-[var(--border)] rounded-lg hover:bg-[var(--muted)] transition text-[12px] font-medium text-[var(--foreground)]"
          >
            <PixelCharacterMini type={myCharType} totalXp={raceData.userTotalXp} />
            キャラ変更
          </button>
        </motion.div>

        {/* マイキャラクターカード */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="mb-5"
        >
          <CharacterCard
            type={myCharType}
            totalXp={raceData.userTotalXp}
            onClick={() => setShowCharacterModal(true)}
          />
        </motion.div>

        {/* タブ切替: トラック / ランキング */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-4"
        >
          <div className="flex gap-1 bg-[var(--secondary)] p-1 rounded-xl">
            <button
              onClick={() => setActiveTab("track")}
              className={`flex-1 py-2 px-3 rounded-lg text-[13px] font-semibold transition-all ${
                activeTab === "track"
                  ? "bg-[var(--card)] text-[var(--foreground)] shadow-sm"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              🏇 レーストラック
            </button>
            <button
              onClick={() => setActiveTab("ranking")}
              className={`flex-1 py-2 px-3 rounded-lg text-[13px] font-semibold transition-all ${
                activeTab === "ranking"
                  ? "bg-[var(--card)] text-[var(--foreground)] shadow-sm"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              🏆 ランキング
            </button>
          </div>
        </motion.div>

        {/* レーストラック or ランキング */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mb-6"
        >
          {activeTab === "track" ? (
            <HorseRaceTrack
              participants={raceData.participants}
              myUserId={userId}
              raceGoal={raceData.raceGoal}
              userTotalXp={raceData.userTotalXp}
            />
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold text-[var(--foreground)] flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-[var(--accent)]" />
                  ランキング
                </h2>
                <span className="text-[11px] text-[var(--muted-foreground)]">
                  ゴール: {raceData.raceGoal.toLocaleString()}m
                </span>
              </div>
              <RankingTable
                participants={raceData.participants}
                myUserId={userId}
                raceGoal={raceData.raceGoal}
                userTotalXp={raceData.userTotalXp}
              />
            </>
          )}
        </motion.div>

        {/* 学習で進もう！CTA */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-r from-[var(--accent)]/5 to-[var(--accent)]/10 border border-[var(--accent)]/20 rounded-xl p-5 mb-6"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/15 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-[var(--accent)]" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-[var(--foreground)] mb-1">
                学習して前に進もう！
              </h3>
              <p className="text-[12px] text-[var(--muted-foreground)] leading-relaxed mb-3">
                単語復習やPart5問題を解くとXPが貯まり、レースで前に進めます。
                キャラクターもXPで進化します！
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => router.push("/words/review")}
                  className="flex-1 px-3 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg text-[12px] font-semibold hover:opacity-90 transition flex items-center justify-center gap-1.5"
                >
                  単語復習 <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => router.push("/words/ai_teacher")}
                  className="flex-1 px-3 py-2 bg-[var(--secondary)] text-[var(--foreground)] rounded-lg text-[12px] font-semibold border border-[var(--border)] hover:bg-[var(--muted)] transition flex items-center justify-center gap-1.5"
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
              <h2 className="text-base font-bold text-[var(--foreground)] flex items-center gap-2 mb-3">
                <History className="w-4 h-4 text-[var(--muted-foreground)]" />
                過去のレース
              </h2>
              {history.length === 0 ? (
                <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 text-center">
                  <p className="text-[var(--muted-foreground)] text-sm">まだ履歴がありません</p>
                  <p className="text-[var(--muted-foreground)] text-[11px] mt-1">
                    今週のレースが終わると結果が表示されます
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {history.map((h) => (
                    <div
                      key={h.week_start}
                      className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3.5 flex items-center justify-between"
                    >
                      <div>
                        <span className="text-[12px] text-[var(--muted-foreground)]">
                          {h.week_start} 〜
                        </span>
                        <div className="text-[13px] font-semibold text-[var(--foreground)]">
                          {h.final_distance.toLocaleString()}m 走行
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-lg font-bold ${
                          h.final_rank === 1 ? "text-yellow-500" :
                          h.final_rank === 2 ? "text-slate-400" :
                          h.final_rank === 3 ? "text-amber-600" :
                          "text-[var(--muted-foreground)]"
                        }`}>
                          {h.final_rank === 1 ? "🥇" : h.final_rank === 2 ? "🥈" : h.final_rank === 3 ? "🥉" : `${h.final_rank}位`}
                        </span>
                        <span className="text-[11px] text-[var(--muted-foreground)]">
                          / {h.total_participants}人中
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ルール説明 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5"
        >
          <h3 className="text-sm font-bold text-[var(--foreground)] mb-3 flex items-center gap-2">
            📖 ルール
          </h3>
          <ul className="space-y-2 text-[12px] text-[var(--muted-foreground)] leading-relaxed">
            <li className="flex gap-2">
              <span className="text-[var(--accent)] font-bold shrink-0">•</span>
              毎週月曜日にレースがリセットされます
            </li>
            <li className="flex gap-2">
              <span className="text-[var(--accent)] font-bold shrink-0">•</span>
              10人のプレイヤーで競争（プレイヤーが足りない場合はCPUが参加）
            </li>
            <li className="flex gap-2">
              <span className="text-[var(--accent)] font-bold shrink-0">•</span>
              単語復習・Part5問題で獲得したXPが距離に変換されます（1XP = 1m）
            </li>
            <li className="flex gap-2">
              <span className="text-[var(--accent)] font-bold shrink-0">•</span>
              ゴールは{raceData.raceGoal.toLocaleString()}m — 週末までに最も遠くにいた人が優勝！
            </li>
            <li className="flex gap-2">
              <span className="text-[var(--accent)] font-bold shrink-0">•</span>
              キャラクターは累計XPに応じて5段階に進化します
            </li>
          </ul>
        </motion.div>
      </div>
    </div>
  );
}
