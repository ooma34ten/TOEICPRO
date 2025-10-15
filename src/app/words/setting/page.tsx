"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, CheckCircle, XCircle } from "lucide-react";

export default function SettingsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [statusType, setStatusType] = useState<"idle" | "loading" | "success" | "error">("idle");
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/auth/login");
      } else {
        setUserId(data.session.user.id);
        setLoading(false);
      }
    })();
  }, [router]);

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
      alert("アカウント削除の前に、まずサブスクリプションリプションをキャンセルしてください。");
      router.replace("/words/subscribe");
      return;
    }

    if (statusType === "loading") return; // 多重クリック防止

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
      <div className="flex items-center justify-center h-screen text-gray-600">
        <Loader2 className="animate-spin mr-2" /> 読み込み中…
      </div>
    );

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 px-4">
      <div className="bg-white shadow-xl rounded-2xl p-8 w-full max-w-lg border border-gray-100">
        <h1 className="text-2xl font-bold mb-6 text-gray-900 text-center">設定</h1>

        <div className="border-t border-gray-200 pt-6">
          <div className="flex items-center mb-3 text-red-600">
            <AlertTriangle className="w-5 h-5 mr-2" />
            <h2 className="font-semibold text-lg">アカウント削除</h2>
          </div>

          <p className="text-gray-700 mb-4 leading-relaxed">
            アカウントを削除すると、登録した単語・学習履歴・サブスクリプションリプション情報など、すべてのデータが完全に削除されます。
            この操作は取り消せません。
          </p>

          <button
            onClick={handleDeleteAccount}
            disabled={statusType === "loading"}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-white font-medium transition
              ${statusType === "loading"
                ? "bg-red-400 cursor-not-allowed"
                : "bg-red-600 hover:bg-red-700"}
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
            <div
              className={`mt-4 flex items-center text-sm p-3 rounded-lg border ${
                statusType === "success"
                  ? "text-green-700 bg-green-50 border-green-200"
                  : statusType === "error"
                  ? "text-red-700 bg-red-50 border-red-200"
                  : "text-gray-700 bg-gray-50 border-gray-200"
              }`}
            >
              {statusType === "success" && <CheckCircle className="w-4 h-4 mr-2" />}
              {statusType === "error" && <XCircle className="w-4 h-4 mr-2" />}
              {status}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
