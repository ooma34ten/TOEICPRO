"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/auth/login");
      } else {
        setUserId(data.session.user.id);
        setLoading(false);
      }
    })();
  }, [router]);

  const handleDeleteAccount = async () => {
    if (!confirm("アカウント削除すると、すべての単語データが削除されます。本当に削除しますか？")) return;
    if (!userId) return;

    setStatus("削除中...");

    const res = await fetch("/api/self-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });

    const data = await res.json();
    if (res.ok) {
      setStatus("削除完了");
      await supabase.auth.signOut(); // セッション破棄
      router.replace("/auth/register");
    } else {
      setStatus("削除失敗: " + data.error);
    }
  };


  if (loading) return <div>読み込み中…</div>;

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">設定</h1>

      <div className="mb-6">
        <h2 className="font-semibold mb-2">アカウント削除</h2>
        <p className="text-gray-700 mb-2">
          アカウントを削除すると、登録した単語や学習履歴など全てのデータが削除されます。
        </p>
        <button
          onClick={handleDeleteAccount}
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition"
        >
          アカウントを削除
        </button>
      </div>

      {status && <p className="mt-4 text-red-600">{status}</p>}
    </div>
  );
}
// src/app/words/setting/page.tsx
