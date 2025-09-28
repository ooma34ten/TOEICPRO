"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { speakText } from "@/lib/speech";
import { useRouter } from "next/navigation";

type Word = {
  id: number;
  word: string;
  part_of_speech: string;
  meaning: string;
  example_sentence: string;
  translation: string;
  importance: string;
  registered_at: string;
};

export default function WordListPage() {
  const [words, setWords] = useState<Word[]>([]);
  const [filteredWords, setFilteredWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [selectedPart, setSelectedPart] = useState("");
  const [selectedImportance, setSelectedImportance] = useState("");

  const router = useRouter();

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) router.replace("/auth/login");
      else setLoading(false);
    })();
  }, [router]);

  // 単語取得
  useEffect(() => {
    const fetchWords = async () => {
      setLoading(true);
      setError(null);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("ログインが必要です");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("words")
        .select("*")
        .eq("user_id", user.id)
        .order("registered_at", { ascending: false });

      if (error) setError(error.message);
      else {
        setWords(data || []);
        setFilteredWords(data || []);
      }
      setLoading(false);
    };

    fetchWords();
  }, []);

  // フィルター
  useEffect(() => {
    let filtered = words;

    if (search) {
      const lower = search.toLowerCase();
      filtered = filtered.filter(
        (w) =>
          w.word.toLowerCase().includes(lower) ||
          w.meaning.toLowerCase().includes(lower)
      );
    }
    if (selectedPart) filtered = filtered.filter((w) => w.part_of_speech === selectedPart);
    if (selectedImportance) filtered = filtered.filter((w) => w.importance === selectedImportance);

    setFilteredWords(filtered);
  }, [search, selectedPart, selectedImportance, words]);

  // ✅ 単語削除処理
  const handleDelete = async (id: number) => {
    if (!confirm("この単語を削除しますか？")) return;

    const { error } = await supabase.from("words").delete().eq("id", id);
    if (error) {
      alert("削除に失敗しました: " + error.message);
      return;
    }

    setWords((prev) => prev.filter((w) => w.id !== id));
  };

  if (loading) return <p>読み込み中...</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  const partOptions = Array.from(new Set(words.map((w) => w.part_of_speech)));
  const importanceOptions = Array.from(new Set(words.map((w) => w.importance)));

  return (
    <div className="p-4">
      <div className="bg-white p-4 rounded-xl shadow space-y-1 mb-4">
        <p>登録語数: <b>{words.length}</b></p>
      </div>

      <h1 className="text-xl font-bold mb-4">登録済み単語一覧</h1>

      {/* フィルター */}
      <div className="flex flex-col md:flex-row gap-2 mb-4">
        <input
          type="text"
          placeholder="単語または意味で検索"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border p-2 rounded w-full md:w-1/3"
        />
        <select
          value={selectedPart}
          onChange={(e) => setSelectedPart(e.target.value)}
          className="border p-2 rounded w-full md:w-1/6"
        >
          <option value="">品詞すべて</option>
          {partOptions.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <select
          value={selectedImportance}
          onChange={(e) => setSelectedImportance(e.target.value)}
          className="border p-2 rounded w-full md:w-1/6"
        >
          <option value="">重要度すべて</option>
          {importanceOptions.map((i) => (
            <option key={i} value={i}>{i}</option>
          ))}
        </select>
      </div>

      {/* PC用テーブル */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full border-collapse border mb-4">
          <thead>
            <tr className="bg-gray-100">
              <th className="border-t border-b border-l-0 border-r-0  p-2">単語</th>
              <th className="border-t border-b p-2"></th>
              <th className="border p-2">品詞</th>
              <th className="border p-2">意味</th>
              <th className="border-t border-b border-l-0 border-r-0 border p-2">例文</th>
              <th className="border-t border-b p-2"></th>
              <th className="border p-2">訳</th>
              <th className="border p-2">重要度</th>
              <th className="border p-2">登録日</th>
              <th className="border p-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredWords.map((w) => (
              <tr key={w.id}>
                <td className="border-l-0 border-r-0 border p-2">{w.word}</td>
                {/* 縦線なしの音声ボタン列 */}
                <td className="border-t border-b border-l-0 border-r-0 p-2 text-center">
                  <button
                    onClick={() => speakText(w.word)}
                    className="bg-indigo-300 text-white px-2 py-1 rounded hover:bg-indigo-400 text-sm"
                  >
                    🔊
                  </button>
                </td>

                <td className="border p-2">{w.part_of_speech}</td>
                <td className="border p-2">{w.meaning}</td>

                <td className="border-t border-b border-l-0 border-r-0 border p-2">{w.example_sentence}</td>
                <td className="border-t border-b border-l-0 border-r-0 border-t border-b p-2 text-center">
                  <button
                    onClick={() => speakText(w.example_sentence)}
                    className="bg-indigo-300 text-white px-2 py-1 rounded hover:bg-indigo-400 text-sm"
                  >
                    🔊
                  </button>
                </td>

                <td className="border p-2">{w.translation}</td>
                <td className="border p-2">{w.importance}</td>
                <td className="border p-2">{new Date(w.registered_at).toLocaleDateString("ja-JP")}</td>
                <td className="border p-2 text-center">
                  <button
                    onClick={() => handleDelete(w.id)}
                    className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 text-sm"
                  >
                    削除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* モバイル用カード */}
      <div className="grid gap-4 md:hidden">
        {filteredWords.map((w) => (
          <div key={w.id} className="border rounded p-3 bg-white shadow space-y-1">
            <div className="flex items-center">
              <span className="font-semibold mr-0.5">単語:</span>
              <span>{w.word}</span>
              <button
                onClick={() => speakText(w.word)}
                className="ml-auto bg-indigo-300 text-white px-2 py-1 rounded hover:bg-indigo-400 text-sm"
              >
                🔊
              </button>
            </div>
            <div><span className="font-semibold mr-0.5">品詞:</span> {w.part_of_speech}</div>
            <div><span className="font-semibold mr-0.5">意味:</span> {w.meaning}</div>
            <div className="flex">
              <span className="font-semibold mr-1 flex-shrink-0">例文:</span>
              <span className="flex-1 break-words">{w.example_sentence}</span>
              <button
                onClick={() => speakText(w.example_sentence)}
                className="ml-2 bg-indigo-300 text-white px-2 py-1 rounded hover:bg-indigo-400 text-sm flex-shrink-0"
              >
                🔊
              </button>
            </div>
            <div><span className="font-semibold mr-0.5">訳:</span> {w.translation}</div>
            <div><span className="font-semibold mr-0.5">重要度:</span> {w.importance}</div>
            
            <div className="flex">
              <span className="font-semibold mr-1 flex-shrink-0">登録日:</span>
              <span className="flex-1 break-words">{new Date(w.registered_at).toLocaleDateString("ja-JP")}</span>
              <button
                onClick={() => handleDelete(w.id)}
                className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 text-sm"
              >
                削除
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
// src/app/words/list/page.tsx
