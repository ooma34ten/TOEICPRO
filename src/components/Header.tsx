"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Menu, X, LogIn, LogOut, Settings } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";

export default function Header() {
  const [userId, setUserId] = useState<string | null>(null);
  const [predictedScore, setPredictedScore] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const getUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);

      if (user?.id) {
        try {
          const res = await fetch("/api/get-latest-result", {
            headers: { "x-user-id": user.id },
          });
          const json = await res.json();
          if (json.result?.predicted_score) {
            setPredictedScore(json.result.predicted_score);
          }

          // Realtime Subscription
          const channel = supabase
            .channel('header-score-update')
            .on(
              'postgres_changes',
              {
                event: 'INSERT',
                schema: 'public',
                table: 'test_results',
                filter: `user_id=eq.${user.id}`,
              },
              (payload: any) => {
                if (payload.new && typeof payload.new.predicted_score === 'number') {
                  setPredictedScore(payload.new.predicted_score);
                }
              }
            )
            .subscribe();

          return () => {
            supabase.removeChannel(channel);
          };

        } catch (e) {
          console.error("Failed to fetch score:", e);
        }
      }
    };
    getUserData();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      // Authが変わったときはリロードなどが必要だが、簡易的にIDセット
      if (session?.user?.id !== userId) {
        setUserId(session?.user?.id ?? null);
        if (!session?.user) setPredictedScore(null);
        else getUserData(); // Re-fetch for new user
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  type NavLink = { href: string; label: string; disabled?: boolean };

  const mainLinks: NavLink[] = [
    { href: "/", label: "ダッシュボード", disabled: false },
    { href: "/words/list", label: "My単語帳", disabled: false },
    { href: "/words/register", label: "単語登録", disabled: false },
    { href: "/words/review", label: "復習モード", disabled: false },
    { href: "/words/progress", label: "学習進捗", disabled: false },
    { href: "/words/toeic_ai", label: "AIアシスタント", disabled: true },
    { href: "/words/ai_teacher", label: "AI問題演習", disabled: true },
    { href: "/words/questions", label: "問題バンク", disabled: true },
    { href: "/words/subscribe", label: "サブスクリプション", disabled: true },
  ];

  const settingLinks: NavLink[] = [
    { href: "/words/contact", label: "お問い合わせ" },
    { href: "/words/setting", label: "設定" },
    { href: "/legal/privacy", label: "プライバシー" },
    { href: "/legal/terms", label: "利用規約" },
    //{ href: "/legal/tokutei", label: "特定商取引法" },
  ];

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, link: { label: string; disabled?: boolean }, closeMenu?: () => void) => {
    if (link.disabled) {
      e.preventDefault();
      toast(`「${link.label}」は現在開発中です！\nリリースまで楽しみにお待ちください🚀`, {
        icon: '🛠️',
        style: {
          borderRadius: '10px',
          background: '#333',
          color: '#fff',
        },
      });
      return;
    }
    if (closeMenu) {
      closeMenu();
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md shadow-sm border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* ロゴ */}
        <Link href="/" className="flex flex-col items-center leading-tight select-none group">
          <span className="text-blue-600 font-extrabold text-xl tracking-tighter group-hover:text-blue-700 transition">TOEIC<span className="text-gray-900">PRO</span></span>
          <span className="text-gray-500 font-medium text-[10px] tracking-widest -mt-0.5">AI LEARNING</span>
        </Link>

        {/* スコア表示 (PC) */}
        {predictedScore && (
          <div
            onClick={(e) => {
              e.preventDefault();
              toast(`「予想スコア」は現在開発中です！\nリリースまで楽しみにお待ちください🚀`, {
                icon: '🛠️',
                style: { borderRadius: '10px', background: '#333', color: '#fff' }
              });
            }}
            className="hidden md:flex items-center gap-2 bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-100 ml-6 grayscale opacity-60 cursor-not-allowed"
          >
            <span className="text-xs font-bold text-indigo-400">PREDICTED SCORE</span>
            <span className="text-lg font-extrabold text-indigo-700">{predictedScore}</span>
          </div>
        )}

        {/* PCメニュー */}
        <nav className="hidden md:flex gap-1 text-sm font-medium items-center ml-auto">
          {mainLinks.slice(0, 5).map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={(e) => handleLinkClick(e, link)}
              className={`transition px-3 py-2 rounded-lg whitespace-nowrap ${link.disabled ? 'opacity-50 cursor-not-allowed text-gray-400' : ''} ${!link.disabled && pathname === link.href
                ? "text-blue-600 bg-blue-50 font-semibold"
                : !link.disabled ? "text-gray-600 hover:text-blue-600 hover:bg-gray-50" : ""
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
                      onClick={(e) => handleLinkClick(e, link, () => setSettingsOpen(false))}
                      className={`block px-4 py-2 text-sm ${link.disabled ? 'opacity-50 cursor-not-allowed hover:bg-transparent text-gray-400' : 'hover:bg-gray-50 text-gray-700'} ${!link.disabled && pathname === link.href
                        ? "text-blue-600 font-semibold bg-blue-50"
                        : ""
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
                onClick={(e) => handleLinkClick(e, link, () => setMenuOpen(false))}
                className={`block px-5 py-3 text-sm transition ${link.disabled ? 'opacity-50 cursor-not-allowed text-gray-400' : 'text-gray-700 hover:bg-gray-50'} ${!link.disabled && pathname === link.href
                  ? "text-blue-600 bg-blue-50 font-semibold"
                  : ""
                  }`}
              >
                {link.label}
              </Link>
            ))}

            <div className="px-5 py-3 border-t bg-gray-50">
              {userId ? (
                <div className="flex flex-col gap-3">
                  {predictedScore && (
                    <div
                      onClick={(e) => {
                        e.preventDefault();
                        toast(`「予想スコア」は現在開発中です！\nリリースまで楽しみにお待ちください🚀`, {
                          icon: '🛠️',
                          style: { borderRadius: '10px', background: '#333', color: '#fff' }
                        });
                      }}
                      className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200 grayscale opacity-60 cursor-not-allowed"
                    >
                      <span className="text-xs font-bold text-gray-500">予想スコア</span>
                      <span className="text-lg font-bold text-indigo-600">{predictedScore}点</span>
                    </div>
                  )}
                  <Link
                    href="/auth/logout"
                    className="flex items-center gap-2 text-sm text-red-600 hover:bg-red-50 p-2 rounded-lg transition"
                  >
                    <LogOut size={18} />
                    ログアウト
                  </Link>
                </div>
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
