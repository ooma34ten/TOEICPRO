"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { speakText } from "@/lib/speech";
import { getImportanceClasses, getPartOfSpeechClasses } from "@/lib/utils";
import { useRouter } from "next/navigation";

// UI用単語型
export interface Word {
  id: string;
  registered_at: string;
  correct_count: number;
  word: string;
  part_of_speech: string;
  meaning: string;
  example_sentence: string;
  translation: string;
  importance: string;
  wrong: number;
  successRate: number;
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

  // ログインチェック
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) router.replace("/auth/login");
      else setLoading(false);
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

      // RPCで集計済み単語データ取得
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
          word: item.word ?? "",
          part_of_speech: item.part_of_speech ?? "",
          meaning: item.meaning ?? "",
          example_sentence: item.example_sentence ?? "",
          translation: item.translation ?? "",
          importance: item.importance ?? "",
          wrong,
          successRate,
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
    if (selectedImportance) filtered = filtered.filter((w) => w.importance === selectedImportance);

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

  if (loading) return <p>読み込み中...</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  const partOptions = Array.from(new Set(words.map((w) => w.part_of_speech))).filter(Boolean) as string[];
  const importanceOptions = Array.from(new Set(words.map((w) => w.importance))).filter(Boolean) as string[];

  return (
    <div className="p-4 relative">
      {/* モーダル */}
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-80 text-center">
            <h2 className="text-lg font-semibold mb-3">削除の確認</h2>
            <p className="text-sm text-gray-600 mb-4">
              {selectedIds.length} 件の単語を削除しますか？<br />
              この操作は取り消せません。
            </p>
            <div className="flex justify-center gap-4">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">キャンセル</button>
              <button onClick={handleBulkDelete} className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600">削除する</button>
            </div>
          </div>
        </div>
      )}

      {/* 上部バー */}
      <div className="bg-white p-4 rounded-xl shadow space-y-1 mb-4 flex flex-col md:flex-row justify-between items-center gap-2">
        <p>登録語数: <b>{words.length}</b></p>
        <div className="flex gap-2">
          <button onClick={toggleSelectAll} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm">
            {selectedIds.length === filteredWords.length && filteredWords.length > 0 ? "全解除" : "全選択"}
          </button>
          <button
            onClick={() => selectedIds.length > 0 && setShowModal(true)}
            disabled={selectedIds.length === 0}
            className={`px-4 py-2 rounded text-white text-sm ${selectedIds.length === 0 ? "bg-gray-400 cursor-not-allowed" : "bg-red-500 hover:bg-red-600"}`}
          >
            🗑 一括削除（{selectedIds.length}件）
          </button>
        </div>
      </div>

      {/* フィルター */}
      <div className="flex flex-col md:flex-row gap-2 mb-4">
        <input type="text" placeholder="単語または意味で検索" value={search} onChange={(e) => setSearch(e.target.value)} className="border p-2 rounded w-full md:w-1/3" />
        <select value={selectedPart} onChange={(e) => setSelectedPart(e.target.value)} className="border p-2 rounded w-full md:w-1/6">
          <option value="">品詞すべて</option>
          {partOptions.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={selectedImportance} onChange={(e) => setSelectedImportance(e.target.value)} className="border p-2 rounded w-full md:w-1/6">
          <option value="">重要度すべて</option>
          {importanceOptions.map((i) => <option key={i} value={i}>{i}</option>)}
        </select>
        <select value={sortOption} onChange={(e) => setSortOption(e.target.value as typeof sortOption)} className="border p-2 rounded w-full md:w-1/3">
          <option value="newest">登録日：新しい順</option>
          <option value="oldest">登録日：古い順</option>
          <option value="word_asc">単語：A→Z</option>
          <option value="word_desc">単語：Z→A</option>
          <option value="correct_desc">正解数：多い順</option>
          <option value="correct_asc">正解数：少ない順</option>
          <option value="successRate_desc">正解率：高い順</option>
          <option value="successRate_asc">正解率：低い順</option>
        </select>
      </div>

      {/* 単語カード */}
      <div className="p-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredWords.map((w) => (
          <div key={w.id} className={`shadow-md rounded-xl p-4 flex flex-col justify-between hover:shadow-lg transition-shadow ${selectedIds.includes(w.id) ? "ring-2 ring-red-400" : ""} ${w.correct_count >= 6 && w.successRate! >= 0.9 ? "bg-green-100 hover:bg-green-200" : "bg-white hover:bg-gray-100"}`}>
            <div className="flex justify-between items-center mb-2">
              <input type="checkbox" checked={selectedIds.includes(w.id)} onChange={() => toggleSelect(w.id)} className="w-4 h-4 accent-red-500" />
              <span className="text-xs text-gray-500">{new Date(w.registered_at).toLocaleDateString("ja-JP")}</span>
            </div>

            <div className="flex items-center justify-between mb-2">
              <span className="text-lg font-bold truncate">{w.word}</span>
              <div className="flex gap-2">
                {w.part_of_speech && <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${getPartOfSpeechClasses(w.part_of_speech)}`}>{w.part_of_speech}</span>}
                {w.importance && <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${getImportanceClasses(w.importance)}`}>{w.importance}</span>}
              </div>
            </div>

            <div className="space-y-2 text-sm">
              {w.meaning && <div><p className="font-medium">意味:</p><p className="text-gray-700 break-words">{w.meaning}</p></div>}
              {w.example_sentence && (
                <div>
                  <p className="font-medium flex items-center">
                    例文:
                    <button onClick={() => speakText(w.example_sentence)} className="ml-2 bg-indigo-300 text-white px-2 py-1 rounded hover:bg-indigo-400 text-xs">🔊</button>
                  </p>
                  <p className="text-gray-700 break-words">{w.example_sentence}</p>
                </div>
              )}
              {w.translation && <div><p className="font-medium">訳:</p><p className="text-gray-700 break-words">{w.translation}</p></div>}
            </div>
            
            {/* 正解率・誤答数 */}
            <div className="mt-3 text-sm font-semibold">
              <p className="text-gray-700">正解数: {w.correct_count} 回 / 誤答数: {w.wrong} 回</p>
              <p>
                正解率:{" "}
                <span
                  className={
                    w.successRate >= 0.8
                      ? "text-green-600"
                      : w.successRate >= 0.5
                      ? "text-yellow-600"
                      : "text-red-600"
                  }
                >
                  {(w.successRate * 100).toFixed(1)} %
                </span>
              </p>
            </div>

            <div className="flex items-center justify-between mt-4 text-xs text-gray-500">
              <div className="flex gap-2">
                <button onClick={() => speakText(w.word)} className="bg-indigo-300 text-white px-2 py-1 rounded hover:bg-indigo-400 text-xs">🔊 単語</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
