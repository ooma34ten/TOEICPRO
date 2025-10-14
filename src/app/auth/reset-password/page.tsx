"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    // Supabaseが自動的にセッションを更新してくれる
    const code = searchParams.get("code");
    if (!code) {
      setMsg("無効なリンクです。もう一度お試しください。");
    }
  }, [searchParams]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setMsg("更新エラー: " + error.message);
    } else {
      setMsg("パスワードを更新しました。ログイン画面へ移動します。");
      setTimeout(() => router.push("/login"), 2000);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen">
      <form onSubmit={handleUpdate} className="p-6 bg-white shadow-md rounded">
        <h1 className="text-xl font-bold mb-4">新しいパスワードを設定</h1>
        <input
          type="password"
          placeholder="新しいパスワード"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border p-2 w-64 mb-3 rounded"
          required
        />
        <button
          type="submit"
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          更新
        </button>
        {msg && <p className="mt-3 text-sm text-gray-700">{msg}</p>}
      </form>
    </div>
  );
}
