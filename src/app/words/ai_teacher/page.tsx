"use client";

import { useState } from "react";

export default function TOEICPage() {
  const [question, setQuestion] = useState<string>("");
  const [options, setOptions] = useState<string[]>([]);
  const [answer, setAnswer] = useState<string>(""); // "A", "B", "C", "D"
  const [explanation, setExplanation] = useState<string>("");
  const [selected, setSelected] = useState<string>("");
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  const userProfile = {
    estimatedScore: 450,
    weaknesses: ["前置詞", "副詞の識別"],
  };

  const generateQuestion = async () => {
    setLoading(true);
    const res = await fetch("/api/ai_teacher", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userProfile),
    });

    const data = await res.json();

    setQuestion(data.question);
    setOptions(data.options);
    setAnswer(data.answer);           
    setExplanation(data.explanation); 
    setIsCorrect(null);
    setSelected("");
    setLoading(false);
  };

  const handleSubmit = () => {
    const correct = selected === answer;

    setIsCorrect(correct);

    if (correct) {
      setExplanation("✅ 正解！\n\n" + explanation);
    } else {
      const correctWord = options[answer.charCodeAt(0) - 65]; // "A" → options[0]
      setExplanation(`❌ 不正解。\n正解は「${correctWord}」です。\n\n${explanation}`);
    }
  };

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">TOEIC AIトレーナー</h1>

      <button
        onClick={generateQuestion}
        disabled={loading}
        className="bg-blue-600 text-white px-4 py-2 rounded mb-4"
      >
        {loading ? "生成中..." : "問題を出す"}
      </button>

      {question && (
        <div className="space-y-4">
          <p className="text-lg">{question}</p>

          {options.map((opt, i) => {
            const label = String.fromCharCode(65 + i);
            return (
              <button
                key={i}
                onClick={() => setSelected(label)}
                className={`block w-full text-left border p-2 rounded ${
                  selected === label ? "bg-blue-100 border-blue-500" : ""
                }`}
              >
                {label}：{opt}
              </button>
            );
          })}

          <button
            onClick={handleSubmit}
            disabled={!selected}
            className="bg-green-600 text-white px-4 py-2 rounded"
          >
            回答を送信
          </button>

          {isCorrect !== null && (
            <p className="mt-4 text-base whitespace-pre-line">{explanation}</p>
          )}
        </div>
      )}
    </div>
  );
}
