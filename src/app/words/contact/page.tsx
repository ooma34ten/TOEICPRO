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
        if (localStorage.getItem("guestMode") !== "true") {
          router.replace("/auth/login");
        }
      } else {
        setUserId(data.session.user.id);
        
        // Fetch nickname and auto-fill
        const { data: stats } = await supabase
          .from("user_stats")
          .select("nickname")
          .eq("user_id", data.session.user.id)
          .maybeSingle();
        
        if (stats?.nickname) {
          setFormData((prev) => ({ ...prev, name: stats.nickname }));
        }
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
        setFormData(prev => ({ ...prev, email: "", message: "" }));
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
      <div className="flex items-center justify-center min-h-[50vh] text-red-500 text-lg">
        ログインしてください
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-xl mx-auto p-6 md:p-8 mt-10 bg-[var(--card)] shadow-lg rounded-2xl border border-[var(--border)]"
    >
      <h1 className="text-2xl font-bold mb-6 text-center text-[var(--foreground)]">
        お問い合わせ
      </h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* 名前 */}
        <div>
          <label className="block mb-1.5 font-semibold text-[13px] text-[var(--muted-foreground)]">ニックネーム</label>
          <div className="flex items-center border border-[var(--border)] bg-[var(--secondary)] rounded-lg px-3 py-2.5">
            <User className="w-5 h-5 text-[var(--muted-foreground)] mr-2" />
            <div className="w-full text-[var(--foreground)] text-sm select-none">
              {formData.name || "（未設定）"}
            </div>
          </div>
        </div>

        {/* メール */}
        <div>
          <label className="block mb-1.5 font-semibold text-[13px] text-[var(--muted-foreground)]">
            メールアドレス（返信が必要な場合のみ）
          </label>
          <div className="flex items-center border border-[var(--border)] bg-[var(--secondary)] rounded-lg px-3 py-2.5 focus-within:ring-2 focus-within:ring-[var(--accent)]/40 transition">
            <Mail className="w-5 h-5 text-[var(--muted-foreground)] mr-2" />
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="任意"
              className="w-full outline-none bg-transparent text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] text-sm"
            />
          </div>
        </div>

        {/* メッセージ */}
        <div>
          <label className="block mb-1.5 font-semibold text-[13px] text-[var(--muted-foreground)]">メッセージ</label>
          <div className="flex items-start border border-[var(--border)] bg-[var(--secondary)] rounded-lg px-3 py-2.5 focus-within:ring-2 focus-within:ring-[var(--accent)]/40 transition">
            <MessageSquare className="w-5 h-5 text-[var(--muted-foreground)] mt-1 mr-2" />
            <textarea
              name="message"
              value={formData.message}
              onChange={handleChange}
              required
              rows={5}
              className="w-full outline-none resize-none bg-transparent text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] text-sm"
              placeholder="ご意見・ご要望などご自由にお書きください。"
            />
          </div>
        </div>

        {/* 送信ボタン */}
        <button
          type="submit"
          disabled={loading}
          className={`w-full flex justify-center items-center gap-2 py-2.5 rounded-lg text-[var(--primary-foreground)] font-semibold text-sm transition-all ${
            loading
              ? "bg-[var(--primary)]/50 cursor-not-allowed"
              : "bg-[var(--primary)] hover:opacity-90"
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
          className={`mt-6 text-center text-sm font-medium ${
            status.startsWith("✅")
              ? "text-emerald-500"
              : status.startsWith("⚠️") || status.startsWith("❌")
              ? "text-red-500"
              : "text-[var(--foreground)]"
          }`}
        >
          {status}
        </motion.p>
      )}
    </motion.div>
  );
}
