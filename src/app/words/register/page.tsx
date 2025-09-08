"use client";

import { useState } from "react";
import WordForm from "@/components/WordForm";

interface Row {
  part_of_speech: string;
  meaning: string;
  example: string;
  translation: string;
  importance: string;
}

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
          <h2 className="text-xl font-semibold mb-2">登録済み単語一覧</h2>
          <ul className="space-y-2">
            {rows.map((row, idx) => (
              <li key={idx} className="border p-2 rounded">
                <p><strong>品詞:</strong> {row.part_of_speech}</p>
                <p><strong>意味:</strong> {row.meaning}</p>
                <p><strong>例文:</strong> {row.example}</p>
                <p><strong>翻訳:</strong> {row.translation}</p>
                <p><strong>重要度:</strong> {row.importance}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

//src/app/words/register/page.tsx