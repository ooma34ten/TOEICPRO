"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { User } from "@supabase/supabase-js";
import { Loader2, CheckCircle, XCircle, CreditCard } from "lucide-react";

export default function SubscribePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState<boolean | null>(null);
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<Date | null>(null);

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
      alert(data.error || "エラーが発生しました。");
    }
  }

  async function cancelSubscription() {
    if (!user) {
      alert("ログインが必要です。");
      return;
    }
    if (!confirm("本当にサブスクリプションリプションを解約しますか？\n\n" +
    "※解約日になると、my単語帳の登録件数が200件を超えている場合、" +
    "古い単語から自動的に削除されます。")) return;

    setLoading(true);
    
    const res = await fetch("/api/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id }),
    });
    const data = await res.json();
    setLoading(false);

    if (data.success) {
      alert("サブスクリプションを解約しました。");
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
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      {/* ====== 料金プラン ====== */}
      <section className="max-w-5xl mx-auto mb-16 text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">料金プラン</h2>
        <p className="text-gray-600 mb-10">目的に合わせてプランを選択できます</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Free Plan */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-md transition p-8">
            <h3 className="text-xl font-bold text-gray-800 mb-2">無料プラン</h3>
            <p className="text-3xl font-bold text-gray-900 mb-6">¥0<span className="text-base text-gray-500"> /月</span></p>
            <ul className="text-gray-700 space-y-3 text-left mb-6">
              <li>・my単語帳：200単語まで</li>
              <li>・単語,例文検索：利用可能</li>
              <li>・AIアシスタント機能：なし</li>
            </ul>
            {isSubscribed ? (
            <button
              disabled
              className="w-full bg-gray-200 text-gray-500 py-3 rounded-lg font-medium cursor-not-allowed"
            >
              スタンダードプラン加入中
            </button>
          ) : (
            <button
              disabled
              className="w-full bg-gray-200 text-gray-500 py-3 rounded-lg font-medium cursor-not-allowed"
            >
              現在利用中
            </button>
          )}
          </div>

          {/* Standard Plan */}
          <div className="bg-gradient-to-b from-blue-50 to-white border-2 border-blue-400 rounded-2xl shadow-md hover:shadow-lg transition p-8 relative">
            <div className="absolute top-0 right-0 bg-blue-500 text-white text-xs font-semibold px-3 py-1 rounded-bl-lg">
              おすすめ
            </div>
            <h3 className="text-xl font-bold text-blue-600 mb-2">スタンダードプラン</h3>
            <p className="text-3xl font-bold text-blue-700 mb-6">¥200<span className="text-base text-gray-500"> /月</span></p>
            <ul className="text-gray-700 space-y-3 text-left mb-6">
              <li>・my単語帳：制限なし</li>
              <li>・単語,例文検索：利用可能</li>
              <li>・AIアシスタント機能：利用可能</li>
            </ul>
            {isSubscribed ? (
            <div className="p-5 bg-green-50 border border-green-200 rounded-xl">
              <div className="flex items-center text-green-700 font-medium text-lg mb-2">
                <CheckCircle className="w-5 h-5 mr-2" />
                現在サブスクリプション加入中です
              </div>

              {cancelAtPeriodEnd && currentPeriodEnd ? (
                <p className="text-gray-700 mt-2">
                  🔔 解約済みです。現在のプランは{" "}
                  <strong className="text-gray-900">
                    {currentPeriodEnd.toLocaleDateString()}
                  </strong>{" "}
                  まで有効です。
                </p>
              ) : (
                <div className="mt-4">
                  <p className="text-gray-700 mb-3">
                    ご契約中のプランを解約する場合は以下のボタンを押してください。
                  </p>
                  <button
                    className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-white font-medium transition
                      ${loading
                        ? "bg-red-400 cursor-not-allowed"
                        : "bg-red-600 hover:bg-red-700"}
                    `}
                    onClick={cancelSubscription}
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        解約処理中…
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4" />
                        サブスクリプションを解約する
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          ) : (
              <button
                className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-white font-medium transition
                  ${loading
                    ? "bg-blue-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700"}
                `}
                onClick={createCustomer}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    処理中...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    スタンダードプランに加入する
                  </>
                )}
              </button>
          )}
          </div>
        </div>
      </section>

      
    </div>
  );
}
