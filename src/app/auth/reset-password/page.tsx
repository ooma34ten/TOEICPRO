"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Loader2 } from "lucide-react";

function ResetPasswordContent() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
   // 🔹 ローディング状態
  const [loading, setLoading] = useState(false);

  // トークンをURLハッシュから読み取ってセッション設定
  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");

    if (!accessToken || !refreshToken) return;

    supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    }).catch((error) => {
      console.warn("Failed to set reset-password session:", error);
    });
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    setLoading(true);
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setMsg("パスワード更新に失敗しました: " + error.message);
    } else {
      setMsg("パスワードが更新されました。ログイン画面へ戻ります。");
      setTimeout(() => router.push("/auth/login"), 2000);
    }
    setLoading(false);
  };

  return (
    <div className="max-w-md mx-auto mt-10 bg-white p-6 rounded-xl shadow">
      <h2 className="text-xl font-bold mb-4">パスワード再設定</h2>
      <form onSubmit={handleReset}>
        <input
          type="password"
          placeholder="新しいパスワード"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border p-2 rounded mb-3"
          required
        />
        <button
          type="submit"
          className="w-full bg-blue-600 text-white p-2 rounded"
        >
          {loading && <Loader2 className="animate-spin" size={18} />}
          更新する
        </button>
      </form>
      {msg && <p className="mt-3 text-center text-gray-700">{msg}</p>}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="text-center mt-10">読み込み中...</div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
