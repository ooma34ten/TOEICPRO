// src/app/words/subscribe/page.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Subscription = {
  id: string;
  user_id: string;
  plan: string;
  is_active: boolean;
};

export default function SubscriptionPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  // 初回ロード
  useEffect(() => {
    const loadSubscription = async () => {
      setLoading(true);
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        setMessage("ログインしてください");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        setMessage("サブスク情報の取得に失敗しました");
      } else {
        setSubscription(data);
      }
      setLoading(false);
    };

    loadSubscription();
  }, []);

  // 加入／解約トグル（Optimistic UI対応）
  const toggleSubscription = async () => {
    setMessage("");
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      setMessage("ログインしてください");
      return;
    }

    // Optimistic UI: 先に画面上の状態を変更
    if (!subscription) {
      setSubscription({ id: "", user_id: user.id, plan: "basic", is_active: true });
      setMessage("サブスク加入中...");
    } else {
      setSubscription({ ...subscription, is_active: !subscription.is_active });
      setMessage(subscription.is_active ? "解約中..." : "加入中...");
    }

    try {
      if (!subscription) {
        // 新規加入
        const { data, error } = await supabase
          .from("subscriptions")
          .insert({ user_id: user.id, plan: "basic", is_active: true })
          .select()
          .maybeSingle();

        if (error) throw error;
        setSubscription(data!);
        setMessage("サブスク加入完了");
      } else {
        // 解約／再加入トグル
        const { data, error } = await supabase
          .from("subscriptions")
          .update({ is_active: !subscription.is_active })
          .eq("id", subscription.id)
          .select()
          .maybeSingle();

        if (error) throw error;
        setSubscription(data!);
        setMessage(data!.is_active ? "サブスク加入完了" : "サブスク解約完了");
      }
    } catch (err: any) {
      // エラーが発生した場合は元に戻す
      setMessage("処理に失敗しました: " + err.message);
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      setSubscription(data || null);
    }
  };

  if (loading) return <p className="p-4 text-center">読み込み中…</p>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-xl shadow p-6 text-center">
        <h1 className="text-2xl font-bold mb-4">サブスク管理</h1>

        {!subscription || !subscription.is_active ? (
          <>
            <p className="mb-4">まだサブスクに加入していません。</p>
            <button
              onClick={toggleSubscription}
              className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition"
            >
              サブスクに加入する
            </button>
          </>
        ) : (
          <>
            <p className="mb-4">
              サブスクに加入中です（プラン: {subscription.plan}）。
            </p>
            <button
              onClick={toggleSubscription}
              className="w-full bg-red-600 text-white py-2 rounded hover:bg-red-700 transition"
            >
              解約する
            </button>
          </>
        )}

        {message && <p className="mt-4 text-sm text-gray-700">{message}</p>}
      </div>
    </div>
  );
}
// src/app/words/subscribe/page.tsx
