"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BookOpen, Zap, Library, BarChart3 } from "lucide-react";

const navItems = [
  { href: "/", label: "ホーム", icon: Home },
  { href: "/words/review", label: "復習", icon: BookOpen },
  { href: "/words/ai_teacher", label: "Part5", icon: Zap },
  { href: "/words/list", label: "単語帳", icon: Library },
  { href: "/words/progress", label: "進捗", icon: BarChart3 },
];

export default function BottomNav() {
  const pathname = usePathname();

  if (pathname.startsWith("/auth") || pathname.startsWith("/legal") || pathname.startsWith("/admin")) {
    return null;
  }

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[var(--background)] border-t border-[var(--border)] safe-area-bottom">
      <div className="flex items-center justify-around px-1 py-1.5">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center justify-center py-1 px-3 min-w-[52px] group"
            >
              <div className={`p-1.5 rounded-lg transition-colors ${
                isActive
                  ? "bg-[var(--accent)]/10"
                  : "group-hover:bg-[var(--secondary)]"
              }`}>
                <Icon
                  className={`w-[18px] h-[18px] transition-colors ${
                    isActive
                      ? "text-[var(--accent)]"
                      : "text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]"
                  }`}
                />
              </div>
              <span
                className={`text-[10px] mt-0.5 font-medium transition-colors ${
                  isActive
                    ? "text-[var(--accent)]"
                    : "text-[var(--muted-foreground)]"
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
