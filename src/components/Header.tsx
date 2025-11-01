"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Menu, X, LogIn, LogOut, Settings } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Header() {
  const [userId, setUserId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
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

  const mainLinks = [
    { href: "/words/list", label: "My単語帳" },
    { href: "/words/register", label: "単語登録" },
    { href: "/words/review", label: "復習モード" },
    { href: "/words/progress", label: "学習進捗" },
    { href: "/words/toeic_ai", label: "AIアシスタント" },
    { href: "/words/contact", label: "お問い合わせ" },
    { href: "/words/subscribe", label: "サブスクリプション" },
  ];

  const settingLinks = [
    { href: "/words/setting", label: "設定" },
    { href: "/legal/privacy", label: "プライバシー" },
    { href: "/legal/terms", label: "利用規約" },
    { href: "/legal/tokutei", label: "特定商取引法" },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white/70 backdrop-blur-md shadow-sm border-b">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* ロゴ */}
        <Link href="/" className="flex flex-col items-center leading-tight select-none">
          <span className="text-blue-600 font-extrabold text-lg tracking-tight">TOEIC</span>
          <span className="text-gray-700 font-semibold text-sm -mt-0.5">単語学習</span>
        </Link>

        {/* PCメニュー */}
        <nav className="hidden md:flex gap-5 text-sm font-medium items-center">
          {mainLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`transition px-2 py-1 rounded-md whitespace-nowrap ${
                pathname === link.href
                  ? "text-blue-600 bg-blue-50 font-semibold"
                  : "text-gray-700 hover:text-blue-600 hover:bg-blue-50"
              }`}
            >
              {link.label}
            </Link>
          ))}

          {/* 設定メニュー（ドロップダウン） */}
          <div className="relative">
            <button
              onClick={() => setSettingsOpen(!settingsOpen)}
              className="flex items-center gap-1 text-gray-700 hover:text-blue-600 transition"
            >
              <Settings size={18} />
              <span className="text-sm">その他</span>
            </button>
            <AnimatePresence>
              {settingsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 w-44 bg-white border rounded-lg shadow-md overflow-hidden"
                >
                  {settingLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setSettingsOpen(false)}
                      className={`block px-4 py-2 text-sm hover:bg-gray-50 ${
                        pathname === link.href
                          ? "text-blue-600 font-semibold bg-blue-50"
                          : "text-gray-700"
                      }`}
                    >
                      {link.label}
                    </Link>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </nav>

        {/* ログイン / ログアウト */}
        <div className="hidden md:flex items-center gap-2 ml-4">
          {userId ? (
            <Link
              href="/auth/logout"
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-red-500 transition"
            >
              <LogOut size={16} />
              ログアウト
            </Link>
          ) : (
            <Link
              href="/auth/login"
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600 transition"
            >
              <LogIn size={16} />
              ログイン
            </Link>
          )}
        </div>

        {/* モバイルメニュー ボタン */}
        <button
          className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* モバイルメニュー */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="md:hidden bg-white border-t shadow-inner"
          >
            {[...mainLinks, ...settingLinks].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`block px-5 py-3 text-sm transition ${
                  pathname === link.href
                    ? "text-blue-600 bg-blue-50 font-semibold"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                {link.label}
              </Link>
            ))}

            <div className="px-5 py-3 border-t flex items-center gap-2">
              {userId ? (
                <Link
                  href="/auth/logout"
                  className="flex items-center gap-1 text-sm text-gray-500 hover:text-red-500"
                >
                  <LogOut size={16} />
                  ログアウト
                </Link>
              ) : (
                <Link
                  href="/auth/login"
                  className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600"
                >
                  <LogIn size={16} />
                  ログイン
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
