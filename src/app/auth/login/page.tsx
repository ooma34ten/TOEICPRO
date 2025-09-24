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
  const passwordRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/");
    });
  }, [router]);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault(); // ← フォーム送信のリロード防止
    setMsg("");
    if (!email || !password) return setMsg("メールとパスワードを入力してください。");

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return setMsg(error.message);

    router.replace("/");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm bg-white rounded-xl shadow p-6">
        <h1 className="text-2xl font-bold mb-4 text-center">ログイン</h1>

        <form onSubmit={handleLogin}>
          <input
            className="w-full border rounded px-3 py-2 mb-3"
            placeholder="メールアドレス"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") {
                e.preventDefault(); // フォーム送信を防ぐ
                passwordRef.current?.focus(); // パスワード欄に移動
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
            // パスワード欄で Enter → submit
          />
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded mb-2"
          >
            ログイン
          </button>
        </form>

        <p className="text-sm text-center text-gray-500">
          新規登録は
          <Link href="/auth/register" className="text-blue-500">
            こちら
          </Link>
        </p>
        {msg && <p className="text-red-500 mt-3 text-center">{msg}</p>}
      </div>
    </div>
  );
}
// src/app/auth/login/page.tsx
