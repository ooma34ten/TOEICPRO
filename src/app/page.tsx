"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) router.replace("/auth/login");
      else setLoading(false);
    })();
  }, [router]);

  if (loading) return <div className="min-h-screen flex items-center justify-center">ログイン状態確認中…</div>;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-extrabold text-blue-600 mb-6 text-center">TOEIC 単語学習アプリ</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-lg">
        <Link href="/words/list" className="p-6 bg-white rounded-xl shadow-md hover:shadow-lg flex flex-col items-center">
          <h2 className="text-2xl font-bold text-blue-500 mb-2">単語一覧</h2>
          <p className="text-gray-600 text-center">登録済みのTOEIC単語を確認できます。</p>
        </Link>
        <Link href="/words/review" className="p-6 bg-white rounded-xl shadow-md hover:shadow-lg flex flex-col items-center">
          <h2 className="text-2xl font-bold text-green-500 mb-2">復習モード</h2>
          <p className="text-gray-600 text-center">ランダムに単語を表示して学習できます。</p>
        </Link>
        <Link href="/words/register" className="p-6 bg-white rounded-xl shadow-md hover:shadow-lg flex flex-col items-center">
          <h2 className="text-2xl font-bold text-red-500 mb-2">単語登録</h2>
          <p className="text-gray-600 text-center">学習したい単語を登録できます。</p>
        </Link>
        <Link href="/words/progress" className="p-6 bg-white rounded-xl shadow-md hover:shadow-lg flex flex-col items-center">
          <h2 className="text-2xl font-bold text-yellow-500 mb-2">学習進捗</h2>
          <p className="text-gray-600 text-center">学習記録を観覧できます。</p>
        </Link>
      </div>
    </div>
  );
}
// src/app/page.tsx
