"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, X, Sparkles, ArrowRight } from "lucide-react";

interface OnboardingPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function OnboardingPopup({ isOpen, onClose }: OnboardingPopupProps) {
  const router = useRouter();

  const handleGoToRegister = () => {
    localStorage.setItem("onboarding_done", "true");
    onClose();
    router.push("/words/register");
  };

  const handleClose = () => {
    localStorage.setItem("onboarding_done", "true");
    onClose();
  };

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

            {/* アイコン */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.15, type: "spring", damping: 12 }}
              className="w-20 h-20 bg-[var(--accent)]/10 border border-[var(--accent)]/20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-[var(--accent)]/10"
            >
              <BookOpen className="w-10 h-10 text-[var(--accent)]" />
            </motion.div>

            {/* タイトル */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="text-center"
            >
              <h2 className="text-2xl font-extrabold text-[var(--foreground)] mb-2 flex items-center justify-center gap-2">
                <Sparkles className="w-5 h-5 text-yellow-500" />
                ようこそ！
                <Sparkles className="w-5 h-5 text-yellow-500" />
              </h2>
              <p className="text-[var(--muted-foreground)] leading-relaxed mb-2">
                TOEIC PROへようこそ！
              </p>
              <p className="text-[var(--muted-foreground)] leading-relaxed">
                まずは<span className="font-bold text-[var(--accent)]">単語を登録</span>して、
                学習を始めましょう！
              </p>
            </motion.div>

            {/* ステップ説明 */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="mt-6 space-y-3"
            >
              <div className="flex items-center gap-3 bg-[var(--accent)]/10 p-3 rounded-xl border border-[var(--accent)]/20">
                <div className="w-8 h-8 bg-[var(--accent)] text-[var(--primary-foreground)] rounded-full flex items-center justify-center text-sm font-bold shrink-0">
                  1
                </div>
                <p className="text-sm text-[var(--foreground)]">
                  学びたい単語を入力して<span className="font-semibold text-[var(--accent)]">登録</span>
                </p>
              </div>
              <div className="flex items-center gap-3 bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20">
                <div className="w-8 h-8 bg-emerald-500 text-white rounded-full flex items-center justify-center text-sm font-bold shrink-0">
                  2
                </div>
                <p className="text-sm text-[var(--foreground)]">
                  AIが例文・意味・類義語を<span className="font-semibold text-emerald-500">自動生成</span>
                </p>
              </div>
              <div className="flex items-center gap-3 bg-violet-500/10 p-3 rounded-xl border border-violet-500/20">
                <div className="w-8 h-8 bg-violet-500 text-white rounded-full flex items-center justify-center text-sm font-bold shrink-0">
                  3
                </div>
                <p className="text-sm text-[var(--foreground)]">
                  復習モードで<span className="font-semibold text-violet-500">効率的に暗記</span>
                </p>
              </div>
            </motion.div>

            {/* ボタン */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className="mt-8 space-y-3"
            >
              <button
                onClick={handleGoToRegister}
                className="w-full py-3.5 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-xl font-bold hover:opacity-90 transition shadow-lg shadow-[var(--primary)]/20 flex items-center justify-center gap-2 text-lg"
              >
                <BookOpen className="w-5 h-5" />
                単語を登録する
                <ArrowRight className="w-5 h-5" />
              </button>
              <button
                onClick={handleClose}
                className="w-full py-2.5 text-[var(--muted-foreground)] text-sm font-medium hover:text-[var(--foreground)] transition"
              >
                あとで見る
              </button>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
