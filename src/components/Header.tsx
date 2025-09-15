"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function Header() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    // 初回ロード時にユーザー情報を取得
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
    };
    getUser();

    // 認証状態の変更を監視
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  return (
    <header className="px-4 py-3 bg-white border-b flex items-center gap-4">
      <Link href="/" className="font-bold text-blue-600">TOEIC 単語学習アプリ</Link>
      <nav className="flex gap-3 text-sm">
        <Link href="/words/list" className="underline hover:no-underline">単語一覧</Link>
        <Link href="/words/register" className="underline hover:no-underline">単語登録</Link>
        <Link href="/words/review" className="underline hover:no-underline">復習モード</Link>
        <Link href="/words/progress" className="underline hover:no-underline">学習進捗</Link>
        <Link href="/words/contact" className="underline hover:no-underline">お問い合わせ</Link>
        <Link href="/words/setting" className="underline hover:no-underline">設定</Link>
        <Link href="/words/privacy" className="underline hover:no-underline">プライバシーポリシー</Link>
        <Link href="/words/terms" className="underline hover:no-underline">利用規約</Link>
      </nav>
      <div className="ml-auto">
        {userId ? (
          <Link href="/auth/logout" className="text-sm text-gray-500 underline">ログアウト</Link>
        ) : (
          <Link href="/auth/login" className="text-sm text-gray-500 underline">ログイン</Link>
        )}
      </div>
    </header>
  );
}
// src/components/Header.tsx
