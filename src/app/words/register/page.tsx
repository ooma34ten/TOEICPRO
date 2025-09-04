"use client";

import { useState } from "react";
import WordForm from "@/components/WordForm";
import WordList from "@/components/WordList";

interface Row {
  part_of_speech: string;
  meaning: string;
  example: string;
  translation: string;
  importance: string;
}

export default function RegisterPage() {
  const [rows, setRows] = useState<Row[]>([]);

  const handleAdd = (newRows: Row[], word: string) => {
    setRows((prev) => [...prev, ...newRows]);
  };

  return (
    <div>
      <h1>TOEIC単語登録</h1>
      <WordForm onAdd={handleAdd} />
    </div>
  );
}
//src/app/words/register/page.tsx