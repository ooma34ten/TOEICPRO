"use client";

import { useState, useEffect, useCallback } from "react";
import WordForm, { Row } from "@/components/WordForm";
import { speakText } from "@/lib/speech";
import { supabase } from "@/lib/supabaseClient";
import { Volume2 } from "lucide-react";
import ReportButton from "@/components/ReportButton";

type WordsMaster = {
  word: string;
  part_of_speech: string;
  meaning: string;
  example_sentence: string;
  translation: string;
  importance: string;
  registered_at: string;
};

type UserWord = {
  id: number;
  word_id: number;
  correct_count: number;
  registered_at: string;
  words_master: WordsMaster | null; // 🔹 null許容に
};

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

export default function RegisterPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [words, setWords] = useState<Word[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchWords = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      // ゲストモードの場合はエラーメッセージを表示するが、ページは閲覧可能
      if (localStorage.getItem("guestMode") === "true") {
        setErrorMessage("ゲストモードでは単語の保存ができません。ログインしてご利用ください。");
        return;
      }
      setErrorMessage("保存にはログインが必要です");
      return;
    }

    const { data, error } = await supabase
      .from("user_words")
      .select(`
        id,
        word_id,
        correct_count,
        registered_at,
        words_master (
          word,
          part_of_speech,
          meaning,
          example_sentence,
          translation,
          importance,
          registered_at
        )
      `)
      .eq("user_id", user.id)
      .order("registered_at", { ascending: false });

    if (error) {
      console.error("Supabase error:", error);
      setErrorMessage("データ取得に失敗しました");
      return;
    }

    // ✅ data は unknown[] 型のため、まず unknown に変換してからアサーション
    const formattedWords = (data as unknown as UserWord[]).map((uw) => {
      const wm = uw.words_master; // 1件だけの想定
      if (!wm) return null; // 念のためチェック

      return {
        id: uw.id,
        word: wm.word,
        part_of_speech: wm.part_of_speech,
        meaning: wm.meaning,
        example_sentence: wm.example_sentence,
        translation: wm.translation,
        importance: wm.importance,
        registered_at: uw.registered_at,
      };
    }).filter((w): w is Word => w !== null); // null除外

    setWords(formattedWords);
  }, []);

  useEffect(() => {
    fetchWords();
  }, [fetchWords]);

  const handleAdd = (newRows: Row[]) => {
    setRows((prev) => [...prev, ...newRows]);
    fetchWords();
  };

  return (
    <div className="max-w-5xl mx-auto p-6 md:p-8 space-y-8">
      <div className="bg-[var(--card)] rounded-2xl shadow-lg p-6 md:p-8 border border-[var(--border)]">
        <h1 className="text-2xl font-bold mb-6 text-[var(--foreground)]">TOEIC単語登録</h1>
        <WordForm onAdd={handleAdd} />
      </div>

      <div className="bg-[var(--card)] p-5 rounded-2xl shadow-md border border-[var(--border)] text-[var(--muted-foreground)] flex items-center gap-3">
        <div className="w-2 h-8 bg-[var(--accent)] rounded-full"></div>
        <p>
          登録語数: <b>{words.length}</b>
        </p>
      </div>

      {errorMessage && <p className="text-red-500">{errorMessage}</p>}

      {rows.length > 0 && (
        <div className="bg-[var(--card)] p-6 md:p-8 rounded-2xl shadow-lg border border-[var(--border)]">
          <h2 className="text-xl font-bold mb-6 text-[var(--foreground)] border-b border-[var(--border)] pb-3">生成履歴</h2>
          <ul className="space-y-4">
            {rows
              .slice()
              .reverse()
              .map((row, idx) => (
                <li
                  key={idx}
                  className="border border-[var(--border)] p-5 rounded-xl bg-[var(--secondary)]/50 hover:bg-[var(--secondary)] transition shadow-sm"
                >
                  <p className="text-[var(--foreground)] mb-1">
                    <strong className="text-[var(--muted-foreground)] font-medium text-sm mr-2">単語:</strong>
                    <span className="font-bold text-lg text-[var(--accent)]">{row.word}</span>
                  </p>
                  <p className="text-[var(--foreground)] mb-1">
                    <strong className="text-[var(--muted-foreground)] font-medium text-sm mr-2">品詞:</strong>
                    <span className="bg-[var(--primary)] text-[var(--primary-foreground)] px-2 py-0.5 rounded text-xs">{row.part_of_speech}</span>
                  </p>
                  <p className="text-[var(--foreground)] mb-1">
                    <strong className="text-[var(--muted-foreground)] font-medium text-sm mr-2">意味:</strong> {row.meaning}
                  </p>
                  <p className="text-[var(--foreground)] mb-1">
                    <strong className="text-[var(--muted-foreground)] font-medium text-sm mr-2">例文:</strong> <span className="italic">"{row.example}"</span>
                  </p>
                  <p className="text-[var(--muted-foreground)] mb-1 text-sm">
                    <strong className="font-medium mr-2">翻訳:</strong> {row.translation}
                  </p>
                  <p className="text-[var(--muted-foreground)] mb-3 text-sm">
                    <strong className="font-medium mr-2">重要度:</strong> <span className="text-yellow-500">{row.importance}</span>
                  </p>
                  {row.synonyms && (
                    <div className="flex items-center gap-2 flex-wrap mb-3">
                      <span className="text-xs font-semibold text-[var(--muted-foreground)]">類義語:</span>
                      {row.synonyms.split(",").map((s: string, i: number) => (
                        <span key={i} className="text-xs bg-[var(--primary)]/10 text-[var(--accent)] px-2 py-0.5 rounded-full border border-[var(--primary)]/20">
                          {s.trim()}
                        </span>
                      ))}
                    </div>
                  )}
                  {row.isAlreadyRegistered && (
                    <span className="inline-block mb-3 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                      ✅ 登録済み
                    </span>
                  )}
                  <div className="flex gap-2 mt-4 pt-4 border-t border-[var(--border)]">
                    <button
                      onClick={() => speakText(row.word)}
                      className="flex items-center gap-1.5 bg-[var(--primary)] text-[var(--primary-foreground)] px-3 py-1.5 rounded-lg hover:opacity-90 text-sm shadow-sm transition"
                    >
                      <Volume2 size={14} /> 単語
                    </button>
                    <button
                      onClick={() => speakText(row.example)}
                      className="flex items-center gap-1.5 bg-[var(--secondary)] text-[var(--foreground)] border border-[var(--border)] px-3 py-1.5 rounded-lg hover:bg-[var(--accent)]/10 hover:text-[var(--accent)] hover:border-[var(--accent)]/30 text-sm shadow-sm transition"
                    >
                      <Volume2 size={14} /> 例文
                    </button>
                    <ReportButton wordText={row.word} />
                  </div>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}
