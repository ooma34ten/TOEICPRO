"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  // 🔹 ローディング状態
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  // 🔹 モーダル制御
  const [showModal, setShowModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetMsg, setResetMsg] = useState("");

  const passwordRef = useRef<HTMLInputElement | null>(null);

  // 🔹 既にログイン中ならリダイレクト
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/");
    });
  }, [router]);

  // 🔹 ログイン処理
  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setMsg("");
    if (!email || !password) {
      return setMsg("メールアドレスとパスワードを入力してください。");
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      let errorMsg = "ログインに失敗しました。";
      if (error.message.includes("Invalid login credentials")) {
        errorMsg = "メールアドレスまたはパスワードが正しくありません。";
      } else if (error.message.includes("Email not confirmed")) {
        errorMsg = "メールアドレスが確認されていません。メールをご確認ください。";
      } else if (error.message.includes("rate limit")) {
        errorMsg = "試行回数が多すぎます。しばらくしてからお試しください。";
      } else {
        errorMsg = "エラー: " + error.message;
      }
      return setMsg(errorMsg);
    }

    // ✅ ログイン成功
    router.replace("/");
  };

  // 🔹 パスワード再設定処理
  const handleResetPassword = async () => {
    setResetMsg("");
    if (!resetEmail) return setResetMsg("メールアドレスを入力してください。");

    setResetLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: "https://toeicpro.vercel.app/auth/reset-password",
    });
    setResetLoading(false);

    if (error) {
      setResetMsg("メール送信に失敗しました。もう一度お試しください。");
    } else {
      setResetMsg("パスワード再設定メールを送信しました。メールを確認してください。");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm bg-white rounded-xl shadow p-6 relative">
        <h1 className="text-2xl font-bold mb-4 text-center">ログイン</h1>

        <form onSubmit={handleLogin}>
          <input
            className="w-full border rounded px-3 py-2 mb-3"
            placeholder="メールアドレス"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                passwordRef.current?.focus();
              }
            }}
          />
          <input
            ref={passwordRef}
            type="password"
            className="w-full border rounded px-3 py-2 mb-4"
            placeholder="パスワード"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-2 rounded mb-2 flex items-center justify-center gap-2 ${
              loading ? "bg-blue-400" : "bg-blue-600 hover:bg-blue-700"
            } text-white transition`}
          >
            {loading && <Loader2 className="animate-spin" size={18} />}
            ログイン
          </button>

          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="w-full text-center text-blue-500 mt-2 text-sm"
          >
            パスワードを忘れた場合
          </button>
        </form>

        <p className="text-sm text-center text-gray-500 mt-3">
          新規登録（無料）は{" "}
          <Link href="/auth/register" className="text-blue-500">
            こちら
          </Link>
        </p>

        {msg && <p className="text-red-500 mt-3 text-center">{msg}</p>}
      </div>

      {/* 🔹 パスワード再設定モーダル */}
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-sm p-6 relative">
            <h2 className="text-xl font-semibold mb-4">パスワード再設定</h2>
            <input
              type="email"
              placeholder="メールアドレス"
              className="w-full border rounded px-3 py-2 mb-4"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
            />
            <div className="flex justify-between items-center">
              <button
                onClick={handleResetPassword}
                disabled={resetLoading}
                className={`px-4 py-2 rounded text-white flex items-center justify-center gap-2 transition ${
                  resetLoading ? "bg-blue-400" : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {resetLoading && <Loader2 className="animate-spin" size={18} />}
                送信
              </button>
              <button
                onClick={() => {
                  setShowModal(false);
                  setResetMsg("");
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                閉じる
              </button>
            </div>
            {resetMsg && <p className="mt-3 text-sm text-gray-700">{resetMsg}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
