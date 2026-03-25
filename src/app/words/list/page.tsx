"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { speakText } from "@/lib/speech";
import { getImportanceClasses, getPartOfSpeechClasses, importanceToStars, isWeakWord, parseImportance } from "@/lib/utils";
import ReportButton from "@/components/ReportButton";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Volume2,
  Search,
  Filter,
  Trash2,
  CheckSquare,
  Square,
  AlertTriangle,
  Library,
} from "lucide-react";

// UI用単語型
export interface Word {
  id: string;
  registered_at: string;
  correct_count: number;
  total: number;
  word: string;
  part_of_speech: string;
  meaning: string;
  example_sentence: string;
  translation: string;
  importance: string;
  wrong: number;
  successRate: number;
  synonyms?: string;
}

export default function WordListPage() {
  const [words, setWords] = useState<Word[]>([]);
  const [filteredWords, setFilteredWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [selectedPart, setSelectedPart] = useState("");
  const [selectedImportance, setSelectedImportance] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [sortOption, setSortOption] = useState<
    "newest" | "oldest" | "word_asc" | "word_desc" | "correct_desc" | "correct_asc" | "successRate_desc" | "successRate_asc"
  >("newest");

  const router = useRouter();

  // ログイン / ゲストチェック
  const [isGuest, setIsGuest] = useState(false);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        if (localStorage.getItem("guestMode") === "true") {
          setIsGuest(true);
          setLoading(false);
        } else {
          router.replace("/auth/login");
        }
      } else {
        setLoading(false);
      }
    })();
  }, [router]);

  // 単語取得（RPC版）
  useEffect(() => {
    const fetchWords = async () => {
      setLoading(true);
      setError(null);

      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) {
        setError("ログインが必要です");
        setLoading(false);
        return;
      }

      const { data: rpcData, error: rpcErr } = await supabase
        .rpc("get_user_word_stats", { p_user_id: userData.user.id });

      if (rpcErr) {
        setError(rpcErr.message);
        setLoading(false);
        return;
      }

      interface UserWordStatsRPC {
        user_word_id: string;
        registered_at: string;
        word: string | null;
        part_of_speech: string | null;
        meaning: string | null;
        example_sentence: string | null;
        translation: string | null;
        importance: string | null;
        total: number | null;
        correct: number | null;
        synonyms: string | null;
      }

      const formatted: Word[] = (rpcData ?? []).map((item: UserWordStatsRPC) => {
        const total = item.total ?? 0;
        const correct = item.correct ?? 0;
        const wrong = total - correct;
        const successRate = total > 0 ? correct / total : 0;

        return {
          id: item.user_word_id,
          registered_at: item.registered_at,
          correct_count: correct,
          total,
          word: item.word ?? "",
          part_of_speech: item.part_of_speech ?? "",
          meaning: item.meaning ?? "",
          example_sentence: item.example_sentence ?? "",
          translation: item.translation ?? "",
          importance: item.importance ?? "",
          wrong,
          successRate,
          synonyms: item.synonyms ?? "",
        };
      });

      setWords(formatted);
      setFilteredWords(formatted);
      setLoading(false);
    };

    fetchWords();
  }, []);

  // フィルター＆ソート
  useEffect(() => {
    let filtered = [...words];
    if (search.trim() !== "") {
      const lower = search.trim().toLowerCase();
      filtered = filtered.filter(
        (w) =>
          w.word.toLowerCase().includes(lower) ||
          w.meaning.toLowerCase().includes(lower) ||
          w.translation.toLowerCase().includes(lower)
      );
    }
    if (selectedPart) filtered = filtered.filter((w) => w.part_of_speech === selectedPart);
    if (selectedImportance) filtered = filtered.filter((w) => parseImportance(w.importance) === Number(selectedImportance));

    switch (sortOption) {
      case "newest":
        filtered.sort((a, b) => new Date(b.registered_at).getTime() - new Date(a.registered_at).getTime());
        break;
      case "oldest":
        filtered.sort((a, b) => new Date(a.registered_at).getTime() - new Date(b.registered_at).getTime());
        break;
      case "word_asc":
        filtered.sort((a, b) => a.word.localeCompare(b.word));
        break;
      case "word_desc":
        filtered.sort((a, b) => b.word.localeCompare(a.word));
        break;
      case "correct_desc":
        filtered.sort((a, b) => b.correct_count - a.correct_count);
        break;
      case "correct_asc":
        filtered.sort((a, b) => a.correct_count - b.correct_count);
        break;
      case "successRate_desc":
        filtered.sort((a, b) => b.successRate - a.successRate);
        break;
      case "successRate_asc":
        filtered.sort((a, b) => a.successRate - b.successRate);
        break;
    }

    setFilteredWords(filtered);
  }, [search, selectedPart, selectedImportance, sortOption, words]);

  // 一括削除
  const handleBulkDelete = async () => {
    const { error } = await supabase.from("user_words").delete().in("id", selectedIds);
    if (error) {
      alert("削除に失敗しました: " + error.message);
      return;
    }
    setWords((prev) => prev.filter((w) => !selectedIds.includes(w.id)));
    setSelectedIds([]);
    setShowModal(false);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const toggleSelectAll = () => {
    if (selectedIds.length === filteredWords.length) setSelectedIds([]);
    else setSelectedIds(filteredWords.map((w) => w.id));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--background)]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full mb-4"
        />
        <p className="text-[var(--muted-foreground)] text-sm font-medium">読み込み中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)] p-4">
        <div className="bg-[var(--card)] rounded-xl p-8 text-center max-w-md border border-red-500/20">
          <p className="text-red-600 dark:text-red-400 text-sm font-medium">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-6 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg font-semibold text-sm hover:opacity-90 transition"
          >
            再読み込み
          </button>
        </div>
      </div>
    );
  }

  const partOptions = Array.from(new Set(words.map((w) => w.part_of_speech))).filter(Boolean) as string[];
  const importanceOptions = Array.from(new Set(words.map((w) => parseImportance(w.importance)))).filter(Boolean).sort((a, b) => a - b);

  return (
    <div className="relative pb-4">
      {/* 削除確認モーダル */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[var(--card)] p-5 rounded-xl w-80 text-center border border-[var(--border)]"
            >
              <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center mx-auto mb-3">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <h2 className="text-base font-bold mb-1.5 text-[var(--foreground)]">削除の確認</h2>
              <p className="text-[13px] text-[var(--muted-foreground)] mb-5">
                {selectedIds.length} 件の単語を削除しますか？<br />
                この操作は取り消せません。
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 bg-[var(--secondary)] text-[var(--foreground)] rounded-lg font-medium text-sm hover:bg-[var(--muted)] transition"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg font-medium text-sm hover:bg-red-600 transition"
                >
                  削除する
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ヘッダー */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-[var(--foreground)] flex items-center gap-2">
            <Library className="w-5 h-5 text-[var(--accent)]" />
            My単語帳
          </h1>
          <div className="flex items-center gap-2">
            <span className="bg-[var(--accent)]/10 text-[var(--accent)] px-2.5 py-0.5 rounded-md text-[12px] font-bold border border-[var(--accent)]/20">
              {words.length} 語
            </span>
          </div>
        </div>
      </motion.div>

      {/* 操作バー */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="bg-[var(--card)] p-4 rounded-xl border border-[var(--border)] mb-4"
      >
        <div className="flex flex-col md:flex-row gap-3">
          {/* 検索 */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
            <input
              type="text"
              placeholder="単語または意味で検索"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-[var(--border)] bg-[var(--secondary)] text-[var(--foreground)] rounded-lg focus:ring-2 focus:ring-[var(--accent)]/40 focus:border-[var(--accent)] outline-none transition text-sm placeholder:text-[var(--muted-foreground)]"
            />
          </div>

          {/* フィルター */}
          <div className="flex gap-2 flex-wrap">
            <div className="relative">
              <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--muted-foreground)] pointer-events-none" />
              <select
                value={selectedPart}
                onChange={(e) => setSelectedPart(e.target.value)}
                className="pl-8 pr-3 py-2.5 border border-[var(--border)] bg-[var(--secondary)] text-[var(--foreground)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--accent)]/40 outline-none appearance-none cursor-pointer"
              >
                <option value="">品詞すべて</option>
                {partOptions.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <select
              value={selectedImportance}
              onChange={(e) => setSelectedImportance(e.target.value)}
              className="px-3 py-2.5 border border-[var(--border)] bg-[var(--secondary)] text-[var(--foreground)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--accent)]/40 outline-none appearance-none cursor-pointer"
            >
              <option value="">重要度すべて</option>
              {importanceOptions.map((i) => <option key={i} value={i}>{"★".repeat(i)}</option>)}
            </select>
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as typeof sortOption)}
              className="px-3 py-2.5 border border-[var(--border)] bg-[var(--secondary)] text-[var(--foreground)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--accent)]/40 outline-none appearance-none cursor-pointer"
            >
              <option value="newest">新しい順</option>
              <option value="oldest">古い順</option>
              <option value="word_asc">A→Z</option>
              <option value="word_desc">Z→A</option>
              <option value="correct_desc">正解数↓</option>
              <option value="correct_asc">正解数↑</option>
              <option value="successRate_desc">正解率↓</option>
              <option value="successRate_asc">正解率↑</option>
            </select>
          </div>
        </div>

        {/* 選択操作 */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--border)]">
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--accent)] transition font-medium"
          >
            {selectedIds.length === filteredWords.length && filteredWords.length > 0 ? (
              <CheckSquare className="w-4 h-4" />
            ) : (
              <Square className="w-4 h-4" />
            )}
            {selectedIds.length === filteredWords.length && filteredWords.length > 0 ? "全解除" : "全選択"}
          </button>
          <button
            onClick={() => selectedIds.length > 0 && setShowModal(true)}
            disabled={selectedIds.length === 0}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              selectedIds.length === 0
                ? "bg-[var(--secondary)] text-[var(--muted-foreground)] cursor-not-allowed"
                : "bg-red-500 text-white hover:bg-red-600"
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            削除（{selectedIds.length}件）
          </button>
        </div>
      </motion.div>

      {/* 単語カード */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredWords.map((w, idx) => (
          <motion.div
            key={w.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(idx * 0.03, 0.5) }}
            className={`bg-[var(--card)] rounded-xl p-4 flex flex-col justify-between hover:shadow-md transition-all border ${
              selectedIds.includes(w.id)
                ? "ring-2 ring-red-400 border-red-500/30"
                : w.correct_count >= 6 && w.successRate >= 0.9
                ? "border-emerald-500/30 bg-emerald-500/5"
                : isWeakWord(w.total, w.successRate)
                ? "border-red-500/30 border-l-4 !border-l-red-400"
                : "border-[var(--border)]"
            }`}
          >
            <div className="flex justify-between items-center mb-3">
              <input
                type="checkbox"
                checked={selectedIds.includes(w.id)}
                onChange={() => toggleSelect(w.id)}
                className="w-4 h-4 accent-red-500 rounded"
              />
              <span className="text-[11px] text-[var(--muted-foreground)]">
                {new Date(w.registered_at).toLocaleDateString("ja-JP")}
              </span>
            </div>

            <div className="flex items-center justify-between mb-3">
              <span className="text-base font-bold text-[var(--foreground)] truncate">{w.word}</span>
              <div className="flex gap-1.5 shrink-0 ml-2">
                {w.part_of_speech && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${getPartOfSpeechClasses(w.part_of_speech)}`}>
                    {w.part_of_speech}
                  </span>
                )}
                {w.importance && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${getImportanceClasses(w.importance)}`}>
                    {importanceToStars(w.importance)}
                  </span>
                )}
                {isWeakWord(w.total, w.successRate) && (
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold whitespace-nowrap bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                    🔴 苦手
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-2 text-sm">
              {w.meaning && (
                <div>
                  <p className="font-medium text-[var(--muted-foreground)] text-[11px] mb-0.5">意味</p>
                  <p className="text-[var(--foreground)] break-words text-[13px]">{w.meaning}</p>
                </div>
              )}
              {w.example_sentence && (
                <div>
                  <p className="font-medium text-[var(--muted-foreground)] text-[11px] mb-0.5 flex items-center gap-1">
                    例文
                    <button
                      onClick={() => speakText(w.example_sentence)}
                      className="p-1 rounded-md bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20 transition"
                    >
                      <Volume2 className="w-3 h-3" />
                    </button>
                  </p>
                  <p className="text-[var(--foreground)] break-words text-[11px] leading-relaxed">{w.example_sentence}</p>
                </div>
              )}
              {w.translation && (
                <div>
                  <p className="font-medium text-[var(--muted-foreground)] text-[11px] mb-0.5">訳</p>
                  <p className="text-[var(--foreground)] break-words text-[11px]">{w.translation}</p>
                </div>
              )}
              {w.synonyms && (
                <div className="flex items-center gap-1.5 flex-wrap mt-1">
                  <span className="text-[11px] font-semibold text-[var(--accent)]">類義語:</span>
                  {w.synonyms.split(",").map((s: string, i: number) => (
                    <span key={i} className="text-[11px] bg-[var(--accent)]/10 text-[var(--accent)] px-2 py-0.5 rounded border border-[var(--accent)]/20">
                      {s.trim()}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* 正解率 */}
            <div className="mt-3 pt-3 border-t border-[var(--border)]">
              <div className="flex items-center justify-between text-[11px]">
                <div className="flex gap-3 text-[var(--muted-foreground)]">
                  <span>正解 <strong className="text-emerald-600 dark:text-emerald-400">{w.correct_count}</strong></span>
                  <span>誤答 <strong className="text-red-500 dark:text-red-400">{w.wrong}</strong></span>
                </div>
                <span
                  className={`font-bold ${
                    w.successRate >= 0.8
                      ? "text-emerald-600 dark:text-emerald-400"
                      : w.successRate >= 0.5
                      ? "text-[var(--accent)]"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {(w.successRate * 100).toFixed(0)}%
                </span>
              </div>
            </div>

            {/* アクション */}
            <div className="flex items-center justify-between mt-3">
              <div className="flex gap-1.5">
                <button
                  onClick={() => speakText(w.word)}
                  className="p-1.5 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20 transition"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
                <ReportButton wordId={w.id} wordText={w.word} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* 空状態 */}
      {filteredWords.length === 0 && !loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-20"
        >
          <Library className="w-12 h-12 text-[var(--muted-foreground)] opacity-20 mx-auto mb-4" />
          <p className="text-[var(--muted-foreground)] font-medium text-base">
            {search || selectedPart || selectedImportance
              ? "条件に一致する単語がありません"
              : "まだ単語が登録されていません"
            }
          </p>
          {!search && !selectedPart && !selectedImportance && (
            <button
              onClick={() => router.push("/words/register")}
              className="mt-4 px-5 py-2.5 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg font-semibold text-sm hover:opacity-90 transition"
            >
              単語を登録する
            </button>
          )}
        </motion.div>
      )}
    </div>
  );
}
