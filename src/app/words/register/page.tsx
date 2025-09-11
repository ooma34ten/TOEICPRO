// src/app/words/register/page.tsx
"use client";

import { useState } from "react";
import WordForm, { Row } from "@/components/WordForm";
import { speakText } from "@/lib/speech";

export default function RegisterPage() {
  const [rows, setRows] = useState<Row[]>([]);

  const handleAdd = (newRows: Row[]) => {
    setRows((prev) => [...prev, ...newRows]);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">TOEIC単語登録</h1>
      <WordForm onAdd={handleAdd} />

      {rows.length > 0 && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-2">生成履歴</h2>
          <ul className="space-y-2">
            {rows.slice().reverse().map((row, idx) => (
              <li key={idx} className="border p-2 rounded flex items-center justify-between">
                <div>
                  <p><strong>品詞:</strong> {row.part_of_speech}</p>
                  <p><strong>意味:</strong> {row.meaning}</p>
                  <p><strong>例文:</strong> {row.example}</p>
                  <p><strong>翻訳:</strong> {row.translation}</p>
                  <p><strong>重要度:</strong> {row.importance}</p>
                </div>
                <button
                  onClick={() => speakText(row.example)}
                  className="bg-indigo-300 text-white px-2 py-1 rounded hover:bg-indigo-400 transition text-sm"
                >
                  🔊
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
// src/app/words/register/page.tsx
