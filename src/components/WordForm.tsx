// src/components/WordForm.tsx
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
      // 入力単語を小文字に統一
      const lowerWord = inputWord.trim().toLowerCase();

      // --- スペルチェック ---
      setMsg("スペル確認中...");
      const spellRes = await fetch("/api/spell-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: lowerWord }),
      });

      const { correctedWord } = await spellRes.json();
      const finalWord = correctedWord.toLowerCase(); // 修正結果も小文字に統一
      setCorrectedWord(finalWord);

      if (finalWord !== lowerWord) {
        setMsg(`修正されました: ${inputWord} → ${finalWord}`);
      } else {
        setMsg("修正不要");
      }

      setHoldWord(inputWord);

      // --- Supabase で既存単語取得 ---
      setMsg("検索中...");
      const { data: existingWords, error } = await supabase
        .from("words_master")
        .select("*")
        .eq("word", correctedWord);

      if (error) {
        console.error("取得エラー:", error);
        setMsg("データ取得エラー");
        return;
      }

      let displayRows: Row[] = [];

      if (existingWords.length === 0) {
        // --- Gemini API で新規単語生成 ---
        setMsg("生成中...");
        const geminiRes = await fetch("/api/gemini", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: correctedWord }),
        });
        const geminiData = await geminiRes.json();

        if (!geminiData.answer) {
          setMsg("回答がありません");
          return;
        }

        const clean = geminiData.answer.replace(/^```json\s*[\r\n]?/, "").replace(/```$/, "").trim();

        type GeminiRow = Partial<Row> & { definition?: string };
        let parsed: { word?: string; definitions?: GeminiRow[]; meanings?: GeminiRow[] } = {};

        try {
          parsed = JSON.parse(clean);
        } catch {
          setMsg("JSON形式で返っていません: " + clean);
          return;
        }

        const newRows: Row[] = (parsed.definitions || parsed.meanings || []).map((m: GeminiRow) => ({
          word: m.word ?? correctedWord,
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

        // --- Supabase に保存 ---
        const saveRes = await fetch("/api/add-to-master", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ words: newRows }),
        });
        const saveResult = await saveRes.json();

        if (!saveResult.success) {
          console.error("新規品詞登録APIエラー:", saveResult.message);
        } else {
          console.log("新規品詞登録API完了");
        }

        displayRows = newRows;
      } else {
        // --- 既存単語を UI に表示 ---
        displayRows = existingWords.map((r) => ({
          word: r.word,
          part_of_speech: r.part_of_speech,
          meaning: r.meaning,
          example: r.example_sentence ?? "",
          translation: r.translation ?? "",
          importance: r.importance ?? "",
          selected: true,
        }));

        // --- 裏で Gemini API で新しい品詞パターン生成 ---
        const geminiRes = await fetch("/api/gemini", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: correctedWord }),
        });
        const geminiData = await geminiRes.json();

        if (geminiData?.answer) {
          const clean = geminiData.answer.replace(/^```json\s*[\r\n]?/, "").replace(/```$/, "").trim();

          type GeminiRow = Partial<Row> & { definition?: string };
          let parsed: { word?: string; definitions?: GeminiRow[]; meanings?: GeminiRow[] } = {};

          try {
            parsed = JSON.parse(clean);
          } catch {
            console.warn("Gemini応答がJSON形式でない:", clean);
          }

          const generatedRows: Row[] = (parsed.definitions || parsed.meanings || []).map((m: GeminiRow) => ({
            word: m.word ?? correctedWord,
            part_of_speech: m.part_of_speech ?? "",
            meaning: m.meaning ?? m.definition ?? "",
            example: m.example ?? "",
            translation: m.translation ?? "",
            importance: m.importance ?? "",
          }));

          if (generatedRows.length > 0) {
            const existingPairs = new Set(existingWords.map((r) => `${r.word}_${r.part_of_speech}`));
            const newCombinations = generatedRows.filter(
              (g) => !existingPairs.has(`${g.word}_${g.part_of_speech}`)
            );

            if (newCombinations.length > 0) {
              console.log("新しい品詞パターンを登録:", newCombinations);

              const saveRes = await fetch("/api/add-to-master", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ words: newCombinations }),
              });

              const saveResult = await saveRes.json();
              if (!saveResult.success) {
                console.error("新規品詞登録APIエラー:", saveResult.message);
              } else {
                console.log("新規品詞登録API完了");
              }
            }
          }
        }
      }

      setRows(displayRows);
      setMsg("生成完了");
      onAdd(displayRows, correctedWord);
    } catch (e: unknown) {
      let message = "不明なエラーです";
      if (e instanceof Error) message = e.message;
      toast.error("生成エラー: " + message);
      console.error("Generate error:", e);
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
      return;
    }

    setMsg("保存中...");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user?.id) {
        setMsg("ログインが必要です");
        return;
      }

      const userId = user.id;

      // 🔹 選択中のすべての単語についてループ
      const newRowsToSave: Row[] = [];
      console.log("保存処理開始:", selectedRows);

      for (let i = 0; i < selectedRows.length; i++) {
        const word = selectedRows[i].word;
        const example = selectedRows[i].example;


        // 🔸 1. words_masterに存在するか確認
        const { data: existing, error: fetchError } = await supabase
          .from("words_master")
          .select("id")
          .eq("example_sentence", example)
          .eq("word", word);

        if (fetchError) {
          console.error("既存チェックエラー:", fetchError);
          continue; // この単語はスキップ
        }

        let wordId: string | null = null;

        if (existing && existing.length > 0) {
          wordId = existing[0].id;
        }

        // 🔸 2. user_wordsにすでに登録されているか確認
        if (wordId) {
          const { data: existing2, error: fetchError2 } = await supabase
            .from("user_words")
            .select("id")
            .eq("word_id", wordId)
            .eq("user_id", userId);

          if (fetchError2) {
            console.error("ユーザー重複チェックエラー:", fetchError2);
            continue;
          }

          if (existing2 && existing2.length > 0) {
            console.log(`すでに保存済み: ${word}`);
            continue; // 🔸登録済みならスキップ
          }
        }

        // 🔸 3. 未登録のものだけ保存リストに追加
        newRowsToSave.push(selectedRows[i]);
      }

      if (newRowsToSave.length === 0) {
        setMsg("すべての単語がすでに保存済みです");
        return;
      }

      console.log("保存対象:", selectedRows);
      console.log("新規保存対象:", newRowsToSave);

      // 🔸 4. 未登録のものだけサーバーに保存
      const res = await fetch("/api/save-word", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: selectedRows, userId }),
      });

      const data = await res.json();

      if (data.limitExceeded) {
        setMsg(data.message || "保存可能件数を超えました");
        if (data.action?.url) {
          if (confirm(data.message + "\nサブスクページに移動しますか？")) {
            window.location.href = data.action.url;
          }
        }
        return;
      }

      if (!data.success) {
        setMsg("保存失敗: " + (data.message || "不明なエラー"));
        console.error("Save word error details:", data);
        return;
      }

      setMsg(`保存完了: ${data.results.length}件`);
      setRows([]);
    } catch (e: unknown) {
      let message = "不明なエラーです";
      if (e instanceof Error) message = e.message;
      toast.error("保存エラー: " + message);
      console.error("Save word exception:", e);
    } finally {
      setLoading(false);
    }
  };



  const importanceColor = (importance: string) => {
    switch (importance) {
      case "★★★★★":
        return "bg-red-100 text-red-700 border border-red-300";
      case "★★★★":
        return "bg-orange-100 text-orange-700 border border-orange-300";
      case "★★★":
        return "bg-yellow-100 text-yellow-700 border border-yellow-300";
      default:
        return "bg-gray-100 text-gray-700 border border-gray-300";
    }
  };

  return (
    <div className="space-y-6">
      <Toaster position="bottom-right" />
      <div className="flex gap-2 items-center mb-4">
         <input
          type="text"
          value={inputWord}
          onChange={(e) => setInputWord(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
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
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
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
                  {/* チェックボックス */}
                  <div className="absolute top-3 right-3">
                    <input
                      type="checkbox"
                      checked={r.selected ?? false}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((row) =>
                            row.meaning === r.meaning ? { ...row, selected: e.target.checked } : row
                          )
                        )
                      }
                      className="w-5 h-5 accent-blue-500"
                    />
                  </div>

                  {/* 単語と品詞 */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xl font-bold text-gray-900">{r.word}</p>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${getPartOfSpeechClasses(r.part_of_speech)}`}
                      >
                        {r.part_of_speech}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${getImportanceClasses(r.importance)}`}
                    >
                      {r.importance}
                    </span>
                  </div>

                  {/* 意味 */}
                  <p className="text-gray-800">{r.meaning}</p>

                  {/* 例文 */}
                  <div className="bg-gray-50 border-l-4 border-blue-300 pl-3 py-2 italic text-gray-700">
                    {r.example}
                  </div>

                  {/* 翻訳 */}
                  <p className="text-gray-600 text-sm">{r.translation}</p>

                  {/* アクションボタン */}
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

// src/components/WordForm.tsx
