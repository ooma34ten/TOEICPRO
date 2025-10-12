"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { User } from "@supabase/supabase-js";

export default function SubscribePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState<boolean | null>(null);
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<Date | null>(null);

  // ユーザーとサブスク状態を取得
  const fetchUserAndSubscription = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);

    if (user) {
      const { data: subs, error } = await supabase
        .from("subscriptions")
        .select("is_active, plan, cancel_at_period_end, current_period_end")
        .eq("user_id", user.id)
        .single();

      if (!error && subs?.is_active) {
        setIsSubscribed(true);
      } else {
        setIsSubscribed(false);
      }

      setCancelAtPeriodEnd(subs?.cancel_at_period_end || null);
      setCurrentPeriodEnd(subs?.current_period_end ? new Date(subs.current_period_end) : null);
    }
  }, []);

  // 顧客作成 → Stripe Checkout
  async function createCustomer() {
    if (!user) {
      alert("ログインが必要です。");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: user.email, userId: user.id }),
    });
    const data = await res.json();
    setLoading(false);

    if (data.url) {
      window.location.href = data.url;
    } else {
      alert(data.error || "エラーが発生しました");
    }
  }

  async function cancelSubscription() {
  if (!user) {
    alert("ログインが必要です。");
    return;
  }
  if (!confirm("本当にサブスクリプションを解約しますか？")) return;

  setLoading(true);
  const res = await fetch("/api/cancel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: user.id }),
  });
  const data = await res.json();
  setLoading(false);

  if (data.success) {
    alert("サブスクを解約しました。");
    setIsSubscribed(false);
    await fetchUserAndSubscription();
  } else {
    alert(data.error || "解約に失敗しました。");
  }
}


  useEffect(() => {
    fetchUserAndSubscription();
  }, [fetchUserAndSubscription]);

  return (
    <div className="p-4">
      {isSubscribed ? (
        <div className="bg-green-100 text-green-800 p-4 rounded">
          <p>✅ あなたは現在サブスク加入中です。</p>

          

          {/* 解約予約がある場合だけ表示 */}
          {cancelAtPeriodEnd && currentPeriodEnd ? (
            <p className="mt-2 text-base text-gray-600">
              【解約済みです】　現在のサブスクは{" "}
              <strong>{currentPeriodEnd.toLocaleDateString()}</strong> まで有効です。
            </p>
          ) : (
            <button
              className="bg-red-500 text-white px-4 py-2 rounded mt-2"
              onClick={cancelSubscription}
              disabled={loading}
            >
              サブスクを解約する
            </button>
          )}
        </div>
      ) : (
        <div>
          <button
            className="bg-blue-500 text-white px-4 py-2 rounded mr-2"
            onClick={createCustomer}
            disabled={loading}
          >
            スタンダードプランに加入する
          </button>
        </div>
      )}
    </div>

  );
}
// src/app/words/register/page.tsx
