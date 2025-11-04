"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Volume2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { speakText } from "@/lib/speech";
import { getImportanceClasses } from "@/lib/utils";
import { Session } from "@supabase/supabase-js";

type Mode = "problem" | "tip" | "auto";

type TOEICExample = {
  text: string;
  translation?: string;
  point?: string;
  importance?: "★★★★★" | "★★★★" | "★★★" | "★★" | "★";
  answer?: string;
  choices?: string[];
};

type TOEICAnswer = {
  summary?: string;
  examples?: TOEICExample[];
  tips?: string[];
  extra?: { title?: string; content?: string }[];
};

export default function TOEICAIPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<TOEICAnswer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<Mode>("auto");
  const [reveals, setReveals] = useState<Record<number, boolean>>({});
  const [revealAll, setRevealAll] = useState(false);

  // 認証チェック
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/auth/login");
        return;
      }
      setSession(data.session);
      setLoadingSession(false);
    })();
  }, [router]);

  const handleSubmit = async () => {
    if (!question.trim()) return;
    if (!session?.user) {
      setError("ログインしていないと利用できません。");
      return;
    }

    setLoading(true);
    setError("");
    setAnswer(null);
    setReveals({});
    setRevealAll(false);

    try {
      const res = await fetch("/api/toeic-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, userId: session.user.id }),
      });

      const data = await res.json();
      if (!res.ok || !data.answer) {
        setError(data.error || "AIから有効な回答を取得できませんでした。");
        return;
      }

      const a = data.answer as TOEICAnswer;
      setAnswer(a);

      // --- 自動モード判定 ---
      const q = question.toLowerCase();
      if (/コツ|方法|勉強|覚え方|効率|アドバイス/.test(q)) setMode("tip");
      else if (/問題|出して|クイズ|テスト|練習/.test(q)) setMode("problem");
      else setMode("auto");
    } catch {
      setError("通信エラーが発生しました。");
    } finally {
      setLoading(false);
    }
  };

  const toggleReveal = (i: number) =>
    setReveals((prev) => ({ ...prev, [i]: !prev[i] }));

  const toggleRevealAll = () => {
    if (!answer?.examples) return;
    const state = !revealAll;
    const map: Record<number, boolean> = {};
    answer.examples.forEach((_, i) => (map[i] = state));
    setRevealAll(state);
    setReveals(map);
  };

  if (loadingSession)
    return <p className="text-center text-gray-500">セッション確認中...</p>;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold text-center">TOEIC AI アシスタント</h1>

      {/* 質問入力 */}
      <div className="flex flex-col md:flex-row gap-4">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={4}
          placeholder="質問を入力してください（例：likeの使い方、問題を出して、勉強のコツなど）"
          className="flex-1 p-3 border rounded-md resize-none"
        />
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "送信中..." : "質問する"}
        </button>
      </div>

      {/* ローディング */}
      {loading && (
        <div className="flex justify-center items-center gap-2 text-gray-500">
          <svg
            className="animate-spin h-5 w-5 text-blue-600"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          AIが考えています...
        </div>
      )}

      {error && <p className="text-center text-red-500">{error}</p>}

      {/* 回答表示 */}
      {answer && (
        <div className="space-y-5">
          {answer.summary && (
            <div
              className={`p-4 border-l-4 rounded-md ${
                mode === "tip"
                  ? "bg-green-50 border-green-400"
                  : "bg-indigo-50 border-indigo-400"
              }`}
            >
              <h3 className="font-semibold mb-1">要点まとめ</h3>
              <p>{answer.summary}</p>
            </div>
          )}

          {/* --- problem/auto 例文 --- */}
          {Array.isArray(answer.examples) &&
            answer.examples.length > 0 &&
            mode !== "tip" && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-lg">例文・問題</h3>
                  {mode === "problem" && (
                    <button
                      onClick={toggleRevealAll}
                      className="px-3 py-1 bg-yellow-100 rounded hover:bg-yellow-200 text-sm"
                    >
                      {revealAll ? "すべて隠す" : "すべて表示"}
                    </button>
                  )}
                </div>

                {answer.examples.map((ex, i) => {
                  const show = revealAll || reveals[i];
                  return (
                    <div
                      key={i}
                      className="p-4 bg-yellow-50 rounded-md border-l-4 border-yellow-400"
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div>
                          <p className="font-medium">{ex.text}</p>
                          {ex.choices && (
                            <ul className="ml-4 mt-1">
                              {ex.choices.map((c, j) => (
                                <li key={j}>
                                  ({String.fromCharCode(65 + j)}) {c}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                        <button
                          onClick={() => speakText(ex.text)}
                          className="p-1 rounded-full hover:bg-yellow-100"
                          title="発音"
                        >
                          <Volume2 size={16} />
                        </button>
                      </div>

                      
                        <button
                          onClick={() => toggleReveal(i)}
                          className="mt-2 text-sm px-2 py-1 border rounded-md bg-white hover:bg-gray-50"
                        >
                          {show ? "答えを隠す" : "答えを表示"}
                        </button>
                      

                      {show && (
                        <div className="mt-2 text-sm space-y-1">
                          {ex.translation && (
                            <p className="text-gray-600">訳：{ex.translation}</p>
                          )}
                          {ex.point && (
                            <p className="text-green-600">ポイント：{ex.point}</p>
                          )}
                          {ex.importance && (
                            <span
                              className={`inline-block px-2 py-1 rounded text-xs font-semibold ${getImportanceClasses(
                                ex.importance
                              )}`}
                            >
                              重要度：{ex.importance}
                            </span>
                          )}
                          {ex.answer && (
                            <p className="text-blue-600 font-semibold">
                              正解：{ex.answer}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

          {/* --- 共通：tipsがある場合は常に表示 --- */}
          {Array.isArray(answer.tips) && answer.tips.length > 0 && (
            <div className="p-4 bg-blue-50 border-l-4 border-blue-400 rounded-md">
              <h3 className="font-semibold mb-1">💡 学習アドバイス</h3>
              <ul className="ml-6 list-disc space-y-1">
                {answer.tips.map((tip, i) => (
                  <li key={i}>{tip}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
