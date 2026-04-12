"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, X, Sparkles, ArrowRight, ArrowLeft, Zap, Trophy, MessageCircle } from "lucide-react";

interface OnboardingPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

const SLIDES = [
  {
    icon: Sparkles,
    iconColor: "text-yellow-500",
    iconBg: "bg-yellow-500/10 border-yellow-500/20",
    title: "TOEIC PROへようこそ！",
    subtitle: "このアプリでできること",
    items: [
      { emoji: "📝", text: "AI自動生成で単語を効率的に学習" },
      { emoji: "🧠", text: "忘却曲線に基づいた復習システム" },
      { emoji: "📖", text: "Part5形式の問題で文法・語彙を強化" },
      { emoji: "🏇", text: "ウィークリーレースで楽しく継続" },
    ],
  },
  {
    icon: BookOpen,
    iconColor: "text-[var(--accent)]",
    iconBg: "bg-[var(--accent)]/10 border-[var(--accent)]/20",
    title: "単語学習の流れ",
    subtitle: "3ステップで効率よく暗記",
    items: [
      { emoji: "1️⃣", text: "学びたい単語を入力して登録", highlight: "登録" },
      { emoji: "2️⃣", text: "AIが例文・意味・類義語を自動生成", highlight: "自動生成" },
      { emoji: "3️⃣", text: "復習モードで効率的に暗記", highlight: "暗記" },
    ],
  },
  {
    icon: Zap,
    iconColor: "text-violet-500",
    iconBg: "bg-violet-500/10 border-violet-500/20",
    title: "Part5 問題演習",
    subtitle: "AIが毎日新しい問題を生成",
    items: [
      { emoji: "📋", text: "TOEIC Part5形式の4択問題を演習" },
      { emoji: "🤖", text: "AIチャットで分からない問題を質問" },
      { emoji: "📊", text: "正答率ベースで日々のタスク目標を自動調整" },
    ],
  },
  {
    icon: Trophy,
    iconColor: "text-amber-500",
    iconBg: "bg-amber-500/10 border-amber-500/20",
    title: "ウィークリーレース",
    subtitle: "他のプレイヤーと競争して継続力UP",
    items: [
      { emoji: "🏁", text: "毎週月〜日の10人対抗レース" },
      { emoji: "⬆️", text: "1位でランクUP、ランクが上がると目標も高く" },
      { emoji: "🐾", text: "キャラクターが学習とともに成長" },
    ],
  },
];

export default function OnboardingPopup({ isOpen, onClose }: OnboardingPopupProps) {
  const router = useRouter();
  const [currentSlide, setCurrentSlide] = useState(0);

  const handleFinish = () => {
    localStorage.setItem("onboarding_done", "true");
    onClose();
    router.push("/words/register");
  };

  const handleClose = () => {
    localStorage.setItem("onboarding_done", "true");
    onClose();
  };

  const handleNext = () => {
    if (currentSlide < SLIDES.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      handleFinish();
    }
  };

  const handlePrev = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  const slide = SLIDES[currentSlide];
  const SlideIcon = slide.icon;
  const isLastSlide = currentSlide === SLIDES.length - 1;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="bg-[var(--card)] rounded-3xl p-8 shadow-2xl max-w-md w-full border border-[var(--border)] relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 閉じるボタン */}
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-[var(--secondary)] transition text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              <X className="w-5 h-5" />
            </button>

            {/* スライド内容 */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentSlide}
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.25 }}
              >
                {/* アイコン */}
                <div
                  className={`w-16 h-16 ${slide.iconBg} border rounded-full flex items-center justify-center mx-auto mb-5 shadow-lg`}
                >
                  <SlideIcon className={`w-8 h-8 ${slide.iconColor}`} />
                </div>

                {/* タイトル */}
                <div className="text-center mb-5">
                  <h2 className="text-xl font-extrabold text-[var(--foreground)] mb-1">
                    {slide.title}
                  </h2>
                  <p className="text-[13px] text-[var(--muted-foreground)]">
                    {slide.subtitle}
                  </p>
                </div>

                {/* アイテムリスト */}
                <div className="space-y-2.5 mb-6">
                  {slide.items.map((item, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + i * 0.08 }}
                      className="flex items-center gap-3 bg-[var(--secondary)]/60 p-3 rounded-xl border border-[var(--border)]"
                    >
                      <span className="text-lg shrink-0">{item.emoji}</span>
                      <p className="text-[13px] text-[var(--foreground)] leading-snug">
                        {item.text}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>

            {/* ドットインジケーター */}
            <div className="flex items-center justify-center gap-2 mb-5">
              {SLIDES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentSlide(i)}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    i === currentSlide
                      ? "bg-[var(--accent)] w-6"
                      : "bg-[var(--border)] hover:bg-[var(--muted-foreground)]"
                  }`}
                />
              ))}
            </div>

            {/* ナビゲーションボタン */}
            <div className="flex gap-3">
              {currentSlide > 0 && (
                <button
                  onClick={handlePrev}
                  className="px-4 py-3 text-[var(--muted-foreground)] text-sm font-medium hover:text-[var(--foreground)] hover:bg-[var(--secondary)] rounded-xl transition flex items-center gap-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                  戻る
                </button>
              )}
              <button
                onClick={handleNext}
                className="flex-1 py-3 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-xl font-bold hover:opacity-90 transition shadow-lg shadow-[var(--primary)]/20 flex items-center justify-center gap-2 text-[15px]"
              >
                {isLastSlide ? (
                  <>
                    <BookOpen className="w-5 h-5" />
                    単語を登録する
                    <ArrowRight className="w-5 h-5" />
                  </>
                ) : (
                  <>
                    次へ
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>

            {/* スキップリンク */}
            <button
              onClick={handleClose}
              className="w-full mt-3 py-2 text-[var(--muted-foreground)] text-[12px] font-medium hover:text-[var(--foreground)] transition text-center"
            >
              あとで見る
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
