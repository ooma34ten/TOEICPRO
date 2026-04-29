"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, BarChart3, RotateCcw, BrainCircuit, Target, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// 診断用問題データ
const QUESTIONS = [
    {
        id: 1,
        q: "The marketing director --- the new campaign results yesterday.",
        options: ["discuss", "discussed", "discussing", "discussions"],
        answer: "discussed",
    },
    {
        id: 2,
        q: "Please handle the documents --- so that they don't get damaged.",
        options: ["careful", "carefully", "carefulness", "care"],
        answer: "carefully",
    },
    {
        id: 3,
        q: "The seminar was postponed --- the inclement weather.",
        options: ["because", "due to", "as", "since"],
        answer: "due to",
    },
];

type Step = "START" | "QUIZ" | "ANALYZING" | "RESULT";

export default function DiagnosisPage() {
    const [step, setStep] = useState<Step>("START");
    const [currentIdx, setCurrentIdx] = useState(0);
    const [score, setScore] = useState(0);
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const router = useRouter();

    // 最後の問題の後に「分析中」を挟む演出
    useEffect(() => {
        if (step === "ANALYZING") {
            const timer = setTimeout(() => setStep("RESULT"), 2000);
            return () => clearTimeout(timer);
        }
    }, [step]);

    const handleAnswer = (selected: string) => {
        setSelectedOption(selected);
        
        setTimeout(() => {
            if (selected === QUESTIONS[currentIdx].answer) {
                setScore((prev) => prev + 1);
            }

            if (currentIdx + 1 < QUESTIONS.length) {
                setCurrentIdx((prev) => prev + 1);
                setSelectedOption(null);
            } else {
                setStep("ANALYZING");
            }
        }, 500);
    };

    return (
        <div className="pb-20 pt-8 px-4 max-w-md mx-auto">
            {/* ヘッダー的な要素 */}
            <div className="flex justify-center mb-8">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/20">
                    <Sparkles className="w-3.5 h-3.5 text-[var(--accent)]" />
                    <span className="text-[11px] font-bold text-[var(--accent)]">TOEIC® AI 簡易診断</span>
                </div>
            </div>

            {/* --- START STEP --- */}
            {step === "START" && (
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="bg-card border border-border rounded-2xl p-6 text-center shadow-sm"
                >
                    <div className="w-16 h-16 bg-[var(--accent)]/10 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-[var(--accent)]/20">
                        <BrainCircuit className="w-8 h-8 text-[var(--accent)]" />
                    </div>
                    <h1 className="text-xl font-bold text-foreground mb-3 leading-tight">
                        今の予想スコアを<br />10秒で判定
                    </h1>
                    <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
                        最新の頻出傾向から、あなたの現在の実力を3問のクイズで簡易的に算出します。
                    </p>
                    <button
                        onClick={() => setStep("QUIZ")}
                        className="w-full flex items-center justify-center gap-2 bg-accent text-accent-foreground hover:bg-accent/90 transition-colors py-4 rounded-xl font-bold text-[15px] shadow-sm active:scale-[0.98]"
                    >
                        診断を開始する <ArrowRight size={18} />
                    </button>
                    <p className="mt-4 text-[11px] text-muted-foreground">※登録不要・完全無料</p>
                </motion.div>
            )}

            {/* --- QUIZ STEP --- */}
            {step === "QUIZ" && (
                <motion.div
                    key={currentIdx}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex flex-col"
                >
                    <div className="flex justify-between items-center mb-4 px-1">
                        <span className="text-xs font-bold text-accent">Question {currentIdx + 1} / {QUESTIONS.length}</span>
                        <div className="flex gap-1">
                            {QUESTIONS.map((_, i) => (
                                <div 
                                    key={i} 
                                    className={`h-1.5 w-6 rounded-full transition-colors ${
                                        i < currentIdx ? "bg-accent/50" : i === currentIdx ? "bg-accent" : "bg-secondary"
                                    }`} 
                                />
                            ))}
                        </div>
                    </div>
                    
                    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm mb-6 min-h-[160px] flex items-center">
                        <p className="text-[15px] font-bold leading-relaxed text-foreground">
                            {QUESTIONS[currentIdx].q}
                        </p>
                    </div>

                    <div className="grid gap-3">
                        {QUESTIONS[currentIdx].options.map((opt) => {
                            const isSelected = selectedOption === opt;
                            const isAnswered = selectedOption !== null;
                            return (
                                <button
                                    key={opt}
                                    onClick={() => !isAnswered && handleAnswer(opt)}
                                    disabled={isAnswered}
                                    className={cn(
                                        "w-full text-left p-4 rounded-xl border transition-all font-medium text-[15px]",
                                        isSelected 
                                            ? "border-accent bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-accent shadow-sm"
                                            : "border-border bg-card text-foreground hover:border-accent/50 hover:bg-secondary/50",
                                        isAnswered && !isSelected ? "opacity-50" : "opacity-100"
                                    )}
                                >
                                    {opt}
                                </button>
                            );
                        })}
                    </div>
                </motion.div>
            )}

            {/* --- ANALYZING STEP --- */}
            {step === "ANALYZING" && (
                <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    className="flex flex-col items-center justify-center py-20"
                >
                    <div className="relative w-16 h-16 mb-6">
                        <div className="absolute inset-0 border-4 border-secondary rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-accent rounded-full border-t-transparent animate-spin"></div>
                        <Target className="absolute inset-0 m-auto text-accent w-6 h-6 animate-pulse" />
                    </div>
                    <p className="text-sm font-bold text-foreground animate-pulse">AIデータ照合中...</p>
                </motion.div>
            )}

            {/* --- RESULT STEP --- */}
            {step === "RESULT" && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.5, type: "spring" }}
                    className="bg-card rounded-2xl p-6 shadow-sm border border-border text-center overflow-hidden"
                >
                    <h2 className="text-[13px] text-muted-foreground font-bold mb-2">判定結果</h2>
                    <p className="text-[11px] text-muted-foreground mb-1">あなたの推定スコアは</p>
                    <div className="text-5xl font-black text-accent mb-6 tracking-tight flex items-baseline justify-center gap-1">
                        {score === 3 ? "730〜" : score === 2 ? "550〜" : "〜450"}
                        <span className="text-lg text-foreground">点</span>
                    </div>

                    <div className="bg-secondary/50 rounded-xl p-4 mb-6 text-left border border-border/50">
                        <div className="flex items-center gap-1.5 font-bold mb-2 text-foreground text-[13px]">
                            <CheckCircle2 size={16} className="text-emerald-500" />
                            <span>AI分析アドバイス</span>
                        </div>
                        <p className="text-[12px] text-muted-foreground leading-relaxed">
                            {score === 3
                                ? "基礎は完璧です。Part7の速読対策に集中することで800点突破が見えます。"
                                : "単語の品詞分解に課題があります。頻出の文法パターンを網羅しましょう。"}
                        </p>
                    </div>

                    <div className="space-y-3">
                        <button
                            onClick={() => router.push("/")}
                            className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-4 rounded-xl text-[15px] shadow-sm transition-transform active:scale-[0.98]"
                        >
                            <BarChart3 size={18} /> 無料で本格対策を始める
                        </button>
                        <button
                            onClick={() => {
                                setStep("START");
                                setCurrentIdx(0);
                                setScore(0);
                                setSelectedOption(null);
                            }}
                            className="flex items-center justify-center gap-1.5 text-muted-foreground hover:text-foreground text-[13px] w-full py-2 font-medium transition-colors"
                        >
                            <RotateCcw size={14} /> もう一度診断する
                        </button>
                    </div>
                </motion.div>
            )}
        </div>
    );
}