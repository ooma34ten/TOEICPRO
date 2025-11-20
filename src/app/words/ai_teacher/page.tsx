"use client";

import { useState } from "react";

interface Question {
  question: string;
  translation: string;
  options: string[];
  answer: string;
  explanation: string;
  partOfSpeech: string;
  example: string;
  importance: number;
  synonyms: string[];
}

interface Result {
  correct: number;
  accuracy: number;
  predictedScore: number;
  weak: string[];
}

export default function TOEICPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);

  const userProfile = { estimatedScore: 450 };

  const generateQuestions = async () => {
    setLoading(true);

    const res = await fetch("/api/ai_teacher", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userProfile),
    });

    const data = await res.json();

    if (!data.questions || !Array.isArray(data.questions)) {
      console.error("❌ questions が undefined", data);
      setQuestions([]);
      setLoading(false);
      return;
    }

    setQuestions(data.questions as Question[]);
    setSelected(Array(data.questions.length).fill(""));
    setResult(null);
    setLoading(false);
  };

  const handleSelect = (qIndex: number, label: string) => {
    const newSelected = [...selected];
    newSelected[qIndex] = label;
    setSelected(newSelected);
  };

  const handleSubmit = () => {
    let correct = 0;
    const weakCategory: Record<string, number> = {};

    questions.forEach((q, i) => {
      if (!selected[i]) return;

      const userWord = q.options[selected[i].charCodeAt(0) - 65];
      const isCorrect = userWord === q.answer;
      if (isCorrect) correct++;

      const cat = q.partOfSpeech || "other";
      if (!isCorrect) weakCategory[cat] = (weakCategory[cat] || 0) + 1;
    });

    const accuracy = correct / questions.length;
    const predictedScore = Math.round(userProfile.estimatedScore + (accuracy - 0.5) * 200);

    const weak = Object.entries(weakCategory)
      .sort((a, b) => b[1] - a[1])
      .map(([cat]) => cat)
      .slice(0, 2);

    setResult({ correct, accuracy, predictedScore, weak });
  };

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">TOEIC AIトレーナー（10問）</h1>

      <button
        onClick={generateQuestions}
        disabled={loading}
        className="bg-blue-600 text-white px-4 py-2 rounded mb-4"
      >
        {loading ? "生成中..." : "10問を作成"}
      </button>

      {questions.length > 0 &&
        questions.map((q, qi) => (
          <div key={qi} className="mb-6 border p-4 rounded">
            <p className="font-bold mb-2">{qi + 1}. {q.question}</p>

            {q.options.map((opt, oi) => {
              const label = String.fromCharCode(65 + oi);
              const isSelected = selected[qi] === label;

              return (
                <button
                  key={oi}
                  onClick={() => handleSelect(qi, label)}
                  className={`block w-full text-left border p-2 mt-1 rounded
                    ${isSelected ? "bg-blue-100 border-blue-500" : ""}`}
                >
                  {label}. {opt}
                </button>
              );
            })}

           {selected[qi] && (
              <div className="mt-2 p-2 border-l-4 rounded border-gray-200">
                {/* 正誤 */}
                <p className={`font-semibold mb-1 ${
                  q.options[selected[qi].charCodeAt(0) - 65] === q.answer
                    ? "text-green-600"
                    : "text-red-600"
                }`}>
                  {q.options[selected[qi].charCodeAt(0) - 65] === q.answer
                    ? "✅ 正解"
                    : `❌ 不正解`}
                  {q.options[selected[qi].charCodeAt(0) - 65] !== q.answer &&
                    <> (正解: <b>{q.answer}</b> あなたの答え: <b>{q.options[selected[qi].charCodeAt(0) - 65]}</b>)</>
                  }
                </p>

                {/* 訳 */}
                <p className="text-gray-700 mb-1">
                  <span className="font-semibold">訳：</span>{q.translation}
                </p>

                {/* 解説 */}
                <p className="text-gray-600">
                  <span className="font-semibold">解説：</span>{q.explanation}
                </p>
              </div>
            )}

          </div>
        ))}

      {questions.length > 0 && (
        <button
          onClick={handleSubmit}
          disabled={selected.includes("")}
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          採点する
        </button>
      )}

      {result && (
        <div className="mt-6 p-4 border rounded bg-gray-50">
          <p>🟦 正解数：{result.correct} / 10</p>
          <p>🟩 正解率：{Math.round(result.accuracy * 100)}%</p>
          <p>🟧 予測TOEICスコア：<b>{result.predictedScore}</b></p>
          <p>🟥 苦手分野：{result.weak.join(", ") || "なし"}</p>
        </div>
      )}
    </div>
  );
}
