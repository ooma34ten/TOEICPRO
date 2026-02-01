"use client";

import { useEffect, useState } from "react";

type ToeicQuestion = {
  id: string;
  question: string;
  translation: string;
  options: string[];
  answer: string;
  explanation: string;
  example_sentence: string;
  part_of_speech: string;
  category: string;
  importance: string;
  synonyms: string[];
  level: string;
};

export default function ToeicPage() {
  const [question, setQuestion] = useState<ToeicQuestion | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);

  // ランダム問題取得
  const fetchQuestion = async () => {
    setSelected(null);
    setShowAnswer(false);
    try {
      const res = await fetch("/api/random-question", { cache: "no-store" });
      const data: ToeicQuestion = await res.json();
      setQuestion(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchQuestion();
  }, []);

  if (!question) return <div>Loading...</div>;

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">TOEIC Random Question</h1>

      <div className="mb-4">
        <p className="mb-2 font-semibold">Q: {question.question}</p>
      </div>

      <div className="mb-4">
        {(question.options || []).map((opt) => (
          <button
            key={opt}
            onClick={() => setSelected(opt)}
            className={`block w-full text-left px-4 py-2 mb-2 border rounded ${
              selected === opt
                ? "bg-blue-500 text-white"
                : "bg-white text-black"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>

      {selected && (
        <div className="mb-4">
          <button
            onClick={() => setShowAnswer(!showAnswer)}
            className="px-4 py-2 bg-green-500 text-white rounded"
          >
            {showAnswer ? "Hide Answer" : "Show Answer"}
          </button>
        </div>
      )}

      {showAnswer && selected && (
        <div className="p-4 border rounded bg-gray-100">
          <p>
            <strong>正解:</strong> {question.answer}
          </p>
          <p>
            <strong>訳:</strong> {question.translation}
          </p>

          <p>
            <strong>説明:</strong> {question.explanation}
          </p>

          <p>
            <strong>品詞:</strong> {question.part_of_speech}
          </p>
          
          <p>
            <strong>類義語:</strong> {question.synonyms.join(", ")}
          </p>
          <p>
            <strong>重要度:</strong> {question.importance}
          </p>
          <p>
            <strong>レベル:</strong> {question.level}
          </p>
        </div>
      )}

      <div className="mt-4">
        <button
          onClick={fetchQuestion}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Next Question
        </button>
      </div>
    </div>
  );
}
