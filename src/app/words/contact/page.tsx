"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function ContactPage() {
  const [formData, setFormData] = useState({ name: "", email: "", message: "" });
  const [status, setStatus] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/auth/login");
      } else {
        setUserId(data.session.user.id);
      }
    })();
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) {
      setStatus("ログインしてください");
      return;
    }
    setStatus("送信中...");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, userId }),
      });

      if (res.ok) {
        setStatus("送信完了しました。ありがとうございます！");
        setFormData({ name: "", email: "", message: "" });
      } else {
        const data = await res.json();
        setStatus("送信失敗: " + (data.error || "不明なエラー"));
      }
    } catch {
      setStatus("通信エラーが発生しました。");
    }
  };

  if (!userId) {
    return <p className="text-red-600 text-center mt-6">ログインしてください</p>;
  }

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">お問い合わせ</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block mb-1">名前（ニックネーム可）</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            className="w-full border rounded p-2"
          />
        </div>
        <div>
          <label className="block mb-1">メールアドレス（返信が必要な場合のみ）</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="任意"
            className="w-full border rounded p-2"
          />
        </div>
        <div>
          <label className="block mb-1">メッセージ</label>
          <textarea
            name="message"
            value={formData.message}
            onChange={handleChange}
            required
            rows={5}
            className="w-full border rounded p-2"
          />
        </div>
        <button
          type="submit"
          className="bg-blue-600 text-white rounded px-4 py-2"
        >
          送信
        </button>
      </form>
      {status && <p className="mt-4">{status}</p>}
    </div>
  );
}
// src/app/words/contact/page.tsx
