"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { speakText } from "@/lib/speech";
import { getImportanceClasses, getPartOfSpeechClasses, importanceToStars } from "@/lib/utils";
import { Loader2, Volume2, Save, Wand2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast, { Toaster } from "react-hot-toast";
import ReportButton from "@/components/ReportButton";

export interface Row {
  word: string;
  part_of_speech: string;
  meaning: string;
  example: string;
  translation: string;
  importance: string;
  synonyms?: string;
  selected?: boolean;
  isAlreadyRegistered?: boolean;
}

interface WordFormProps {
  onAdd: (rows: Row[], word: string) => void;
}

export default function WordForm({ onAdd }: WordFormProps) {
  const [inputWord, setInputWord] = useState("");
  const [correctedWord, setCorrectedWord] = useState("");
  const [holdWord, setHoldWord] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!inputWord.trim()) {
      setMsg("単語を入力してください");
      return;
    }

    setLoading(true);
    setMsg("生成中...");

    try {
      const lowerWord = inputWord.trim().toLowerCase();

      // 🔹 スペルチェック
      setMsg("スペル確認中...");
      const spellRes = await fetch("/api/spell-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: lowerWord }),
      });
      const spellData: { correctedWord: string } = await spellRes.json();
      const finalWord = spellData.correctedWord.toLowerCase();
      setCorrectedWord(finalWord);

      if (finalWord !== lowerWord) {
        setMsg(`修正されました: ${inputWord} → ${finalWord}`);
      } else {
        setMsg("修正不要");
      }

      setHoldWord(inputWord);

      // 🔹 Supabase で既存単語取得
      setMsg("既存単語チェック中...");
      const { data: existingWords } = await supabase
        .from("words_master")
        .select("*")
        .eq("word", finalWord);

      // 🔹 ユーザーの登録済み単語をチェック
      let user = null;
      try {
        const res = await supabase.auth.getUser();
        user = res.data.user;
      } catch (e) {
        console.warn("Failed to get user:", e);
      }
      let registeredMeanings = new Set<string>();
      if (user?.id && existingWords && existingWords.length > 0) {
        const wordIds = existingWords.map((w: { id: string }) => w.id);
        const { data: userWords } = await supabase
          .from("user_words")
          .select("word_id")
          .eq("user_id", user.id)
          .in("word_id", wordIds);
        const registeredWordIds = new Set((userWords ?? []).map((uw: { word_id: string }) => uw.word_id));
        existingWords.forEach((w: { id: string; meaning: string }) => {
          if (registeredWordIds.has(w.id)) {
            registeredMeanings.add(w.meaning);
          }
        });
      }

      let displayRows: Row[] = [];

      if (!existingWords || existingWords.length === 0) {
        // 🔹 Gemini API で新規単語生成
        setMsg("単語情報生成中...");
        const geminiRes = await fetch("/api/gemini", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: finalWord }),
        });
        const geminiData: { answer?: string } = await geminiRes.json();

        if (!geminiData.answer) {
          setMsg("もう一度お試しください。もしくは別の単語でお願いします。");
          return;
        }

        const clean = geminiData.answer.replace(/^```json\s*[\r\n]?/, "").replace(/```$/, "").trim();

        type GeminiRow = Partial<Row> & { definition?: string; synonyms?: string };
        let parsed: { definitions?: GeminiRow[]; meanings?: GeminiRow[] } = {};
        try {
          parsed = JSON.parse(clean);
        } catch {
          setMsg("JSON形式ではありません: " + clean);
          return;
        }

        const newRows: Row[] = (parsed.definitions || parsed.meanings || []).map((m: GeminiRow) => ({
          word: m.word ?? finalWord,
          part_of_speech: m.part_of_speech ?? "",
          meaning: m.meaning ?? m.definition ?? "",
          example: m.example ?? "",
          translation: m.translation ?? "",
          importance: m.importance ?? "",
          synonyms: m.synonyms ?? "",
          selected: true,
          isAlreadyRegistered: false,
        }));

        if (!newRows.length) {
          setMsg("意味が生成されませんでした");
          return;
        }

        // 🔹 Supabase に保存
        const saveRes = await fetch("/api/add-to-master", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ words: newRows }),
        });
        const saveResult = await saveRes.json();
        if (!saveResult.success) {
          console.error("add-to-master API エラー:", saveResult.message);
        }

        displayRows = newRows;
      } else {
        // 🔹 既存単語を UI に表示
        displayRows = existingWords.map((r: { word: string; part_of_speech?: string; meaning?: string; example_sentence?: string; translation?: string; importance?: string; synonyms?: string }) => {
          const isRegistered = registeredMeanings.has(r.meaning ?? "");
          return {
            word: r.word,
            part_of_speech: r.part_of_speech ?? "",
            meaning: r.meaning ?? "",
            example: r.example_sentence ?? "",
            translation: r.translation ?? "",
            importance: r.importance ?? "",
            synonyms: r.synonyms ?? "",
            selected: !isRegistered,
            isAlreadyRegistered: isRegistered,
          };
        });
      }

      setRows(displayRows);
      setMsg("生成完了");
      onAdd(displayRows, finalWord);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "不明なエラーです";
      toast.error("生成エラー: " + message);
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!rows.length) {
      setMsg("保存するデータがありません");
      return;
    }

    setLoading(true);
    const selectedRows = rows.filter((r) => r.selected);

    if (!selectedRows.length) {
      setMsg("保存対象が選択されていません");
      setLoading(false);
      return;
    }

    try {
      let user = null;
      try {
        const res = await supabase.auth.getUser();
        user = res.data.user;
      } catch (e) {
        console.warn("Failed to get user:", e);
      }

      if (!user?.id) {
        setMsg("保存にはログインが必要です");
        return;
      }

      const res = await fetch("/api/save-word", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: selectedRows, userId: user.id }),
      });
      const data = await res.json();

      if (data.limitExceeded) {
        setMsg(data.message || "保存可能件数を超えました");
        if (data.action?.url && confirm(data.message + "\nサブスクリプションページに移動しますか？")) {
          window.location.href = data.action.url;
        }
        return;
      }

      if (!data.success) {
        setMsg("保存失敗: " + (data.message || "不明なエラー"));
        return;
      }

      setMsg(`保存完了: ${data.results.length}件`);
      setRows([]);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "不明なエラーです";
      toast.error("保存エラー: " + message);
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Toaster position="bottom-right" />

      {/* 入力フォーム */}
      <div className="flex gap-2 items-center mb-4">
        <input
          type="text"
          value={inputWord}
          onChange={(e) => setInputWord(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
          onFocus={(e) => e.target.select()}  // ← ★これを追加！
          placeholder="単語を入力"
          className="border border-[var(--border)] bg-[var(--secondary)] text-[var(--foreground)] placeholder-[var(--muted-foreground)] rounded-lg px-4 py-2.5 flex-1 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 transition"
        />

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="flex items-center gap-2 bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 px-4 py-2.5 rounded-lg transition shadow-md disabled:opacity-50"
        >
          {loading ? <Loader2 className="animate-spin" size={18} /> : <Wand2 size={18} />}
          生成
        </button>
        {correctedWord && (
          <button
            onClick={() => speakText(correctedWord)}
            className="bg-[var(--secondary)] text-[var(--foreground)] border border-[var(--border)] px-3 py-1.5 rounded-lg hover:bg-[var(--accent)]/10 hover:text-[var(--accent)] hover:border-[var(--accent)]/30 transition text-sm shadow-sm"
          >
            <Volume2 size={16} /> 読む
          </button>
        )}
      </div>

      {/* 保存ボタン */}
      <div>
        <button
          onClick={handleSave}
          disabled={loading}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg transition shadow-md disabled:opacity-50"
        >
          {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
          保存
        </button>
        {holdWord !== correctedWord && (
          <p className="text-red-500 text-sm mt-3 font-medium">入力文字を修正しました: 【{correctedWord}】</p>
        )}
        <p className="mt-3 text-[var(--muted-foreground)] text-sm">{msg}</p>
      </div>

      {/* 単語カード */}
      <AnimatePresence>
        {rows.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rows
              .slice()
              .sort((a, b) => b.importance.length - a.importance.length)
              .map((r, idx) => (
                <motion.div
                  key={idx}
                  whileHover={{ scale: 1.01 }}
                  className={`border rounded-2xl p-5 bg-[var(--card)] shadow-md relative flex flex-col gap-3 transition-colors ${r.selected ? "border-[var(--accent)] ring-1 ring-[var(--accent)]" : "border-[var(--border)]"
                    }`}
                >
                  <div className="absolute top-3 right-3">
                    <input
                      type="checkbox"
                      checked={r.selected ?? false}
                      onChange={(e) =>
                        setRows((prev) => prev.map((row) => (row.meaning === r.meaning ? { ...row, selected: e.target.checked } : row)))
                      }
                      className="w-5 h-5 accent-[var(--accent)] cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xl font-bold text-[var(--foreground)]">{r.word}</p>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${getPartOfSpeechClasses(r.part_of_speech)}`}>
                          {r.part_of_speech}
                        </span>
                        {r.isAlreadyRegistered && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                            ✅ 登録済み
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${getImportanceClasses(r.importance)}`}>
                      {importanceToStars(r.importance)}
                    </span>
                  </div>

                  <p className="text-[var(--foreground)] leading-relaxed">{r.meaning}</p>
                  <div className="bg-[var(--secondary)] rounded-lg px-4 py-3 italic text-[var(--muted-foreground)] border-l-4 border-[var(--accent)] shadow-inner text-sm">{r.example}</div>
                  <p className="text-[var(--muted-foreground)] text-sm">{r.translation}</p>

                  {r.synonyms && (
                    <div className="flex items-center gap-2 flex-wrap mt-2">
                      <span className="text-xs font-semibold text-[var(--muted-foreground)]">類義語:</span>
                      {r.synonyms.split(",").map((s, i) => (
                        <span key={i} className="text-xs bg-[var(--primary)]/10 text-[var(--accent)] px-2 py-0.5 rounded-full border border-[var(--primary)]/20">
                          {s.trim()}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 pt-4 border-t border-[var(--border)] flex items-center justify-between">
                    <button
                      onClick={() => speakText(r.example)}
                      className="flex items-center gap-1.5 bg-[var(--secondary)] text-[var(--foreground)] border border-[var(--border)] px-3 py-1.5 rounded-lg hover:bg-[var(--accent)]/10 hover:text-[var(--accent)] hover:border-[var(--accent)]/30 text-sm shadow-sm transition"
                    >
                      <Volume2 size={16} /> 再生
                    </button>
                    <ReportButton wordText={r.word} compact />
                  </div>
                </motion.div>
              ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
