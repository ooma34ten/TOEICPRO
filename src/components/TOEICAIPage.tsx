"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

type TOEICExample = {
  text: string;
  translation?: string;
  point?: string;
  importance?: "★★★★★" | "★★★★" | "★★★" | "★★" | "★";
};

type TOEICAnswer = {
  summary?: string;
  examples?: TOEICExample[];
  tips?: string[];
};

export default function TOEICAIPage() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<TOEICAnswer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const toggleExample = (idx: number) =>
    setExpanded((prev) => ({ ...prev, [idx]: !prev[idx] }));

  const handleSubmit = async () => {
    if (!question) return;
    setLoading(true);
    setError("");
    setAnswer(null);
    setExpanded({});

    try {
      const res = await fetch("/api/toeic-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();

      if (res.ok) setAnswer(data.answer as TOEICAnswer);
      else setError(data.error || "エラーが発生しました");
    } catch {
      setError("通信エラー");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold text-center">TOEIC AI質問</h1>

      <div className="flex flex-col md:flex-row gap-3">
        <textarea
          className="flex-1 p-3 border rounded-md resize-none"
          placeholder="質問を入力してください（単語・文法・表現など）"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={4}
        />
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
        >
          {loading ? "送信中..." : "質問する"}
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 mt-4 text-gray-500 justify-center">
          <svg
            className="animate-spin h-5 w-5 text-blue-600"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            ></path>
          </svg>
          <span>AIが回答を作成中です...</span>
        </div>
      )}

      {error && <p className="text-red-500 text-center">{error}</p>}

      {answer && (
        <div className="space-y-4">
          {answer.summary && (
            <div className="p-4 bg-indigo-50 rounded-md border-l-4 border-indigo-400">
              <h3 className="font-semibold mb-1">要点まとめ</h3>
              <p>{answer.summary}</p>
            </div>
          )}

          {answer.examples?.map((ex, idx) => (
            <div
              key={idx}
              className="p-4 bg-yellow-50 rounded-md border-l-4 border-yellow-400"
            >
              <div
                className="flex justify-between items-center cursor-pointer"
                onClick={() => toggleExample(idx)}
              >
                <span className="font-medium">{ex.text}</span>
                {expanded[idx] ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </div>
              {expanded[idx] && (
                <div className="mt-2 space-y-1 text-sm">
                  {ex.translation && (
                    <p className="text-gray-600">訳: {ex.translation}</p>
                  )}
                  {ex.point && <p className="text-green-600">TOEICポイント: {ex.point}</p>}
                  {ex.importance && (
                    <span className="inline-block px-2 py-1 text-xs font-semibold bg-red-200 text-red-800 rounded">
                      重要度: {ex.importance}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}

          {answer.tips?.length ? (
            <div className="p-4 bg-green-50 rounded-md border-l-4 border-green-400">
              <h3 className="font-semibold mb-1">学習のコツ</h3>
              <ul className="list-disc ml-6">
                {answer.tips.map((tip, idx) => (
                  <li key={idx}>{tip}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
