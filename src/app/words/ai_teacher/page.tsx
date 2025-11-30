"use client";

import React, { useEffect, useState, useRef } from "react";
import Confetti from "react-confetti";
import { supabase } from "@/lib/supabaseClient";

type Question = {
  id: string;
  question: string;
  translation: string;
  options: string[];
  answer: string;
  explanation: string;
  partOfSpeech: string;
  category?: string;
  example?: string;
  importance: number;
  synonyms?: string[];
};

type Result = {
  correct: number;
  accuracy: number;
  predictedScore: number;
  weak: string[];
};

// 型ガード関数
function isQuestion(obj: unknown): obj is Question {
  if (typeof obj !== "object" || obj === null) return false;
  const q = obj as Record<string, unknown>;
  return (
    typeof q.question === "string" &&
    Array.isArray(q.options) &&
    q.options.every((o) => typeof o === "string") &&
    typeof q.answer === "string" &&
    typeof q.importance === "number"
  );
}

// AI生成中テキスト + 進行バー
const AIGeneratingAnimation: React.FC = () => {
  const [dots, setDots] = useState<string>("");
  const [progress, setProgress] = useState<number>(0);

  // 点滅ドットアニメ
  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length < 3 ? prev + "." : ""));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // プログレスバーアニメ
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => (prev >= 100 ? 0 : prev + 5));
    }, 200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="text-gray-700 text-lg font-mono">AIが問題を生成中{dots}</div>
      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
        <div
          className="bg-blue-500 h-3 rounded-full transition-all duration-200"
          style={{ width: `${progress}%` }}
        ></div>
      </div>
    </div>
  );
};

export default function TOEICTrainer() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [latestScore, setLatestScore] = useState<number | null>(null);
  const [latestWeak, setLatestWeak] = useState<string[]>([]);
  const [count, setCount] = useState<number>(10);
  const [showConfetti, setShowConfetti] = useState(false);
  const [skeletonStage, setSkeletonStage] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // キーボード操作
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (questions.length === 0 || submitted) return;
      const key = e.key.toUpperCase();
      if (["A", "B", "C", "D"].includes(key)) {
        const currentIndex = selected.findIndex((v) => v === "" || v === undefined);
        const idx = currentIndex === -1 ? Math.max(0, selected.length - 1) : currentIndex;
        handleSelect(idx, key);
      }
      if (key === "ENTER" && !selected.includes("") && !submitted) handleSubmit();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [questions, selected, submitted]);

  // 最新スコア取得
  useEffect(() => {
    (async () => {
      try {
        const { data: user } = await supabase.auth.getUser();
        if (!user.user) return;
        const res = await fetch("/api/get-latest-result", { headers: { "x-user-id": user.user.id } });
        const json = (await res.json()) as { result?: { predicted_score?: number; weak_categories?: string[] } };
        if (json.result) {
          setLatestScore(json.result.predicted_score ?? 450);
          setLatestWeak(json.result.weak_categories ?? []);
        }
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  // Skeletonアニメーション
  useEffect(() => {
    if (!loading) return;
    setSkeletonStage(0);
    const ids: number[] = [];
    ids.push(window.setTimeout(() => setSkeletonStage(1), 300));
    ids.push(window.setTimeout(() => setSkeletonStage(2), 900));
    ids.push(window.setTimeout(() => setSkeletonStage(3), 1600));
    return () => ids.forEach(clearTimeout);
  }, [loading]);

  // 問題生成
  const generateQuestions = async (countParam = count) => {
    setLoading(true);
    setQuestions([]);
    setSelected([]);
    setResult(null);
    setSubmitted(false);

    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("ログインしてください");

      const latestRes = await fetch("/api/get-latest-result", { headers: { "x-user-id": user.user.id } });
      const latestJson = (await latestRes.json()) as { result?: { predicted_score?: number; weak_categories?: string[] } };
      const latest = latestJson.result ?? null;

      const payload = {
        estimatedScore: latest?.predicted_score ?? 450,
        weaknesses: latest?.weak_categories ?? [],
        count: countParam,
      };

      const res = await fetch("/api/ai_teacher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as { questions: unknown[] };
      if (!Array.isArray(data.questions)) throw new Error("AI returned invalid format");

      const validQuestions: Question[] = data.questions
        .filter(isQuestion)
        .map((q, i) => ({
          id: q.id ?? `q_${Date.now()}_${i}`,
          question: q.question,
          translation: q.translation ?? "",
          options: q.options,
          answer: q.answer,
          explanation: q.explanation ?? "",
          partOfSpeech: q.partOfSpeech ?? "",
          category: q.category ?? q.partOfSpeech ?? "other",
          example: q.example ?? "",
          importance: Math.min(5, Math.max(1, Math.round(q.importance ?? 3))),
          synonyms: q.synonyms ?? [],
        }));

      setQuestions(validQuestions);
      setSelected(Array(validQuestions.length).fill(""));
    } catch (err) {
      console.error("問題生成失敗", err);
      alert("問題の生成に失敗しました。時間をおいて再試行してください。");
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (qIndex: number, label: string) => {
    setSelected((prev) => {
      const next = [...prev];
      next[qIndex] = label;
      return next;
    });
  };

  const computeWeightedScore = (selected: string[], questions: Question[], previousScore: number) => {
    let totalWeight = 0;
    let weightedCorrect = 0;

    questions.forEach((q, i) => {
      const sel = selected[i];
      if (!sel) return;
      const idx = sel.charCodeAt(0) - 65;
      const picked = q.options[idx];
      const isCorrect = picked === q.answer ? 1 : 0;
      weightedCorrect += isCorrect * q.importance;
      totalWeight += q.importance;
    });

    const accuracyWeighted = totalWeight > 0 ? weightedCorrect / totalWeight : 0;
    return Math.round(previousScore * 0.7 + accuracyWeighted * 990 * 0.3);
  };

  const handleSubmit = async () => {
    if (submitted) return;

    let correct = 0;
    const weakCount: Record<string, number> = {};
    let difficultySum = 0;

    questions.forEach((q, i) => {
      const sel = selected[i];
      if (!sel) return;
      const idx = sel.charCodeAt(0) - 65;
      const picked = q.options[idx];
      const isCorrect = picked === q.answer;
      if (isCorrect) correct++;
      if (!isCorrect)
        weakCount[q.category ?? q.partOfSpeech ?? "other"] =
          (weakCount[q.category ?? q.partOfSpeech ?? "other"] || 0) + 1;
      difficultySum += q.importance;
    });

    const answered = questions.filter((_, i) => selected[i]);
    const accuracy = answered.length > 0 ? correct / answered.length : 0;

    const predictedScore = computeWeightedScore(selected, questions, latestScore ?? 450);

    const weak = Object.entries(weakCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k]) => k);

    const final: Result = { correct, accuracy, predictedScore, weak };
    setResult(final);
    setSubmitted(true);

    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("ログインしてください");

      await fetch("/api/save_test_result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.user.id, questions, selected, result: final }),
      });

      if (latestScore === null || final.predictedScore > latestScore) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 5000);
      }

      setLatestScore(final.predictedScore);
      setLatestWeak(final.weak);
    } catch (e) {
      console.error("保存エラー", e);
    }
  };

  return (
    <div ref={containerRef} className="p-6 max-w-3xl mx-auto">
      {showConfetti && typeof window !== "undefined" && (
        <Confetti width={window.innerWidth} height={window.innerHeight} />
      )}

      <h1 className="text-3xl font-bold mb-4 text-center">TOEIC AIトレーナー（改良版）</h1>

      {/* 問題数選択と生成ボタン */}
      <div className="flex gap-3 items-center justify-center mb-4">
        <div className="text-sm">問題数:</div>
        {[5, 10, 20].map((n) => (
          <button
            key={n}
            onClick={() => setCount(n)}
            className={`px-3 py-1 rounded ${count === n ? "bg-indigo-600 text-white" : "bg-gray-100"}`}
            disabled={loading}
          >
            {n}
          </button>
        ))}

        <button
          onClick={() => generateQuestions(count)}
          disabled={loading}
          className={`ml-4 bg-blue-600 text-white px-4 py-2 rounded shadow ${loading ? "opacity-60 cursor-not-allowed" : "hover:bg-blue-700"}`}
        >
          {loading ? "生成中..." : `問題を生成 (${count})`}
        </button>
      </div>

      {/* 最新スコア */}
      {latestScore !== null && (
        <div className="mb-4 p-3 border rounded bg-gray-50 shadow flex justify-between items-center">
          <div>
            <div className="font-semibold">📘 現在の推定スコア</div>
            <div className="text-lg">TOEIC推定スコア：<b>{latestScore}</b></div>
            <div className="text-sm text-gray-600">苦手分野：{latestWeak.length ? latestWeak.join(", ") : "なし"}</div>
          </div>
          <div className="text-xs text-gray-500">改善案: カテゴリ別学習をおすすめします</div>
        </div>
      )}

      {/* AI生成中 */}
      {loading && (
        <div className="space-y-3">
          <div className="p-4 border rounded bg-gray-50 shadow text-center">
            <AIGeneratingAnimation />
          </div>
        </div>
      )}

      {/* 問題表示 */}
      {questions.map((q, qi) => (
        <div key={q.id} className="mb-6 p-4 border rounded shadow hover:shadow-lg transition duration-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-bold mb-2">{qi + 1}. {q.question}</p>
            </div>
          </div>

          <div className="flex flex-col gap-2 mt-3">
            {q.options.map((opt, oi) => {
              const label = String.fromCharCode(65 + oi);
              const isSelected = selected[qi] === label;
              return (
                <button
                  key={oi}
                  onClick={() => handleSelect(qi, label)}
                  className={`text-left border p-3 rounded transition duration-150 flex justify-between items-center ${isSelected ? "bg-blue-50 border-blue-400 shadow-inner" : "hover:bg-gray-50"}`}
                >
                  <span className="font-medium">{label}.</span>
                  <span className="ml-3 flex-1 text-sm">{opt}</span>
                </button>
              );
            })}
          </div>

          {selected[qi] !== "" && (
            <div className="mt-3 p-3 border-l-4 rounded bg-gray-50 transition-all">
              <p className={`font-semibold mb-1 ${q.options[selected[qi].charCodeAt(0) - 65] === q.answer ? "text-green-600" : "text-red-600"}`}>
                {q.options[selected[qi].charCodeAt(0) - 65] === q.answer ? "✅ 正解" : `❌ 不正解 (正解: ${q.answer})`}
              </p>
              <p className="text-gray-700 mb-1"><span className="font-semibold">訳：</span>{q.translation}</p>
              {q.explanation && <p className="text-gray-600"><span className="font-semibold">解説：</span>{q.explanation}</p>}
              <div className="text-xs text-gray-500">カテゴリ: {q.category} ・重要度: {"★".repeat(q.importance)}</div>
              <div className="text-xs text-gray-500">品詞：{q.partOfSpeech}</div>
            </div>
          )}
        </div>
      ))}

      {/* 採点ボタン */}
      {questions.length > 0 && (
        <div className="flex items-center gap-3">
          <button
            onClick={handleSubmit}
            disabled={selected.includes("") || submitted}
            className="bg-green-600 text-white px-5 py-2 rounded shadow hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitted ? "採点済み" : "採点する"}
          </button>
          <div className="text-sm text-gray-500">※ 未回答があると採点できません</div>
        </div>
      )}

      {/* 結果表示 */}
      {result && (
        <div className="mt-6 p-4 border rounded bg-gray-50 shadow">
          <p>🟦 正解数：{result.correct} / {questions.length}</p>
          <p>🟩 正解率：{Math.round(result.accuracy * 100)}%</p>
          <p>🟧 予測TOEICスコア：<b>{result.predictedScore}</b></p>
          <p>🟥 苦手分野：{result.weak.length ? result.weak.join(", ") : "なし"}</p>
        </div>
      )}
    </div>
  );
}
