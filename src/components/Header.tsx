"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Menu, X, LogIn, LogOut, Settings, AlertTriangle, Volume2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";

export default function Header() {
  const [userId, setUserId] = useState<string | null>(null);
  const [predictedScore, setPredictedScore] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [volumeOpen, setVolumeOpen] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isGuest, setIsGuest] = useState(false);
  const pathname = usePathname();

  // ゲストモード検出
  useEffect(() => {
    const checkGuest = () => {
      setIsGuest(localStorage.getItem("guestMode") === "true");
    };
    checkGuest();
    window.addEventListener("storage", checkGuest);

    import("@/lib/speech").then(m => setVolume(m.getGlobalVolume()));

    return () => window.removeEventListener("storage", checkGuest);
  }, []);

  useEffect(() => {
    let currentChannel: any = null;

    const getUserData = async () => {
      let user = null;
      try {
        const { data } = await supabase.auth.getUser();
        user = data.user;
      } catch (e) {
        console.warn("Failed to get user session:", e);
      }
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

          if (currentChannel) {
            supabase.removeChannel(currentChannel);
          }

          currentChannel = supabase
            .channel(`header-score-update-${user.id}-${Math.random()}`)
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

        } catch (e) {
          console.error("Failed to fetch score:", e);
        }
      }
    };
    getUserData();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.id !== userId) {
        setUserId(session?.user?.id ?? null);
        if (!session?.user) {
          setPredictedScore(null);
          if (currentChannel) {
            supabase.removeChannel(currentChannel);
            currentChannel = null;
          }
        }
        else getUserData();
      }
    });

    return () => {
      if (currentChannel) {
        supabase.removeChannel(currentChannel);
      }
      listener.subscription.unsubscribe();
    };
  }, []);

  type NavLink = { href: string; label: string; disabled?: boolean };

  const mainLinks: NavLink[] = [
    { href: "/", label: "ダッシュボード", disabled: false },
    { href: "/words/list", label: "My単語帳", disabled: false },
    { href: "/words/register", label: "単語登録", disabled: false },
    { href: "/words/review", label: "単語復習モード", disabled: false },
    { href: "/words/ai_teacher", label: "Part5強化モード", disabled: false },
    { href: "/words/progress", label: "学習進捗", disabled: false },
    { href: "/words/toeic_ai", label: "AIアシスタント", disabled: true },
    { href: "/words/questions", label: "問題バンク", disabled: true },
    { href: "/words/subscribe", label: "サブスクリプション", disabled: true },
  ];

  const settingLinks: NavLink[] = [
    { href: "/words/contact", label: "お問い合わせ" },
    { href: "/words/setting", label: "設定" },
    { href: "/legal/privacy", label: "プライバシー" },
    { href: "/legal/terms", label: "利用規約" },
  ];

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, link: { label: string; disabled?: boolean }, closeMenu?: () => void) => {
    if (link.disabled) {
      e.preventDefault();
      toast(`「${link.label}」は現在開発中です！\nリリースまで楽しみにお待ちください🚀`, {
        icon: '🛠️',
        style: {
          borderRadius: '8px',
          background: 'var(--card)',
          color: 'var(--foreground)',
          border: '1px solid var(--border)',
        },
      });
      return;
    }
    if (closeMenu) {
      closeMenu();
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-[var(--background)]/95 backdrop-blur-sm border-b border-[var(--border)]">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* ロゴ */}
        <Link href="/" className="flex items-center gap-0.5 select-none group">
          <span className="font-black text-lg tracking-tight text-[var(--foreground)] group-hover:opacity-80 transition-opacity">
            TOEIC
          </span>
          <span className="font-black text-lg tracking-tight text-[var(--accent)]">
            PRO
          </span>
        </Link>

        {/* ゲストモードバッジ (PC) */}
        {isGuest && (
          <div className="hidden md:flex items-center gap-1.5 bg-amber-500/10 px-2.5 py-1 rounded-md border border-amber-500/20 ml-4">
            <AlertTriangle className="w-3 h-3 text-amber-500" />
            <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">ゲスト</span>
          </div>
        )}

        {/* スコア表示 (PC) */}
        {!isGuest && predictedScore && (
          <div
            onClick={(e) => {
              e.preventDefault();
              toast(`「予想スコア」は現在開発中です！\nリリースまで楽しみにお待ちください🚀`, {
                icon: '🛠️',
                style: { borderRadius: '8px', background: 'var(--card)', color: 'var(--foreground)', border: '1px solid var(--border)' }
              });
            }}
            className="hidden md:flex items-center gap-2 px-3 py-1 rounded-md border border-[var(--border)] ml-4 opacity-50 cursor-not-allowed"
          >
            <span className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-wider">Score</span>
            <span className="text-sm font-black text-[var(--foreground)]">{predictedScore}</span>
          </div>
        )}

        {/* PCメニュー */}
        <nav className="hidden md:flex gap-0.5 text-[13px] font-medium items-center ml-auto">
          {mainLinks.slice(0, 5).map((link) => {
            const isActive = !link.disabled && pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={(e) => handleLinkClick(e, link)}
                className={`relative px-3 py-1.5 rounded-md transition-colors whitespace-nowrap ${
                  link.disabled
                    ? 'opacity-40 cursor-not-allowed text-[var(--muted-foreground)]'
                    : isActive
                    ? "text-[var(--accent)] font-semibold"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--secondary)]"
                }`}
              >
                {link.label}
                {isActive && (
                  <motion.div
                    layoutId="headerNav"
                    className="absolute bottom-0 left-3 right-3 h-[2px] bg-[var(--accent)] rounded-full"
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
              </Link>
            );
          })}

          {/* 音量設定 */}
          <div className="relative ml-2 mr-1">
            <button
              onClick={() => {
                setVolumeOpen(!volumeOpen);
                setSettingsOpen(false);
              }}
              className="flex items-center gap-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors p-1.5 rounded-md hover:bg-[var(--secondary)]"
            >
              <Volume2 size={15} />
            </button>
            <AnimatePresence>
              {volumeOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.95 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 mt-1.5 bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-lg overflow-hidden py-2 px-4 w-48 z-50 flex items-center gap-3"
                >
                  <Volume2 size={14} className="text-[var(--muted-foreground)] shrink-0" />
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={volume}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setVolume(v);
                      import("@/lib/speech").then(m => m.setGlobalVolume(v));
                    }}
                    className="w-full h-1.5 bg-[var(--secondary)] rounded-lg appearance-none cursor-pointer accent-[var(--accent)]"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 設定メニュー */}
          <div className="relative">
            <button
              onClick={() => {
                setSettingsOpen(!settingsOpen);
                setVolumeOpen(false);
              }}
              className="flex items-center gap-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors p-1.5 rounded-md hover:bg-[var(--secondary)]"
            >
              <Settings size={15} />
            </button>
            <AnimatePresence>
              {settingsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.95 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 mt-1.5 w-40 bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-lg overflow-hidden py-1 z-50"
                >
                  {settingLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={(e) => handleLinkClick(e, link, () => setSettingsOpen(false))}
                      className={`block px-3 py-2 text-[13px] transition-colors ${
                        link.disabled
                          ? 'opacity-40 cursor-not-allowed text-[var(--muted-foreground)]'
                          : pathname === link.href
                          ? "text-[var(--accent)] font-semibold bg-[var(--secondary)]"
                          : "text-[var(--foreground)] hover:bg-[var(--secondary)]"
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
        <div className="hidden md:flex items-center gap-2 ml-3">
          {userId && !isGuest ? (
            <Link
              href="/auth/logout"
              className="flex items-center gap-1 text-[12px] text-[var(--muted-foreground)] hover:text-[var(--destructive)] transition-colors"
            >
              <LogOut size={14} />
              ログアウト
            </Link>
          ) : (
            <Link
              href="/auth/login"
              onClick={() => localStorage.removeItem("guestMode")}
              className="flex items-center gap-1 text-[12px] font-semibold text-[var(--accent)] hover:opacity-80 transition-opacity"
            >
              <LogIn size={14} />
              ログイン
            </Link>
          )}
        </div>

        {/* モバイルメニュー ボタン */}
        <button
          className="md:hidden p-1.5 rounded-md hover:bg-[var(--secondary)] transition-colors text-[var(--foreground)]"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* モバイルメニュー */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden bg-[var(--background)] border-t border-[var(--border)] overflow-hidden"
          >
            <div className="py-2">
              {[...mainLinks, ...settingLinks].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={(e) => handleLinkClick(e, link, () => setMenuOpen(false))}
                  className={`block px-5 py-2.5 text-[13px] transition-colors ${
                    link.disabled
                      ? 'opacity-40 cursor-not-allowed text-[var(--muted-foreground)]'
                      : pathname === link.href
                      ? "text-[var(--accent)] font-semibold bg-[var(--secondary)]"
                      : "text-[var(--foreground)] hover:bg-[var(--secondary)]"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            <div className="px-5 py-3 border-t border-[var(--border)]">
              {userId ? (
                <div className="flex flex-col gap-2">
                  {predictedScore && (
                    <div
                      onClick={(e) => {
                        e.preventDefault();
                        toast(`「予想スコア」は現在開発中です！\nリリースまで楽しみにお待ちください🚀`, {
                          icon: '🛠️',
                          style: { borderRadius: '8px', background: 'var(--card)', color: 'var(--foreground)', border: '1px solid var(--border)' }
                        });
                      }}
                      className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--border)] opacity-50 cursor-not-allowed"
                    >
                      <span className="text-[11px] font-semibold text-[var(--muted-foreground)]">予想スコア</span>
                      <span className="text-sm font-bold text-[var(--foreground)]">{predictedScore}点</span>
                    </div>
                  )}
                  <Link
                    href="/auth/logout"
                    className="flex items-center gap-2 text-[13px] text-[var(--destructive)] hover:bg-red-50 dark:hover:bg-red-900/10 p-2 rounded-lg transition-colors"
                  >
                    <LogOut size={16} />
                    ログアウト
                  </Link>
                </div>
              ) : (
                <Link
                  href="/auth/login"
                  className="flex items-center gap-1 text-[13px] font-semibold text-[var(--accent)]"
                >
                  <LogIn size={15} />
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
