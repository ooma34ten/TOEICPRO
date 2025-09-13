// src/components/WordForm.tsx
"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { speakText } from "@/lib/speech";

export interface Row {
  part_of_speech: string;
  meaning: string;
  example: string;
  translation: string;
  importance: string;
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

  const handleGenerate = async () => {
    if (!inputWord.trim()) {
      setMsg("単語を入力してください");
      return;
    }

    try {
      setMsg("スペル確認中...");
      const spellRes = await fetch("/api/spell-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: inputWord }),
      });

      const { correctedWord } = await spellRes.json();
      setCorrectedWord(correctedWord);

      if (correctedWord !== inputWord) {
        setMsg(`修正されました: ${inputWord} → ${correctedWord}`);
      } else {
        setMsg("修正不要");
      }

      setHoldWord(inputWord);

      setMsg("生成中...");
      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: correctedWord }),
      });

      const data = await res.json();

      if (!data.answer) {
        setMsg("回答がありません");
        return;
      }

      const clean = data.answer.replace(/^```json\s*[\r\n]?/, "").replace(/```$/, "").trim();

      type GeminiRow = Partial<Row> & { definition?: string };
      let parsed: { word?: string; definitions?: GeminiRow[]; meanings?: GeminiRow[] } = {};
      try {
        parsed = JSON.parse(clean);
      } catch {
        setMsg("JSON形式で返っていません: " + clean);
        return;
      }

      const newRows: Row[] = (parsed.definitions || parsed.meanings || []).map((m: GeminiRow) => ({
        part_of_speech: m.part_of_speech ?? "",
        meaning: m.meaning ?? m.definition ?? "",
        example: m.example ?? "",
        translation: m.translation ?? "",
        importance: m.importance ?? "",
      }));

      if (!newRows.length) {
        setMsg("意味が生成されませんでした");
        return;
      }

      setRows(newRows);
      setMsg("生成完了");
      onAdd(newRows, parsed.word || correctedWord);
    } catch (e: unknown) {
      let message = "不明なエラーです";
      if (e instanceof Error) message = e.message;
      setMsg("生成エラー: " + message);
      console.error("Generate error:", e);
    }
  };

  const handleSave = async () => {
    if (!rows.length) {
      setMsg("保存するデータがありません");
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

      const res = await fetch("/api/save-word", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: correctedWord, rows, userId }),
      });

      const data = await res.json();

      if (data.success) {
        setMsg(`保存完了: ${data.results.length}件`);
        setRows([]);
      } else {
        setMsg("保存失敗: " + (data.message || "不明なエラー"));
        console.error("Save word error details:", data);
      }
    } catch (e: unknown) {
      let message = "不明なエラーです";
      if (e instanceof Error) message = e.message;
      setMsg("保存エラー: " + message);
      console.error("Save word exception:", e);
    }
  };

  const importanceColor = (importance: string) => {
    switch (importance) {
      case "★★★★★":
        return "bg-red-200 text-red-800";
      case "★★★★":
        return "bg-yellow-200 text-yellow-800";
      case "★★★":
        return "bg-green-200 text-green-800";
      default:
        return "bg-gray-200 text-gray-800";
    }
  };

  return (
    <div className="my-6">
      <div className="flex gap-2 items-center mb-4">
        <input
          type="text"
          value={inputWord}
          onChange={(e) => setInputWord(e.target.value)}
          placeholder="単語を入力"
          className="border border-gray-300 rounded px-3 py-2 flex-1"
        />
        <button
          onClick={handleGenerate}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition"
        >
          生成
        </button>
        {correctedWord && (
          <button
            onClick={() => speakText(correctedWord)}
            className="bg-indigo-500 text-white px-3 py-1 rounded hover:bg-indigo-600 transition"
          >
            単語を読む 🔊
          </button>
        )}
      </div>

      <button
        onClick={handleSave}
        className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition mt-4"
      >
        保存
      </button>

      {holdWord !== correctedWord && (
        <p className="text-red-500 text-base">入力文字を修正しました: 【{correctedWord}】</p>
      )}

      <p className="mb-4 text-gray-700">{msg}</p>

      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-300 rounded">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2 border-b">品詞</th>
                <th className="px-4 py-2 border-b">意味</th>
                <th className="px-4 py-2 border-b">例文</th>
                <th className="px-4 py-2 border-b">翻訳</th>
                <th className="px-4 py-2 border-b">重要度</th>
                <th className="px-4 py-2 border-b">読み上げ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={idx} className="odd:bg-white even:bg-gray-50">
                  <td className="px-4 py-2 font-medium">{r.part_of_speech}</td>
                  <td className="px-4 py-2">{r.meaning}</td>
                  <td className="px-4 py-2">{r.example}</td>
                  <td className="px-4 py-2">{r.translation}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-1 rounded text-sm ${importanceColor(r.importance)}`}>
                      {r.importance}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => speakText(r.example)}
                      className="bg-indigo-300 text-white px-2 py-1 rounded hover:bg-indigo-400 transition text-sm"
                    >
                      🔊
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      
    </div>
  );
}

