"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { Loader2, UserCircle, Mail, Lock } from "lucide-react";
import { FcGoogle } from "react-icons/fc";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
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

    router.replace("/");
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    setLoading(false);
    if (error) setMsg("Googleログインに失敗しました: " + error.message);
  };

  const handleResetPassword = async () => {
    setResetMsg("");
    if (!resetEmail) return setResetMsg("メールアドレスを入力してください。");

    setResetLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: window.location.origin + "/auth/reset-password",
    });
    setResetLoading(false);

    if (error) {
      setResetMsg("メール送信に失敗しました。もう一度お試しください。");
    } else {
      setResetMsg("パスワード再設定メールを送信しました。メールを確認してください。");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
      <div className="w-full max-w-[400px]">
        {/* ブランディング */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black tracking-tight mb-1">
            TOEIC<span className="text-[var(--accent)]">PRO</span>
          </h1>
          <p className="text-[13px] text-[var(--muted-foreground)]">
            AIと共にスコアアップを目指す
          </p>
        </div>

        {/* カード */}
        <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-6 shadow-sm">
          <h2 className="text-lg font-bold text-[var(--foreground)] mb-5">ログイン</h2>

          <form onSubmit={handleLogin} className="space-y-3">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
              <input
                className="w-full pl-10 pr-4 py-2.5 bg-[var(--secondary)] border border-[var(--border)] rounded-lg text-[var(--foreground)] text-sm placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 focus:border-[var(--accent)] transition"
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
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
              <input
                ref={passwordRef}
                type="password"
                className="w-full pl-10 pr-4 py-2.5 bg-[var(--secondary)] border border-[var(--border)] rounded-lg text-[var(--foreground)] text-sm placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 focus:border-[var(--accent)] transition"
                placeholder="パスワード"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg font-semibold text-sm bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50 transition flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="animate-spin" size={16} />}
              ログイン
            </button>
          </form>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--border)]" />
            </div>
            <div className="relative flex justify-center text-[11px]">
              <span className="bg-[var(--card)] px-3 text-[var(--muted-foreground)]">または</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full py-2.5 rounded-lg flex items-center justify-center gap-2 bg-[var(--secondary)] border border-[var(--border)] text-[var(--foreground)] text-sm font-medium hover:bg-[var(--muted)] transition"
          >
            <FcGoogle size={18} />
            Googleでログイン
          </button>

          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="w-full text-center text-[var(--muted-foreground)] hover:text-[var(--foreground)] mt-4 text-[12px] transition-colors"
          >
            パスワードを忘れた場合
          </button>

          {msg && (
            <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-red-600 dark:text-red-400 text-[13px] text-center">{msg}</p>
            </div>
          )}
        </div>

        {/* 下部リンク */}
        <div className="mt-4 space-y-3">
          <p className="text-[13px] text-center text-[var(--muted-foreground)]">
            アカウントをお持ちでない方は{" "}
            <Link href="/auth/register" className="text-[var(--accent)] font-semibold hover:opacity-80 transition-opacity">
              新規登録（無料）
            </Link>
          </p>

          <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4">
            <button
              type="button"
              onClick={() => {
                localStorage.setItem("guestMode", "true");
                router.replace("/");
              }}
              className="w-full py-2.5 rounded-lg flex items-center justify-center gap-2 bg-[var(--secondary)] hover:bg-[var(--muted)] text-[var(--foreground)] text-sm font-medium transition border border-[var(--border)]"
            >
              <UserCircle size={18} />
              ゲストとして利用する
            </button>
            <p className="text-[11px] text-center text-[var(--muted-foreground)] mt-2">
              ※ゲストモードではデータの保存ができません
            </p>
          </div>
        </div>
      </div>

      {/* パスワード再設定モーダル */}
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50 p-4">
          <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold text-[var(--foreground)] mb-4">パスワード再設定</h2>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
              <input
                type="email"
                placeholder="メールアドレス"
                className="w-full pl-10 pr-4 py-2.5 bg-[var(--secondary)] border border-[var(--border)] rounded-lg text-[var(--foreground)] text-sm placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 focus:border-[var(--accent)] transition mb-4"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleResetPassword}
                disabled={resetLoading}
                className="flex-1 py-2.5 rounded-lg font-semibold text-sm bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50 transition flex items-center justify-center gap-2"
              >
                {resetLoading && <Loader2 className="animate-spin" size={16} />}
                送信
              </button>
              <button
                onClick={() => {
                  setShowModal(false);
                  setResetMsg("");
                }}
                className="px-4 py-2.5 rounded-lg text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] bg-[var(--secondary)] hover:bg-[var(--muted)] transition"
              >
                閉じる
              </button>
            </div>
            {resetMsg && <p className="mt-3 text-[13px] text-[var(--foreground)]">{resetMsg}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
