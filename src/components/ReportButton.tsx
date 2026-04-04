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
            try {
                const { data } = await supabase.auth.getUser();
                uid = data.user?.id ?? null;
            } catch (e) {
                console.warn("User fetch error:", e);
            }
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
                        ? "p-1.5 rounded-lg text-[var(--muted-foreground)] hover:text-orange-500 hover:bg-orange-500/10"
                        : "px-2.5 py-1 rounded-lg text-xs font-medium text-[var(--muted-foreground)] hover:text-orange-500 bg-[var(--secondary)] hover:bg-orange-500/10 border border-[var(--border)]"
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
                            className="bg-[var(--card)] rounded-xl p-6 shadow-2xl max-w-sm w-full border border-[var(--border)]"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* ヘッダー */}
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 bg-orange-500/10 border border-orange-500/20 rounded-full flex items-center justify-center">
                                        <Flag className="w-4 h-4 text-orange-500" />
                                    </div>
                                    <h3 className="text-base font-bold text-[var(--foreground)]">
                                        単語カードを報告
                                    </h3>
                                </div>
                                <button
                                    onClick={() => setOpen(false)}
                                    disabled={sending}
                                    className="p-1 rounded-lg hover:bg-[var(--secondary)] text-[var(--muted-foreground)] transition"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* 対象単語 */}
                            <div className="bg-[var(--secondary)] rounded-xl px-3 py-2.5 mb-4 border border-[var(--border)]">
                                <span className="text-xs text-[var(--muted-foreground)]">対象単語:</span>
                                <p className="text-sm font-bold text-[var(--accent)]">{wordText}</p>
                            </div>

                            {/* 報告理由 */}
                            <div className="mb-4">
                                <label className="text-xs font-semibold text-[var(--muted-foreground)] mb-2 block">
                                    報告理由 <span className="text-red-500">*</span>
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    {REPORT_REASONS.map((r) => (
                                        <button
                                            key={r}
                                            onClick={() => setReason(r)}
                                            className={`text-[11px] py-2 px-3 rounded-lg font-medium transition border ${reason === r
                                                    ? "bg-orange-500/10 text-orange-500 border-orange-500/30"
                                                    : "bg-[var(--secondary)] text-[var(--foreground)] border-[var(--border)] hover:border-orange-500/50"
                                                }`}
                                        >
                                            {r}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 詳細 */}
                            <div className="mb-5">
                                <label className="text-xs font-semibold text-[var(--muted-foreground)] mb-2 block">
                                    詳細（任意）
                                </label>
                                <textarea
                                    value={detail}
                                    onChange={(e) => setDetail(e.target.value)}
                                    placeholder="具体的な内容を記入してください..."
                                    rows={3}
                                    className="w-full text-sm border border-[var(--border)] rounded-lg p-3 bg-[var(--secondary)] text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-orange-500/40 resize-none transition"
                                />
                            </div>

                            {/* 送信ボタン */}
                            <button
                                onClick={handleSubmit}
                                disabled={sending || !reason}
                                className={`w-full py-2.5 rounded-lg font-bold text-sm transition flex items-center justify-center gap-2 ${sending || !reason
                                        ? "bg-[var(--secondary)] text-[var(--muted-foreground)] cursor-not-allowed"
                                        : "bg-orange-500 text-white hover:bg-orange-600 shadow-sm"
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
