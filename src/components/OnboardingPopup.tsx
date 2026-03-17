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
            className="bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 閉じるボタン */}
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>

            {/* アイコン */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.15, type: "spring", damping: 12 }}
              className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30"
            >
              <BookOpen className="w-10 h-10 text-white" />
            </motion.div>

            {/* タイトル */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="text-center"
            >
              <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-2 flex items-center justify-center gap-2">
                <Sparkles className="w-5 h-5 text-yellow-500" />
                ようこそ！
                <Sparkles className="w-5 h-5 text-yellow-500" />
              </h2>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-2">
                TOEIC PROへようこそ！
              </p>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                まずは<span className="font-bold text-indigo-600 dark:text-indigo-400">単語を登録</span>して、
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
              <div className="flex items-center gap-3 bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-xl">
                <div className="w-8 h-8 bg-indigo-500 text-white rounded-full flex items-center justify-center text-sm font-bold shrink-0">
                  1
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  学びたい単語を入力して<span className="font-semibold">登録</span>
                </p>
              </div>
              <div className="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-xl">
                <div className="w-8 h-8 bg-emerald-500 text-white rounded-full flex items-center justify-center text-sm font-bold shrink-0">
                  2
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  AIが例文・意味・類義語を<span className="font-semibold">自動生成</span>
                </p>
              </div>
              <div className="flex items-center gap-3 bg-violet-50 dark:bg-violet-900/20 p-3 rounded-xl">
                <div className="w-8 h-8 bg-violet-500 text-white rounded-full flex items-center justify-center text-sm font-bold shrink-0">
                  3
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  復習モードで<span className="font-semibold">効率的に暗記</span>
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
                className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-bold hover:opacity-90 transition shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30 flex items-center justify-center gap-2 text-lg"
              >
                <BookOpen className="w-5 h-5" />
                単語を登録する
                <ArrowRight className="w-5 h-5" />
              </button>
              <button
                onClick={handleClose}
                className="w-full py-2.5 text-slate-500 dark:text-slate-400 text-sm font-medium hover:text-slate-700 dark:hover:text-slate-300 transition"
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
