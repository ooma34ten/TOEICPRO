"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  // URLからアクセストークンとリフレッシュトークンを取得
  const accessToken = searchParams.get("access_token");
  const refreshToken = searchParams.get("refresh_token");

  useEffect(() => {
    if (!accessToken || !refreshToken) {
      setMsg("無効なリンクです。");
    }
  }, [accessToken, refreshToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("");

    if (!password) return setMsg("パスワードを入力してください");
    if (!accessToken || !refreshToken) return setMsg("無効なリンクです。");

    try {
      // 1. アクセストークンとリフレッシュトークンでセッションを設定
      await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      // 2. パスワードを更新
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setMsg(error.message);
      } else {
        setMsg("パスワードが更新されました。ログインページへ移動します。");
        setTimeout(() => router.push("/auth/login"), 2000);
      }
    } catch (err) {
    if (err instanceof Error) {
        setMsg(err.message);
    } else {
        setMsg("不明なエラーが発生しました。");
    }
    }

  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm bg-white rounded-xl shadow p-6">
        <h1 className="text-2xl font-bold mb-4 text-center">パスワード再設定</h1>
        {msg && <p className="text-center text-red-500 mb-4">{msg}</p>}
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            placeholder="新しいパスワード"
            className="w-full border rounded px-3 py-2 mb-4"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded"
          >
            更新
          </button>
        </form>
      </div>
    </div>
  );
}
