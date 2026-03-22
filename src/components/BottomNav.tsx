"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BookOpen, Zap, Library, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";

const navItems = [
  { href: "/", label: "ホーム", icon: Home },
  { href: "/words/review", label: "復習", icon: BookOpen },
  { href: "/words/ai_teacher", label: "Part5", icon: Zap },
  { href: "/words/list", label: "単語帳", icon: Library },
  { href: "/words/progress", label: "進捗", icon: BarChart3 },
];

export default function BottomNav() {
  const pathname = usePathname();

  // 認証・法律ページでは非表示
  if (pathname.startsWith("/auth") || pathname.startsWith("/legal") || pathname.startsWith("/admin")) {
    return null;
  }

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 safe-area-bottom">
      <div className="flex items-center justify-around px-2 py-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className="relative flex flex-col items-center justify-center py-2 px-3 min-w-[56px] group"
            >
              {isActive && (
                <motion.div
                  layoutId="bottomNavIndicator"
                  className="absolute -top-1 w-8 h-1 bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full"
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
              <Icon
                className={`w-5 h-5 transition-colors ${
                  isActive
                    ? "text-indigo-600 dark:text-indigo-400"
                    : "text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300"
                }`}
              />
              <span
                className={`text-[10px] mt-0.5 font-medium transition-colors ${
                  isActive
                    ? "text-indigo-600 dark:text-indigo-400"
                    : "text-slate-400 dark:text-slate-500"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
