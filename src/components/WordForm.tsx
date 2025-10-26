"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { speakText } from "@/lib/speech";
import { getImportanceClasses, getPartOfSpeechClasses } from "@/lib/utils";
import { Loader2, Volume2, Save, Wand2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast, { Toaster } from "react-hot-toast";

export interface Row {
  word: string;
  part_of_speech: string;
  meaning: string;
  example: string;
  translation: string;
  importance: string;
  selected?: boolean;
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
          setMsg("回答がありません");
          return;
        }

        const clean = geminiData.answer.replace(/^```json\s*[\r\n]?/, "").replace(/```$/, "").trim();

        type GeminiRow = Partial<Row> & { definition?: string };
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
          selected: true,
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
        displayRows = existingWords.map((r) => ({
          word: r.word,
          part_of_speech: r.part_of_speech ?? "",
          meaning: r.meaning ?? "",
          example: r.example_sentence ?? "",
          translation: r.translation ?? "",
          importance: r.importance ?? "",
          selected: true,
        }));
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
      const {
        data: { user },
      } = await supabase.auth.getUser();

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
          className="border border-gray-300 rounded-lg px-4 py-2 flex-1 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition disabled:bg-blue-300"
        >
          {loading ? <Loader2 className="animate-spin" size={18} /> : <Wand2 size={18} />}
          生成
        </button>
        {correctedWord && (
          <button
            onClick={() => speakText(correctedWord)}
            className="bg-indigo-500 text-white px-3 py-1 rounded hover:bg-indigo-600 transition"
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
          className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition disabled:bg-green-300"
        >
          {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
          保存
        </button>
        {holdWord !== correctedWord && (
          <p className="text-red-500 text-base">入力文字を修正しました: 【{correctedWord}】</p>
        )}
        <p className="mb-4 text-gray-700">{msg}</p>
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
                  whileHover={{ scale: 1.02 }}
                  className={`border rounded-2xl p-4 bg-white shadow-md relative flex flex-col gap-3 ${
                    r.selected ? "ring-2 ring-blue-300" : ""
                  }`}
                >
                  <div className="absolute top-3 right-3">
                    <input
                      type="checkbox"
                      checked={r.selected ?? false}
                      onChange={(e) =>
                        setRows((prev) => prev.map((row) => (row.meaning === r.meaning ? { ...row, selected: e.target.checked } : row)))
                      }
                      className="w-5 h-5 accent-blue-500"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xl font-bold text-gray-900">{r.word}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${getPartOfSpeechClasses(r.part_of_speech)}`}>
                        {r.part_of_speech}
                      </span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${getImportanceClasses(r.importance)}`}>
                      {r.importance}
                    </span>
                  </div>

                  <p className="text-gray-800">{r.meaning}</p>
                  <div className="bg-gray-50 border-l-4 border-blue-300 pl-3 py-2 italic text-gray-700">{r.example}</div>
                  <p className="text-gray-600 text-sm">{r.translation}</p>

                  <button
                    onClick={() => speakText(r.example)}
                    className="mt-2 self-start flex items-center gap-1 bg-indigo-500 text-white px-3 py-1 rounded hover:bg-indigo-600 transition"
                  >
                    <Volume2 size={16} /> 再生
                  </button>
                </motion.div>
              ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
