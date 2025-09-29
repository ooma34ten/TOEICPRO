"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { User } from "@supabase/supabase-js";
import initStripe from "stripe";

const getAllPlans = async () => {
  const stripe = new initStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY!);

  const { data: plans} = await stripe.prices.list();
  return plans;
};

export default function SubscribePage() {
  const plans = getAllPlans();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchWords = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    //console.log("ユーザーデータ=", user);
    setUser(user); // state に保存
  }, []);



  async function createCustomer() {
    setLoading(true);

    if (!user) {
      alert("ユーザー情報が取得できませんでした。");
      setLoading(false);
      return;
    }
    const res = await fetch("/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: user.email, userId: user.id }), 
    });
    const data = await res.json();
    console.log("データ",data);
    setLoading(false);

    if (data.url) {
      window.location.href = data.url;
    } else {
      alert(data.error || "エラーが発生しました");
    }
  }

  const handleSubscribe = async (plan: "basic" | "premium") => {
    setLoading(true);
    const res = await fetch("/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    const data = await res.json();
    setLoading(false);

    if (data.url) {
      window.location.href = data.url;
    } else {
      alert(data.error || "エラーが発生しました");
    }
  };

  useEffect(() => {
      fetchWords();
  }, [fetchWords]);
  

  return (
    <div className="p-4">
      <pre>{JSON.stringify(plans, null, 2)}</pre>
      <button
        className="bg-blue-500 text-white px-4 py-2 rounded mr-2"
        onClick={() => handleSubscribe("basic")}
        disabled={loading}
      >
        Basic プラン
      </button>
      <button
        className="bg-green-500 text-white px-4 py-2 rounded"
        onClick={createCustomer} // ← 修正済み
        disabled={loading}
      >
        Premium プラン（顧客作成テスト）
      </button>
    </div>
  );
}
