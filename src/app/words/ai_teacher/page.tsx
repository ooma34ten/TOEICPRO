"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

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

// スピナーコンポーネント
const Spinner = () => (
  <div className="flex justify-center items-center mt-4">
    <div className="w-10 h-10 border-4 border-blue-400 border-dashed rounded-full animate-spin"></div>
  </div>
);




export default function TOEICPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [latestScore, setLatestScore] = useState<number | null>(null);
  const [latestWeak, setLatestWeak] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const fetchLatestResult = async (userId: string) => {
    try {
      const res = await fetch("/api/get-latest-result", {
        headers: { "x-user-id": userId },
      });
      const data = await res.json();
      if (data.result) {
        setLatestScore(data.result.predicted_score || 450);
        setLatestWeak(data.result.weak_categories || []);
      }
      return data.result;
    } catch (err) {
      console.error("最新結果取得エラー:", err);
      return null;
    }
  };

  const generateQuestions = async () => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("ログインしていません");
      const userId = userData.user.id;

      const latestResult = await fetchLatestResult(userId);

      const userProfile = {
        estimatedScore: latestResult?.predicted_score || 450,
        weaknesses: latestResult?.weak_categories || [],
      };

      interface AiTeacherResponse {
        questions: Question[];
      }


      const res = await fetch("/api/ai_teacher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userProfile),
      });

      const data: AiTeacherResponse = await res.json();

      if (!data.questions || !Array.isArray(data.questions)) {
        setQuestions([]);
        setSelected([]);
        setResult(null);
        setLoading(false);
        return;
      }

      // any を使わないバリデーション
      const validQuestions = data.questions.filter((q): q is Question => {
        return (
          typeof q.question === "string" &&
          Array.isArray(q.options) &&
          q.options.every((opt) => typeof opt === "string") &&
          typeof q.answer === "string" &&
          typeof q.translation === "string" &&
          typeof q.explanation === "string" &&
          typeof q.partOfSpeech === "string" &&
          typeof q.example === "string" &&
          typeof q.importance === "number" &&
          Array.isArray(q.synonyms)
        );
      });

      setQuestions(validQuestions);
      setSelected(Array(validQuestions.length).fill(""));
      setResult(null);
      setSubmitted(false);

    } catch (err) {
      console.error("質問生成エラー:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (qIndex: number, label: string) => {
    const newSelected = [...selected];
    newSelected[qIndex] = label;
    setSelected(newSelected);
  };

  const handleSubmit = async () => {
    let correct = 0;
    const weakCategory: Record<string, number> = {};

    questions.forEach((q, i) => {
      const sel = selected[i];
      if (!sel) return;

      const index = sel.charCodeAt(0) - 65;
      const userWord = q.options[index];
      const isCorrect = userWord === q.answer;

      if (isCorrect) correct++;

      const cat = q.partOfSpeech || "other";
      if (!isCorrect) weakCategory[cat] = (weakCategory[cat] || 0) + 1;
    });

    const accuracy = questions.length > 0 ? correct / questions.length : 0;
    const predictedScore = Math.min(
      990,
      Math.max(
        0,
        Math.round((latestScore || 450) + (accuracy - 0.5) * 200)
      )
    );
    console.log("あなたの現在のスコア",latestScore);
    console.log("今回の正解率", accuracy);
    console.log("予測スコア", predictedScore);

    const weak = Object.entries(weakCategory)
      .sort((a, b) => b[1] - a[1])
      .map(([cat]) => cat)
      .slice(0, 2);

    const finalResult: Result = { correct, accuracy, predictedScore, weak };
    setResult(finalResult);
    setSubmitted(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("ログインしていません");

      await fetch("/api/save_test_result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userData.user.id,
          questions,
          selected,
          result: finalResult,
        }),
      });
    } catch (err) {
      console.error("結果保存エラー:", err);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-4 text-center">TOEIC AIトレーナー</h1>

      {latestScore !== null && (
        <div className="mb-4 p-4 border rounded bg-gray-50 shadow">
          <p className="font-semibold text-lg">📘 現在の推定レベル</p>
          <p className="mt-1">TOEIC推定スコア：<b>{latestScore}</b></p>
          <p className="mt-1">
            苦手分野：{latestWeak.length > 0 ? latestWeak.join(", ") : "なし"}
          </p>
        </div>
      )}

      <button
        onClick={generateQuestions}
        disabled={loading}
        className={`bg-blue-600 text-white px-6 py-3 rounded mb-2 hover:bg-blue-700 transition duration-200 shadow flex items-center justify-center ${
          loading ? "opacity-60 cursor-not-allowed" : ""
        }`}
      >
        {loading ? "生成中..." : "10問を作成"}
      </button>

      {/* ローディングスピナー */}
      {loading && <Spinner />}
      {loading && (
        <p className="text-center mt-2 text-blue-500 font-semibold animate-pulse">
          AIが問題を生成中です…
        </p>
      )}

      {questions.map((q, qi) => (
        <div
          key={qi}
          className="mb-6 p-4 border rounded shadow hover:shadow-lg transition duration-200"
        >
          <p className="font-bold mb-3">
            {qi + 1}. {q.question}
          </p>

          <div className="flex flex-col gap-2">
            {q.options.map((opt, oi) => {
              const label = String.fromCharCode(65 + oi);
              const isSelected = selected[qi] === label;
              return (
                <button
                  key={oi}
                  onClick={() => handleSelect(qi, label)}
                  className={`text-left border p-2 rounded transition duration-150 ${
                    isSelected
                      ? "bg-blue-100 border-blue-500 shadow-inner"
                      : "hover:bg-gray-100"
                  }`}
                >
                  {label}. {opt}
                </button>
              );
            })}
          </div>

          {selected[qi] !== "" && (
            <div className="mt-3 p-3 border-l-4 rounded border-gray-200 bg-gray-50 transition-all">
              <p
                className={`font-semibold mb-1 ${
                  q.options[selected[qi].charCodeAt(0) - 65] === q.answer
                    ? "text-green-600"
                    : "text-red-600"
                } cursor-pointer`}
              >
                {q.options[selected[qi].charCodeAt(0) - 65] === q.answer
                  ? "✅ 正解"
                  : `❌ 不正解 (正解: ${q.answer}, あなたの答え: ${
                      q.options[selected[qi].charCodeAt(0) - 65]
                    })`}
              </p>

              <p className="text-gray-700 mb-1">
                <span className="font-semibold">訳：</span>
                {q.translation}
              </p>

              <p className="text-gray-600">
                <span className="font-semibold">解説：</span>
                {q.explanation}
              </p>

              <p className="text-gray-600">
                <span className="font-semibold">品詞：</span>
                {q.partOfSpeech}
              </p>
            </div>
          )}
        </div>
      ))}

      {questions.length > 0 && (
        <button
          onClick={handleSubmit}
          disabled={selected.includes("") || submitted}
          className="bg-green-600 text-white px-6 py-3 rounded shadow
                    transition duration-200
                    hover:bg-green-700
                    disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitted ? "採点済み" : "採点する"}
        </button>
      )}


      {result && (
        <div className="mt-6 p-4 border rounded bg-gray-50 shadow">
          <p>🟦 正解数：{result.correct} / 10</p>
          <p>🟩 正解率：{Math.round(result.accuracy * 100)}%</p>
          <p>
            🟧 予測TOEICスコア：<b>{result.predictedScore}</b>
          </p>
          <p>🟥 苦手分野：{result.weak.join(", ") || "なし"}</p>
        </div>
      )}
    </div>
  );
}
