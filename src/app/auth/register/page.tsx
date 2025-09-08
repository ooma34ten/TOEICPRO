"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  const handleRegister = async () => {
    setMsg("");
    if (!email || !password) return setMsg("メールとパスワードを入力してください。");
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) return setMsg(error.message);
    setMsg("登録完了！メール確認後ログインしてください。");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm bg-white rounded-xl shadow p-6">
        <h1 className="text-2xl font-bold mb-4 text-center">新規登録</h1>
        <input className="w-full border rounded px-3 py-2 mb-3" placeholder="メールアドレス" value={email} onChange={e => setEmail(e.target.value)} />
        <input type="password" className="w-full border rounded px-3 py-2 mb-4" placeholder="パスワード" value={password} onChange={e => setPassword(e.target.value)} />
        <button className="w-full bg-green-600 text-white py-2 rounded mb-2" onClick={handleRegister}>登録</button>
        <p className="text-sm text-center text-gray-500">
          ログインは<Link href="/auth/login" className="text-blue-500">こちら</Link>
        </p>
        {msg && <p className="text-red-500 mt-3 text-center">{msg}</p>}
      </div>
    </div>
  );
}
// src/app/auth/register/page.tsx