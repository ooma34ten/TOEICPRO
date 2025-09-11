// src/app/words/list/page.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { speakText } from "@/lib/speech";

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

  const [editingWordId, setEditingWordId] = useState<number | null>(null);
  const [editData, setEditData] = useState<Partial<Word>>({});

  // ページネーション用
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredWords.length / itemsPerPage);

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

      if (error) {
        setError(error.message);
      } else {
        setWords(data || []);
        setFilteredWords(data || []);
      }
      setLoading(false);
    };

    fetchWords();
  }, []);

  // フィルター処理
  useEffect(() => {
    let filtered = words;

    if (search) {
      const lowerSearch = search.toLowerCase();
      filtered = filtered.filter(
        (w) =>
          w.word.toLowerCase().includes(lowerSearch) ||
          w.meaning.toLowerCase().includes(lowerSearch)
      );
    }

    if (selectedPart) {
      filtered = filtered.filter((w) => w.part_of_speech === selectedPart);
    }

    if (selectedImportance) {
      filtered = filtered.filter((w) => w.importance === selectedImportance);
    }

    setFilteredWords(filtered);
    setCurrentPage(1); // フィルター変更時は1ページ目に戻す
  }, [search, selectedPart, selectedImportance, words]);

  if (loading) return <p>読み込み中...</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  const partOptions = Array.from(new Set(words.map((w) => w.part_of_speech)));
  const importanceOptions = Array.from(new Set(words.map((w) => w.importance)));

  // 編集開始
  const handleEdit = (word: Word) => {
    setEditingWordId(word.id);
    setEditData({ ...word });
  };

  // 編集キャンセル
  const handleCancel = () => {
    setEditingWordId(null);
    setEditData({});
  };

  // 編集保存
  const handleSave = async (id: number) => {
    const { error } = await supabase.from("words").update(editData).eq("id", id);
    if (error) {
      alert(error.message);
      return;
    }
    setWords(words.map((w) => (w.id === id ? { ...w, ...editData } : w)));
    setEditingWordId(null);
    setEditData({});
  };

  // 削除
  const handleDelete = async (id: number) => {
    if (!confirm("本当に削除しますか？")) return;
    const { error } = await supabase.from("words").delete().eq("id", id);
    if (error) {
      alert(error.message);
      return;
    }
    setWords(words.filter((w) => w.id !== id));
  };

  // ページネーション用データ
  const paginatedWords = filteredWords.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="p-4">
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
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select
          value={selectedImportance}
          onChange={(e) => setSelectedImportance(e.target.value)}
          className="border p-2 rounded w-full md:w-1/6"
        >
          <option value="">重要度すべて</option>
          {importanceOptions.map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </select>
      </div>

      {paginatedWords.length === 0 ? (
        <p>該当する単語はありません。</p>
      ) : (
        <>
          <table className="w-full border-collapse border mb-4">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2">単語</th>
                <th className="border p-2">品詞</th>
                <th className="border p-2">意味</th>
                <th className="border p-2">例文</th>
                <th className="border p-2">訳</th>
                <th className="border p-2">重要度</th>
                <th className="border p-2">登録日</th>
                <th className="border p-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {paginatedWords.map((w) => (
                <tr key={w.id}>
                  <td className="border p-2">
                    {editingWordId === w.id ? (
                      <input
                        value={editData.word || ""}
                        onChange={(e) => setEditData({ ...editData, word: e.target.value })}
                        className="border p-1 w-full"
                      />
                    ) : (
                      w.word
                    )}
                    <button
                      onClick={() => speakText(w.word)}
                      className="bg-indigo-300 text-white px-2 py-1 rounded hover:bg-indigo-400 transition text-sm"
                    >
                      🔊
                    </button>
                  </td>
                  <td className="border p-2">
                    {editingWordId === w.id ? (
                      <select
                        value={editData.part_of_speech || ""}
                        onChange={(e) =>
                          setEditData({ ...editData, part_of_speech: e.target.value })
                        }
                        className="border p-1 w-full"
                      >
                        {partOptions.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    ) : (
                      w.part_of_speech
                    )}
                  </td>
                  <td className="border p-2">
                    {editingWordId === w.id ? (
                      <input
                        value={editData.meaning || ""}
                        onChange={(e) => setEditData({ ...editData, meaning: e.target.value })}
                        className="border p-1 w-full"
                      />
                    ) : (
                      w.meaning
                    )}
                  </td>
                  <td className="border p-2">
                    {editingWordId === w.id ? (
                      <input
                        value={editData.example_sentence || ""}
                        onChange={(e) =>
                          setEditData({ ...editData, example_sentence: e.target.value })
                        }
                        className="border p-1 w-full"
                      />
                    ) : (
                      w.example_sentence
                    )}
                    <button
                      onClick={() => speakText(w.example_sentence)}
                      className="bg-indigo-300 text-white px-2 py-1 rounded hover:bg-indigo-400 transition text-sm"
                    >
                      🔊
                    </button>
                  </td>
                  <td className="border p-2">
                    {editingWordId === w.id ? (
                      <input
                        value={editData.translation || ""}
                        onChange={(e) =>
                          setEditData({ ...editData, translation: e.target.value })
                        }
                        className="border p-1 w-full"
                      />
                    ) : (
                      w.translation
                    )}
                  </td>
                  <td className="border p-2">
                    {editingWordId === w.id ? (
                      <select
                        value={editData.importance || ""}
                        onChange={(e) =>
                          setEditData({ ...editData, importance: e.target.value })
                        }
                        className="border p-1 w-full"
                      >
                        {importanceOptions.map((i) => (
                          <option key={i} value={i}>
                            {i}
                          </option>
                        ))}
                      </select>
                    ) : (
                      w.importance
                    )}
                  </td>
                  <td className="border p-2">
                    {new Date(w.registered_at).toLocaleDateString("ja-JP")}
                  </td>
                  <td className="border p-2 flex gap-1">
                    {editingWordId === w.id ? (
                      <>
                        <button
                          onClick={() => handleSave(w.id)}
                          className="bg-green-500 text-white px-2 py-1 rounded"
                        >
                          保存
                        </button>
                        <button
                          onClick={handleCancel}
                          className="bg-gray-300 px-2 py-1 rounded"
                        >
                          キャンセル
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleEdit(w)}
                          className="bg-blue-500 text-white px-2 py-1 rounded"
                        >
                          編集
                        </button>
                        <button
                          onClick={() => handleDelete(w.id)}
                          className="bg-red-500 text-white px-2 py-1 rounded"
                        >
                          削除
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ページネーション */}
          <div className="flex justify-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
            >
              前へ
            </button>
            <span className="px-3 py-1">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
            >
              次へ
            </button>
          </div>
        </>
      )}
    </div>
  );
}
// src/app/words/review/page.tsx
