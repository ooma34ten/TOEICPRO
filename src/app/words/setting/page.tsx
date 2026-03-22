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

    const { data: profile, error } = await supabase
      .from("subscriptions")
      .select("is_active")
      .eq("user_id", userId)
      .single();

    if (error) {
      console.error(error);
      return;
    }

    if (profile.is_active === true) {
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full mb-4"
        />
        <p className="text-slate-500 dark:text-slate-400 font-medium">読み込み中…</p>
      </div>
    );

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 px-4 pb-20">
      <div className="w-full max-w-lg space-y-6">
        {/* ニックネーム設定 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-slate-900 shadow-xl rounded-2xl p-8 border border-slate-200 dark:border-slate-800"
        >
          <h1 className="text-2xl font-bold mb-6 text-slate-900 dark:text-white text-center">設定</h1>

          <div className="space-y-4">
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
              <User className="w-5 h-5" />
              <h2 className="font-semibold text-lg">ニックネーム</h2>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              ダッシュボードのグリーティングなどに表示される名前です。
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="ニックネームを入力"
                maxLength={20}
                className="flex-1 px-4 py-3 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
              <button
                onClick={handleSaveNickname}
                disabled={nicknameSaving || nickname.trim() === originalNickname}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition ${
                  nicknameSaving || nickname.trim() === originalNickname
                    ? "bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed"
                    : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30"
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

            <p className="text-xs text-slate-400 dark:text-slate-500 text-right">
              {nickname.length}/20 文字
            </p>

            {nicknameMessage && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex items-center text-sm p-3 rounded-xl border ${
                  nicknameMessage.type === "success"
                    ? "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800"
                    : "text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
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
          className="bg-white dark:bg-slate-900 shadow-xl rounded-2xl p-8 border border-slate-200 dark:border-slate-800"
        >
          <div className="flex items-center mb-3 text-red-600 dark:text-red-400">
            <AlertTriangle className="w-5 h-5 mr-2" />
            <h2 className="font-semibold text-lg">アカウント削除</h2>
          </div>

          <p className="text-slate-600 dark:text-slate-400 mb-4 leading-relaxed text-sm">
            アカウントを削除すると、登録した単語・学習履歴・サブスクリプション情報など、すべてのデータが完全に削除されます。
            この操作は取り消せません。
          </p>

          <button
            onClick={handleDeleteAccount}
            disabled={statusType === "loading"}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white font-medium transition
              ${statusType === "loading"
                ? "bg-red-400 dark:bg-red-800 cursor-not-allowed"
                : "bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600"
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
              className={`mt-4 flex items-center text-sm p-3 rounded-xl border ${
                statusType === "success"
                  ? "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800"
                  : statusType === "error"
                  ? "text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                  : "text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
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
