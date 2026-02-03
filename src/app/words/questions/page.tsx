"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { speakText } from "@/lib/speech";
import Confetti from "react-confetti";
import {
  Zap,
  Target,
  RotateCcw,
  TrendingUp,
  BookOpen,
  CheckCircle,
  Clock,
  AlertTriangle,
  ChevronRight,
  Volume2,
  Filter
} from "lucide-react";

// =============================
// 型定義
// =============================
type Question = {
  id: string;
  question: string;
  translation: string;
  options: string[];
  answer: string;
  explanation: string;
  part_of_speech: string;
  category?: number;
  importance: number;
  level: number;
};

type WeaknessCategory = {
  categoryId: number;
  categoryName: string;
  correctRate: number;
  total: number;
};

type Mode = "quick" | "focus" | "weakness" | "review";

// =============================
// コンポーネント: モード選択カード
// =============================
const ModeCard = ({
  title,
  desc,
  icon: Icon,
  color,
  onClick
}: {
  title: string;
  desc: string;
  icon: any;
  color: string;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={`relative overflow-hidden bg-white p-6 rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100 text-left group`}
  >
    <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity ${color}`}>
      <Icon size={80} />
    </div>
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${color} text-white shadow-lg`}>
      <Icon size={24} />
    </div>
    <h3 className="text-lg font-bold text-gray-800 mb-1">{title}</h3>
    <p className="text-sm text-gray-500">{desc}</p>
  </button>
);

// =============================
// メインページ
// =============================
export default function QuestionBankPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [weaknesses, setWeaknesses] = useState<WeaknessCategory[]>([]);
  const [mode, setMode] = useState<Mode | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [sessionStats, setSessionStats] = useState({ correct: 0, total: 0 });
  const [showConfetti, setShowConfetti] = useState(false);
  const [fetching, setFetching] = useState(false);

  const answerStartTimeRef = useRef<number>(0);

  // 初回ロード
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/auth/login");
        return;
      }
      setUserId(data.session.user.id);

      // 弱点情報の取得 (初期表示用)
      fetchWeaknesses(data.session.user.id);
      setLoading(false);
    })();
  }, [router]);

  const fetchWeaknesses = async (uid: string) => {
    try {
      // 簡易的にスマートAPIを叩いて弱点だけ取得も可能だが、
      // ここではAPIのレスポンス構造に依存
      const res = await fetch("/api/smart-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: uid, mode: "quick", count: 1 }),
      });
      const data = await res.json();
      if (data.weaknesses) {
        setWeaknesses(data.weaknesses);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // 問題開始
  const startSession = async (selectedMode: Mode) => {
    if (!userId) return;
    setMode(selectedMode);
    setFetching(true);
    setQuestions([]);
    setSessionStats({ correct: 0, total: 0 });
    setCurrentIndex(0);
    setShowResult(false);
    setSelectedAnswer(null);

    let count = 10;
    if (selectedMode === "quick") count = 5;
    if (selectedMode === "focus") count = 20;
    if (selectedMode === "weakness") count = 10;

    try {
      const res = await fetch("/api/smart-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, mode: selectedMode, count }),
      });
      const data = await res.json();

      if (data.questions && data.questions.length > 0) {
        setQuestions(data.questions);
        answerStartTimeRef.current = Date.now();
      } else {
        alert("条件に合う問題が見つかりませんでした。別のモードを試してください。");
        setMode(null);
      }
    } catch (e) {
      alert("エラーが発生しました");
      setMode(null);
    } finally {
      setFetching(false);
    }
  };

  // 回答送信
  const submitAnswer = async () => {
    if (!selectedAnswer || !userId) return;

    const currentQ = questions[currentIndex];
    const isCorrect = selectedAnswer === currentQ.answer;
    const timeMs = Date.now() - answerStartTimeRef.current;

    setSessionStats(prev => ({
      total: prev.total + 1,
      correct: prev.correct + (isCorrect ? 1 : 0)
    }));
    setShowResult(true);

    if (isCorrect) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2000);
    }

    // 保存
    try {
      await fetch("/api/save-question-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          questionId: currentQ.id,
          userAnswer: selectedAnswer,
          isCorrect,
          answerTimeMs: timeMs
        })
      });
    } catch (e) {
      console.error(e);
    }
  };

  // 次へ
  const nextQuestion = () => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setShowResult(false);
      answerStartTimeRef.current = Date.now();
    } else {
      // 終了
      setQuestions([]); // 結果画面へ切り替えるため空にするか、完了フラグを立てる
      // ここでは完了画面モードへ
      setMode("finished" as any);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  // =============================
  // 完了画面
  // =============================
  if (mode === "finished" as any) {
    const accuracy = sessionStats.total > 0 ? Math.round((sessionStats.correct / sessionStats.total) * 100) : 0;
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        {accuracy >= 80 && <Confetti recycle={false} numberOfPieces={500} />}
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full text-center">
          <h2 className="text-3xl font-bold text-gray-800 mb-2">おつかれさまでした！🎉</h2>
          <p className="text-gray-500 mb-8">今回の学習結果</p>

          <div className="flex justify-center gap-4 mb-8">
            <div className="text-center p-4 bg-blue-50 rounded-2xl w-32">
              <div className="text-3xl font-bold text-blue-600">{sessionStats.correct}/{sessionStats.total}</div>
              <div className="text-xs text-gray-500 font-bold mt-1">正解数</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-2xl w-32">
              <div className="text-3xl font-bold text-green-600">{accuracy}%</div>
              <div className="text-xs text-gray-500 font-bold mt-1">正解率</div>
            </div>
          </div>

          <button
            onClick={() => { setMode(null); fetchWeaknesses(userId!); }}
            className="w-full bg-black text-white py-4 rounded-xl font-bold hover:opacity-80 transition"
          >
            トップに戻る
          </button>
        </div>
      </div>
    );
  }

  // =============================
  // クイズ画面
  // =============================
  if (mode && questions.length > 0) {
    const currentQ = questions[currentIndex];
    const progress = ((currentIndex + 1) / questions.length) * 100;

    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-8">
        {showConfetti && <Confetti recycle={false} numberOfPieces={200} />}

        <div className="max-w-3xl mx-auto">
          {/* ヘッダー */}
          <div className="flex items-center justify-between mb-6">
            <button onClick={() => setMode(null)} className="text-gray-500 hover:text-black">
              ← 中断する
            </button>
            <div className="text-sm font-bold text-gray-500">
              {currentIndex + 1} / {questions.length}
            </div>
          </div>

          {/* プログレスバー */}
          <div className="h-2 bg-gray-200 rounded-full mb-8 overflow-hidden">
            <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>

          {/* 問題カード */}
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-10 mb-6">
            <div className="flex justify-between items-start mb-6">
              <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold">
                Part 5 形式
              </span>
              <div className="flex gap-2">
                <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600">
                  Level {currentQ.level}
                </span>
                <button onClick={() => speakText(currentQ.question)} className="text-gray-400 hover:text-blue-500">
                  <Volume2 size={20} />
                </button>
              </div>
            </div>

            <h2 className="text-xl md:text-2xl font-medium text-gray-900 leading-relaxed mb-8">
              {currentQ.question}
            </h2>

            <div className="grid grid-cols-1 gap-3">
              {currentQ.options.map((opt, i) => {
                const label = String.fromCharCode(65 + i);
                const isSelected = selectedAnswer === opt;
                const isAnswer = opt === currentQ.answer;

                let style = "border-gray-200 hover:border-gray-400 hover:bg-gray-50";
                if (showResult) {
                  if (isAnswer) style = "border-green-500 bg-green-50 text-green-700";
                  else if (isSelected) style = "border-red-500 bg-red-50 text-red-700";
                  else style = "border-gray-100 opacity-50";
                } else if (isSelected) {
                  style = "border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600";
                }

                return (
                  <button
                    key={i}
                    disabled={showResult}
                    onClick={() => setSelectedAnswer(opt)}
                    className={`flex items-center p-4 rounded-xl border-2 text-left transition-all ${style}`}
                  >
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mr-4 ${showResult && isAnswer ? "bg-green-500 text-white" :
                        showResult && isSelected ? "bg-red-500 text-white" :
                          isSelected ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-600"
                      }`}>
                      {label}
                    </span>
                    <span className="font-medium">{opt}</span>
                    {showResult && isAnswer && <CheckCircle className="ml-auto text-green-600" size={20} />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* アクションボタン */}
          <div className="mt-6">
            {showResult ? (
              <div className="animate-in fade-in slide-in-from-bottom-4">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6">
                  <div className="flex items-center gap-2 mb-2 font-bold text-gray-900">
                    <BookOpen size={18} className="text-blue-500" />
                    解説
                  </div>
                  <p className="text-gray-700 leading-relaxed mb-2">{currentQ.explanation}</p>
                  <p className="text-sm text-gray-500 border-t pt-2 mt-2">訳: {currentQ.translation}</p>
                </div>
                <button
                  onClick={nextQuestion}
                  className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
                >
                  次の問題へ <ChevronRight size={20} />
                </button>
              </div>
            ) : (
              <button
                onClick={submitAnswer}
                disabled={!selectedAnswer}
                className="w-full bg-black text-white py-4 rounded-xl font-bold hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                回答する
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (fetching) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mb-4"></div>
        <p className="text-gray-500 font-medium">最適な問題をセレクト中...</p>
      </div>
    );
  }

  // =============================
  // トップ画面（モード選択）
  // =============================
  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-10">
      <div className="max-w-5xl mx-auto">
        <div className="mb-10 text-center md:text-left">
          <h1 className="text-3xl font-extrabold text-gray-900 mb-2">TOEIC 問題バンク</h1>
          <p className="text-gray-500">あなたの現在のレベルと苦手に合わせて、最適な問題を出題します。</p>
        </div>

        {/* 弱点アラート */}
        {weaknesses.length > 0 && (
          <div className="bg-orange-50 border border-orange-100 rounded-2xl p-6 mb-10 flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className="bg-orange-100 p-3 rounded-xl text-orange-600">
              <AlertTriangle size={24} />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-gray-900 mb-1">弱点カテゴリが見つかりました</h3>
              <p className="text-gray-600 text-sm">
                最近の学習データから、以下の分野の正解率が低くなっています。重点的に復習しましょう。
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {weaknesses.slice(0, 3).map((w) => (
                <span key={w.categoryId} className="px-3 py-1 bg-white border border-orange-200 text-orange-700 rounded-full text-sm font-medium shadow-sm">
                  {w.categoryName} ({Math.round(w.correctRate * 100)}%)
                </span>
              ))}
            </div>
          </div>
        )}

        <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <Target className="text-blue-500" />
          学習モードを選択
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <ModeCard
            title="クイック挑戦"
            desc="5問 / 約2分。隙間時間に最適。"
            icon={Zap}
            color="bg-yellow-500"
            onClick={() => startSession("quick")}
          />
          <ModeCard
            title="集中特訓"
            desc="20問。本番形式でしっかりと。"
            icon={Clock}
            color="bg-blue-600"
            onClick={() => startSession("focus")}
          />
          <ModeCard
            title="弱点克服"
            desc="苦手なカテゴリを重点的に。"
            icon={TrendingUp}
            color="bg-red-500"
            onClick={() => startSession("weakness")}
          />
          <ModeCard
            title="総復習"
            desc="過去に間違えた問題を再挑戦。"
            icon={RotateCcw}
            color="bg-green-600"
            onClick={() => startSession("review")}
          />
        </div>

        <div className="mt-12 bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Filter size={20} className="text-gray-400" />
              カスタム出題（※準備中）
            </h2>
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded">Coming Soon</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 opacity-50 pointer-events-none">
            {["Part 5 (短文穴埋め)", "Part 6 (長文穴埋め)", "600点レベル", "800点レベル"].map(tag => (
              <div key={tag} className="border border-gray-200 rounded-lg p-3 text-center text-sm text-gray-500">
                {tag}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
