"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { speakText } from "@/lib/speech";
import { getImportanceClasses, getPartOfSpeechClasses } from "@/lib/utils";
import { useRouter } from "next/navigation";

// words_master テーブル
export interface WordsMaster {
  id: string;
  word: string;
  part_of_speech: string;
  meaning: string;
  example_sentence: string;
  translation: string;
  importance: string;
  registered_at: string;
}

// user_words テーブル
export interface UserWordRow {
  id: string;
  registered_at: string;
  word_id: string | null;
  correct_count: number | null;
  words_master: WordsMaster | WordsMaster[] | null;
}


// 変換後に使う型
export interface Word {
  id: string;
  registered_at: string;
  correct_count: number | null;
  word: string;
  part_of_speech: string;
  meaning: string;
  example_sentence: string;
  translation: string;
  importance: string;
}



export default function WordListPage() {
  const [words, setWords] = useState<Word[]>([]);
  const [filteredWords, setFilteredWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [selectedPart, setSelectedPart] = useState("");
  const [selectedImportance, setSelectedImportance] = useState("");

  const router = useRouter();

  

  // 🔐 ログインチェック
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) router.replace("/auth/login");
      else setLoading(false);
    })();
  }, [router]);

  // 📥 単語取得（user_words + words_master 結合）
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

      // ✅ user_words と words_master を結合
      const { data, error } = await supabase
        .from("user_words")
        .select(`
          id,
          registered_at,
          word_id,
          correct_count,
          words_master!inner (
            word,
            part_of_speech,
            meaning,
            example_sentence,
            translation,
            importance
          )
        `)
        .eq("user_id", user.id)
        .order("registered_at", { ascending: false });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      const formatted: Word[] =
        (data as UserWordRow[])?.map((item) => {
          const wm = Array.isArray(item.words_master)
            ? item.words_master[0]
            : item.words_master;

          return {
            id: item.id,
            registered_at: item.registered_at,
            correct_count: item.correct_count,
            word: wm?.word ?? "",
            part_of_speech: wm?.part_of_speech ?? "",
            meaning: wm?.meaning ?? "",
            example_sentence: wm?.example_sentence ?? "",
            translation: wm?.translation ?? "",
            importance: wm?.importance ?? "",
          };
        }) ?? [];



      setWords(formatted);
      setFilteredWords(formatted);
      setLoading(false);
    };

    fetchWords();
  }, []);

  // 🔍 フィルター
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
    if (selectedPart)
      filtered = filtered.filter((w) => w.part_of_speech === selectedPart);
    if (selectedImportance)
      filtered = filtered.filter((w) => w.importance === selectedImportance);

    setFilteredWords(filtered);
  }, [search, selectedPart, selectedImportance, words]);

  // 🗑 単語削除（user_words のみ削除）
  const handleDelete = async (id: string) => {
    if (!confirm("この単語を削除しますか？")) return;

    const { error } = await supabase.from("user_words").delete().eq("id", id);
    if (error) {
      alert("削除に失敗しました: " + error.message);
      return;
    }

    setWords((prev) => prev.filter((w) => w.id !== id));
  };

  if (loading) return <p>読み込み中...</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  const partOptions = Array.from(new Set(words.map((w) => w.part_of_speech)));
  const importanceOptions = Array.from(
    new Set(words.map((w) => w.importance))
  );

  return (
    <div className="p-4">
      <div className="bg-white p-4 rounded-xl shadow space-y-1 mb-4">
        <p>
          登録語数: <b>{words.length}</b>
        </p>
      </div>

      <h1 className="text-xl font-bold mb-4">登録済み単語一覧</h1>

      {/* 🔎 フィルター */}
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

      <div className="p-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
  {filteredWords.map((w) => (
    <div
      key={w.id}
      className="bg-white shadow-md rounded-xl p-4 flex flex-col justify-between hover:shadow-lg transition-shadow"
    >
      {/* 上段：単語・品詞・重要度 */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-lg font-bold truncate">{w.word}</span>
        <div className="flex gap-2">
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${getPartOfSpeechClasses(
              w.part_of_speech
            )}`}
          >
            {w.part_of_speech}
          </span>
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${getImportanceClasses(
              w.importance
            )}`}
          >
            {w.importance}
          </span>
        </div>
      </div>

      {/* 中段：意味・例文・訳 */}
      <div className="space-y-2 text-sm">
        <div>
          <p className="font-medium">意味:</p>
          <p className="text-gray-700 break-words">{w.meaning}</p>
        </div>

        <div>
          <p className="font-medium flex items-center">
            例文:
            <button
              onClick={() => speakText(w.example_sentence)}
              className="ml-2 bg-indigo-300 text-white px-2 py-1 rounded hover:bg-indigo-400 text-xs"
            >
              🔊
            </button>
          </p>
          <p className="text-gray-700 break-words">{w.example_sentence}</p>
        </div>

        <div>
          <p className="font-medium">訳:</p>
          <p className="text-gray-700 break-words">{w.translation}</p>
        </div>
      </div>

      {/* 下段：登録日・操作 */}
      <div className="flex items-center justify-between mt-4 text-xs text-gray-500">
        <span>{new Date(w.registered_at).toLocaleDateString("ja-JP")}</span>
        <span>{`正解数 ${w.correct_count ?? 0}回`}</span>
        <div className="flex gap-2">
          <button
            onClick={() => speakText(w.word)}
            className="bg-indigo-300 text-white px-2 py-1 rounded hover:bg-indigo-400 text-xs"
          >
            🔊 単語
          </button>
          <button
            onClick={() => handleDelete(w.id)}
            className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 text-xs"
          >
            削除
          </button>
        </div>
      </div>
    </div>
  ))}
</div>

    </div>
  );
}
