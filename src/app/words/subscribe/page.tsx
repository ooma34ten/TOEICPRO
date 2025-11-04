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
  const [inviteCode, setInviteCode] = useState(""); // 招待コード用

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
      body: JSON.stringify({ email: user.email, userId: user.id, inviteCode: inviteCode.trim() || null }),
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
    if (!confirm("本当にサブスクリプションを解約しますか？\n\n" +
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
      <section className="max-w-5xl mx-auto mb-16 text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">料金プラン</h2>
        <p className="text-gray-600 mb-10">目的に合わせてプランを選択できます</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* ====== Free Plan ====== */}
          <div className="bg-white rounded-3xl shadow-lg p-8 text-gray-700 hover:shadow-2xl transition transform hover:-translate-y-2">
            <h3 className="text-xl font-bold mb-4">無料プラン</h3>
            <p className="text-3xl font-bold mb-6">¥0 <span className="text-base text-gray-500">/月</span></p>
            <ul className="space-y-2">
              <li className="flex items-center gap-2">△ my単語帳：200単語まで</li>
              <li className="flex items-center gap-2">✔ 単語検索：利用可能</li>
              <li className="flex items-center gap-2">△ AIアシスタント：制限あり</li>
            </ul>
            {!isSubscribed && (
            <button disabled className="w-full mt-6 py-3 bg-gray-200 text-gray-500 rounded-xl font-medium cursor-not-allowed">
              現在利用中
            </button>
            )}
            {isSubscribed && (
              <button disabled className="w-full mt-6 py-3 bg-gray-200 text-gray-500 rounded-xl font-medium cursor-not-allowed">
              サブスクリプション加入中
            </button>
            )}
          </div>

          {/* ====== Standard Plan ====== */}
          <div className="bg-gradient-to-br from-blue-400 to-indigo-500 text-white rounded-3xl shadow-xl p-8 relative hover:shadow-2xl transform hover:-translate-y-2 transition">
            <div className="absolute top-0 right-0 bg-yellow-400 text-black px-3 py-1 rounded-bl-lg font-bold text-sm">
              人気
            </div>
            <h3 className="text-xl font-bold mb-4">スタンダードプラン</h3>
            <p className="text-3xl font-bold mb-6">¥200 <span className="text-base text-white/80">/月</span></p>

            <ul className="space-y-2 mb-4">
              <li className="flex items-center gap-2"><CheckCircle className="text-green-300" /> my単語帳：無制限</li>
              <li className="flex items-center gap-2"><CheckCircle className="text-green-300" /> 単語検索：利用可能</li>
              <li className="flex items-center gap-2"><CheckCircle className="text-green-300" /> AIアシスタント：無制限</li>
            </ul>

            {/* 招待コード入力欄 & 特典表示 */}
            {!isSubscribed && (
              <div className="mb-4">
                
                <label htmlFor="inviteCode" className="block text-left text-white mb-2 font-medium">
                  招待コード（任意）
                </label>
                <input
                  type="text"
                  id="inviteCode"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="招待コードを入力"
                  className="w-full px-3 py-2 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-yellow-300"
                />
              </div>
            )}

            {/* 加入済 or 未加入で表示切替 */}
            {isSubscribed ? (
              <div className="p-5 bg-green-50 text-green-800 rounded-xl mt-4">
                <div className="flex items-center text-lg font-medium mb-2">
                  <CheckCircle className="w-5 h-5 mr-2" />
                  現在サブスクリプション加入中です
                </div>
                {cancelAtPeriodEnd && currentPeriodEnd ? (
                  <p className="text-gray-700 mt-2">
                    🔔 解約済みです。現在のプランは{" "}
                    <strong className="text-gray-900">{currentPeriodEnd.toLocaleDateString()}</strong> まで有効です。
                  </p>
                ) : (
                  <div className="mt-4">
                    <p className="text-gray-700 mb-3">
                      ご契約中のプランを解約する場合は以下のボタンを押してください。
                    </p>
                    <button
                      className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white font-bold transition
                        ${loading ? "bg-red-400 cursor-not-allowed" : "bg-red-600 hover:bg-red-700 shadow-lg transform hover:scale-105"}`}
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
                className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold transition shadow-lg
                  ${loading ? "bg-blue-400 cursor-not-allowed" : "bg-white text-indigo-600 hover:scale-105"}`}
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
                    今すぐスタンダードにアップグレード
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
