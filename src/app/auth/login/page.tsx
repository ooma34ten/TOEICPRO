"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  // 🔹 モーダル制御
  const [showModal, setShowModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetMsg, setResetMsg] = useState("");

  const passwordRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/");
    });
  }, [router]);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setMsg("");
    if (!email || !password) return setMsg("メールとパスワードを入力してください。");

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return setMsg(error.message);

    router.replace("/");
  };

  // 🔹 パスワード再設定
  const handleResetPassword = async () => {
    setResetMsg("");
    if (!resetEmail) return setResetMsg("メールアドレスを入力してください。");

    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: "https://toeicpro.vercel.app/auth/reset-password"
    });

    if (error) {
      setResetMsg(error.message);
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
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => {
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
            onChange={e => setPassword(e.target.value)}
          />
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded mb-2"
          >
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
          新規登録は{" "}
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
              onChange={e => setResetEmail(e.target.value)}
            />
            <div className="flex justify-between items-center">
              <button
                onClick={handleResetPassword}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
              >
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
