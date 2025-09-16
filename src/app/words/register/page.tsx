"use client";

import { useState, useEffect } from "react";
import WordForm, { Row } from "@/components/WordForm";
import { speakText } from "@/lib/speech";
import { supabase } from "@/lib/supabaseClient";

type Word = {
  id: number;
  word: string;
  part_of_speech: string;
  meaning: string;
  example_sentence: string; // DBに合わせる
  translation: string;
  importance: string;
  registered_at: string;
};

export default function RegisterPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [words, setWords] = useState<Word[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
  const fetchWords = async () => {
    // 現在のユーザー情報を取得
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setErrorMessage("ログインが必要です");
      return;
    }

    const { data, error } = await supabase
      .from("words")
      .select("*")
      .eq("user_id", user.id) // ← uuid 型の user.id を利用
      .order("registered_at", { ascending: false });

    if (error) {
      setErrorMessage(error.message);
    } else {
      setWords(data || []);
    }
  };

  fetchWords();
}, []);

  const handleAdd = (newRows: Row[]) => {
    setRows((prev) => [...prev, ...newRows]);
  };

  return (
    <div className="p-6">
      {/* 概要 */}
      <div className="bg-white p-4 rounded-xl shadow space-y-1">
        <p>登録語数: <b>{words.length}</b></p>
      </div>

      <h1 className="text-2xl font-bold mb-4">TOEIC単語登録</h1>
      <WordForm onAdd={handleAdd} />

      {errorMessage && (
        <p className="text-red-500">Error: {errorMessage}</p>
      )}

      {rows.length > 0 && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-2">生成履歴</h2>
          <ul className="space-y-2">
            {rows.slice().reverse().map((row, idx) => (
              <li key={idx} className="border p-2 rounded bg-white shadow">
                <div className="mb-2">
                  <p><strong>単語:</strong> {row.word}</p>
                  <p><strong>品詞:</strong> {row.part_of_speech}</p>
                  <p><strong>意味:</strong> {row.meaning}</p>
                  <p><strong>例文:</strong> {row.example}</p>
                  <p><strong>翻訳:</strong> {row.translation}</p>
                  <p><strong>重要度:</strong> {row.importance}</p>
                </div>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => speakText(row.word)}
                    className="bg-indigo-300 text-white px-2 py-1 rounded hover:bg-indigo-400 transition text-sm"
                  >
                    単語 🔊
                  </button>
                  <button
                    onClick={() => speakText(row.example)}
                    className="bg-indigo-300 text-white px-2 py-1 rounded hover:bg-indigo-400 transition text-sm"
                  >
                    例文 🔊
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
// src/app/words/register/page.tsx

