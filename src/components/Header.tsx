"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Menu, X } from "lucide-react";

export default function Header() {
  const [userId, setUserId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
    };
    getUser();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const links = [
    { href: "/words/list", label: "My単語帳" },
    { href: "/words/register", label: "単語登録" },
    { href: "/words/review", label: "復習モード" },
    { href: "/words/progress", label: "学習進捗" },
    { href: "/words/contact", label: "お問い合わせ" },
    { href: "/words/subscribe", label: "サブスクリプション" },
    { href: "/words/setting", label: "設定" },
    { href: "/words/privacy", label: "プライバシー" },
    { href: "/words/terms", label: "利用規約" },
    { href: "/words/tokutei", label: "特定商取引法" },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur border-b">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="font-bold text-blue-600 text-lg">
          TOEIC 単語学習アプリ
        </Link>

        {/* PCメニュー */}
        <nav className="hidden md:flex gap-4 text-sm">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`transition ${
                pathname === link.href
                  ? "text-blue-600 font-semibold border-b-2 border-blue-600 pb-0.5"
                  : "text-gray-700 hover:text-blue-500"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* ログイン / ログアウト */}
        <div className="hidden md:block ml-4">
          {userId ? (
            <Link href="/auth/logout" className="text-sm text-gray-500 hover:text-red-500 transition">
              ログアウト
            </Link>
          ) : (
            <Link href="/auth/login" className="text-sm text-gray-500 hover:text-blue-500 transition">
              ログイン
            </Link>
          )}
        </div>

        {/* モバイルメニュー */}
        <button
          className="md:hidden p-2 rounded hover:bg-gray-100"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* ドロワーメニュー（モバイル） */}
      {menuOpen && (
        <div className="md:hidden bg-white border-t">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className={`block px-4 py-2 border-b hover:bg-blue-50 ${
                pathname === link.href ? "text-blue-600 font-medium" : "text-gray-700"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <div className="px-4 py-2">
            {userId ? (
              <Link href="/auth/logout" className="text-sm text-gray-500 hover:text-red-500">
                ログアウト
              </Link>
            ) : (
              <Link href="/auth/login" className="text-sm text-gray-500 hover:text-blue-500">
                ログイン
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
