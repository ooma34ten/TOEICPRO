"use client";

import { use, useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";


export default function SubscribePage() {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchWords = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    console.log("ユーザーデータ=", user);
    setUser(user); // state に保存
  }, []);



  async function createCustomer() {
    console.log("ユーザーデータ2=", user);
    setLoading(true);
    console.log("ユーザーデータ2=", user);
    const res = await fetch("/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: user.email,userId: user.id }), 
    });
    const data = await res.json();
    console.log("データ",data);
    setLoading(false);
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
