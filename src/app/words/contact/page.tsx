"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { Loader2, Mail, User, MessageSquare } from "lucide-react";
import { motion } from "framer-motion";

export default function ContactPage() {
  const [formData, setFormData] = useState({ name: "", email: "", message: "" });
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
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

    setLoading(true);
    setStatus("送信中...");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, userId }),
      });

      if (res.ok) {
        setStatus("✅ 送信完了しました。ありがとうございます！");
        setFormData({ name: "", email: "", message: "" });
      } else {
        const data = await res.json();
        setStatus("❌ 送信失敗: " + (data.error || "不明なエラー"));
      }
    } catch {
      setStatus("⚠️ 通信エラーが発生しました。");
    } finally {
      setLoading(false);
    }
  };

  if (!userId) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-red-600 text-lg">
        ログインしてください
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-xl mx-auto p-6 mt-10 bg-white shadow-xl rounded-2xl border border-gray-100"
    >
      <h1 className="text-3xl font-bold mb-6 text-center text-blue-700">
        お問い合わせ
      </h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* 名前 */}
        <div>
          <label className="block mb-1 font-semibold text-gray-700">名前（ニックネーム可）</label>
          <div className="flex items-center border rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500">
            <User className="w-5 h-5 text-gray-500 mr-2" />
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full outline-none"
              placeholder="例：Tanaka"
            />
          </div>
        </div>

        {/* メール */}
        <div>
          <label className="block mb-1 font-semibold text-gray-700">
            メールアドレス（返信が必要な場合のみ）
          </label>
          <div className="flex items-center border rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500">
            <Mail className="w-5 h-5 text-gray-500 mr-2" />
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="任意"
              className="w-full outline-none"
            />
          </div>
        </div>

        {/* メッセージ */}
        <div>
          <label className="block mb-1 font-semibold text-gray-700">メッセージ</label>
          <div className="flex items-start border rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500">
            <MessageSquare className="w-5 h-5 text-gray-500 mt-1 mr-2" />
            <textarea
              name="message"
              value={formData.message}
              onChange={handleChange}
              required
              rows={5}
              className="w-full outline-none resize-none"
              placeholder="ご意見・ご要望などご自由にお書きください。"
            />
          </div>
        </div>

        {/* 送信ボタン */}
        <button
          type="submit"
          disabled={loading}
          className={`w-full flex justify-center items-center gap-2 py-2 rounded-lg text-white font-semibold transition-all ${
            loading
              ? "bg-blue-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              送信中...
            </>
          ) : (
            "送信する"
          )}
        </button>
      </form>

      {status && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`mt-5 text-center ${
            status.startsWith("✅")
              ? "text-green-600"
              : status.startsWith("⚠️") || status.startsWith("❌")
              ? "text-red-600"
              : "text-gray-600"
          }`}
        >
          {status}
        </motion.p>
      )}
    </motion.div>
  );
}
