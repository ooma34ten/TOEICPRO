// src/app/words/layout.tsx
import Link from "next/link";
import React from "react";

export default function WordsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="px-4 py-3 bg-white border-b flex items-center gap-4">
        <Link href="/" className="font-bold text-blue-600">TOEIC 単語学習アプリ</Link>
        <nav className="flex gap-3 text-sm">
          <Link href="/words/list" className="underline hover:no-underline">単語一覧</Link>
          <Link href="/words/register" className="underline hover:no-underline">単語登録</Link>
          <Link href="/words/review" className="underline hover:no-underline">復習モード</Link>
          <Link href="/words/progress" className="underline hover:no-underline">学習進捗</Link>
        </nav>
        <div className="ml-auto">
          <Link href="/auth/logout" className="text-sm text-gray-500 underline">ログアウト</Link>
        </div>
      </header>
      <main className="p-6 max-w-5xl mx-auto">{children}</main>
    </div>
  );
}
