"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Loader2,
  CheckCircle,
  XCircle,
  User,
  Save,
} from "lucide-react";

export default function SettingsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [statusType, setStatusType] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [nickname, setNickname] = useState("");
  const [originalNickname, setOriginalNickname] = useState("");
  const [nicknameSaving, setNicknameSaving] = useState(false);
  const [nicknameMessage, setNicknameMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        if (localStorage.getItem("guestMode") === "true") {
          setLoading(false);
          return;
        }
        router.replace("/auth/login");
      } else {
        setUserId(data.session.user.id);

        // ニックネーム取得
        const { data: stats } = await supabase
          .from("user_stats")
          .select("nickname")
          .eq("user_id", data.session.user.id)
          .maybeSingle();

        if (stats?.nickname) {
          setNickname(stats.nickname);
          setOriginalNickname(stats.nickname);
        }

        setLoading(false);
      }
    })();
  }, [router]);

  const handleSaveNickname = async () => {
    if (!userId) return;
    if (nickname.trim().length === 0) {
      setNicknameMessage({ type: "error", text: "ニックネームを入力してください" });
      return;
    }
    if (nickname.trim().length > 20) {
      setNicknameMessage({ type: "error", text: "ニックネームは20文字以内にしてください" });
      return;
    }

    setNicknameSaving(true);
    setNicknameMessage(null);

    const { error } = await supabase
      .from("user_stats")
      .update({ nickname: nickname.trim() })
      .eq("user_id", userId);

    if (error) {
      setNicknameMessage({ type: "error", text: "保存に失敗しました: " + error.message });
    } else {
      setOriginalNickname(nickname.trim());
      setNicknameMessage({ type: "success", text: "ニックネームを保存しました！" });
      setTimeout(() => setNicknameMessage(null), 3000);
    }
    setNicknameSaving(false);
  };

  const handleDeleteAccount = async () => {
    if (!confirm("アカウント削除すると、すべての単語データが削除されます。本当に削除しますか？")) return;
    if (!userId) return;

    const { data: profile } = await supabase
      .from("subscriptions")
      .select("is_active")
      .eq("user_id", userId)
      .maybeSingle();

    if (profile?.is_active === true) {
      alert("アカウント削除の前に、まずサブスクリプションをキャンセルしてください。");
      router.replace("/words/subscribe");
      return;
    }

    if (statusType === "loading") return;

    setStatus("削除中...");
    setStatusType("loading");

    const res = await fetch("/api/self-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });

    const data = await res.json();
    if (res.ok) {
      setStatus("削除が完了しました。ご利用ありがとうございました。");
      setStatusType("success");
      await supabase.auth.signOut();
      setTimeout(() => router.replace("/auth/register"), 2000);
    } else {
      setStatus("削除に失敗しました: " + data.error);
      setStatusType("error");
    }
  };

  if (loading)
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--background)]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full mb-4"
        />
        <p className="text-[var(--muted-foreground)] text-sm font-medium">読み込み中…</p>
      </div>
    );

  return (
    <div className="flex items-center justify-center min-h-screen bg-[var(--background)] px-4 pb-20">
      <div className="w-full max-w-lg space-y-6">
        {/* ニックネーム設定 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[var(--card)] rounded-xl p-6 md:p-8 border border-[var(--border)] shadow-sm"
        >
          <h1 className="text-xl font-bold mb-6 text-[var(--foreground)] text-center">設定</h1>

          <div className="space-y-4">
            <div className="flex items-center gap-2 text-[var(--accent)]">
              <User className="w-5 h-5" />
              <h2 className="font-semibold text-lg">ニックネーム</h2>
            </div>

            <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
              ダッシュボードのグリーティングなどに表示される名前です。
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="ニックネームを入力"
                maxLength={20}
                className="flex-1 px-4 py-2 border border-[var(--border)] bg-[var(--secondary)] text-[var(--foreground)] rounded-lg focus:ring-2 focus:ring-[var(--accent)]/40 focus:border-[var(--accent)] outline-none transition text-sm placeholder:text-[var(--muted-foreground)]"
              />
              <button
                onClick={handleSaveNickname}
                disabled={nicknameSaving || nickname.trim() === originalNickname}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-bold text-sm transition ${
                  nicknameSaving || nickname.trim() === originalNickname
                    ? "bg-[var(--secondary)] text-[var(--muted-foreground)] cursor-not-allowed"
                    : "bg-[var(--primary)] hover:opacity-90 text-[var(--primary-foreground)]"
                }`}
              >
                {nicknameSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                保存
              </button>
            </div>

            <p className="text-[11px] text-[var(--muted-foreground)] text-right mt-1">
              {nickname.length}/20 文字
            </p>

            {nicknameMessage && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex items-center text-[13px] p-3 rounded-lg border ${
                  nicknameMessage.type === "success"
                    ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
                    : "text-red-500 bg-red-500/10 border-red-500/20"
                }`}
              >
                {nicknameMessage.type === "success" ? (
                  <CheckCircle className="w-4 h-4 mr-2 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 mr-2 shrink-0" />
                )}
                {nicknameMessage.text}
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* アカウント削除 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-[var(--card)] rounded-xl p-6 md:p-8 border border-[var(--border)] shadow-sm"
        >
          <div className="flex items-center mb-3 text-red-500">
            <AlertTriangle className="w-5 h-5 mr-2" />
            <h2 className="font-semibold text-lg">アカウント削除</h2>
          </div>

          <p className="text-[var(--muted-foreground)] mb-5 leading-relaxed text-[13px]">
            アカウントを削除すると、登録した単語・学習履歴・サブスクリプション情報など、すべてのデータが完全に削除されます。
            この操作は取り消せません。
          </p>

          <button
            onClick={handleDeleteAccount}
            disabled={statusType === "loading"}
            className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-white font-medium text-sm transition
              ${statusType === "loading"
                ? "bg-red-500/50 cursor-not-allowed"
                : "bg-red-500 hover:bg-red-600"
              }
            `}
          >
            {statusType === "loading" ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> 削除中...
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4" /> アカウントを削除
              </>
            )}
          </button>

          {status && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mt-4 flex items-center text-[13px] p-3 rounded-lg border ${
                statusType === "success"
                  ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
                  : statusType === "error"
                  ? "text-red-500 bg-red-500/10 border-red-500/20"
                  : "text-[var(--muted-foreground)] bg-[var(--secondary)] border-[var(--border)]"
              }`}
            >
              {statusType === "success" && <CheckCircle className="w-4 h-4 mr-2" />}
              {statusType === "error" && <XCircle className="w-4 h-4 mr-2" />}
              {status}
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
