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
    if (!confirm("本当にアカウントを削除しますか？この操作は元に戻せません。")) return;
    if (!userId) return;

    setStatus("アカウント削除中...");

    try {
      // 1. ユーザー関連のデータ削除（例：単語テーブル）
      const { error: wordError } = await supabase
        .from("words")
        .delete()
        .eq("user_id", userId);

      if (wordError) throw wordError;

      // 2. 認証ユーザー削除
      const { error: authError } = await supabase.auth.admin.deleteUser(userId);
      if (authError) throw authError;

      setStatus("アカウントを削除しました。");
      router.replace("/auth/register");
    } catch (error: unknown) {
      let message = "不明なエラーが発生しました";
      if (error instanceof Error) message = error.message;
      setStatus("削除失敗: " + message);
      console.error(error);
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
