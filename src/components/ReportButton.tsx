"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Flag, X, Send, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";

const REPORT_REASONS = [
    "意味が間違っている",
    "品詞が間違っている",
    "例文がおかしい",
    "翻訳がおかしい",
    "類義語が間違っている",
    "その他",
] as const;

interface ReportButtonProps {
    wordId?: string;
    wordText: string;
    userId?: string | null;
    /** コンパクト表示（アイコンのみ） */
    compact?: boolean;
}

export default function ReportButton({ wordId, wordText, userId, compact = false }: ReportButtonProps) {
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState<string>("");
    const [detail, setDetail] = useState("");
    const [sending, setSending] = useState(false);

    const handleSubmit = async () => {
        if (!reason) {
            toast.error("報告理由を選択してください");
            return;
        }

        // userId が渡されていない場合、直接取得
        let uid = userId;
        if (!uid) {
            const { data } = await supabase.auth.getUser();
            uid = data.user?.id ?? null;
        }
        if (!uid) {
            toast.error("ログインが必要です");
            return;
        }

        setSending(true);
        try {
            const { error } = await supabase.from("word_reports").insert({
                user_id: uid,
                word_id: wordId ?? null,
                word_text: wordText,
                report_reason: reason,
                report_detail: detail.trim() || null,
            });

            if (error) throw error;

            toast.success("報告を送信しました。ご協力ありがとうございます！");
            setOpen(false);
            setReason("");
            setDetail("");
        } catch (err) {
            console.error("Report error:", err);
            toast.error("報告の送信に失敗しました");
        } finally {
            setSending(false);
        }
    };

    return (
        <>
            {/* トリガーボタン */}
            <button
                onClick={() => setOpen(true)}
                title="この単語カードを報告"
                className={`inline-flex items-center gap-1 transition ${compact
                        ? "p-1.5 rounded-lg text-slate-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                        : "px-2.5 py-1 rounded-lg text-xs font-medium text-slate-500 hover:text-orange-600 bg-slate-100 hover:bg-orange-50 dark:bg-slate-800 dark:hover:bg-orange-900/20 dark:text-slate-400 dark:hover:text-orange-400"
                    }`}
            >
                <Flag className={compact ? "w-3.5 h-3.5" : "w-3 h-3"} />
                {!compact && <span>報告</span>}
            </button>

            {/* モーダル */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                        onClick={() => !sending && setOpen(false)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            transition={{ type: "spring", damping: 20 }}
                            className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-2xl max-w-sm w-full border border-slate-200 dark:border-slate-700"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* ヘッダー */}
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                                        <Flag className="w-4 h-4 text-orange-500" />
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                        単語カードを報告
                                    </h3>
                                </div>
                                <button
                                    onClick={() => setOpen(false)}
                                    disabled={sending}
                                    className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* 対象単語 */}
                            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl px-3 py-2 mb-4">
                                <span className="text-xs text-slate-500 dark:text-slate-400">対象単語:</span>
                                <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{wordText}</p>
                            </div>

                            {/* 報告理由 */}
                            <div className="mb-4">
                                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 block">
                                    報告理由 <span className="text-red-500">*</span>
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    {REPORT_REASONS.map((r) => (
                                        <button
                                            key={r}
                                            onClick={() => setReason(r)}
                                            className={`text-xs py-2 px-3 rounded-xl font-medium transition border ${reason === r
                                                    ? "bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-200 dark:shadow-orange-900/30"
                                                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-orange-300 dark:hover:border-orange-700"
                                                }`}
                                        >
                                            {r}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 詳細 */}
                            <div className="mb-5">
                                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 block">
                                    詳細（任意）
                                </label>
                                <textarea
                                    value={detail}
                                    onChange={(e) => setDetail(e.target.value)}
                                    placeholder="具体的な内容を記入してください..."
                                    rows={3}
                                    className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-300 dark:focus:ring-orange-700 resize-none transition"
                                />
                            </div>

                            {/* 送信ボタン */}
                            <button
                                onClick={handleSubmit}
                                disabled={sending || !reason}
                                className={`w-full py-3 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2 ${sending || !reason
                                        ? "bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed"
                                        : "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg shadow-orange-200 dark:shadow-orange-900/30 hover:opacity-90"
                                    }`}
                            >
                                {sending ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        送信中...
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-4 h-4" />
                                        報告を送信
                                    </>
                                )}
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
