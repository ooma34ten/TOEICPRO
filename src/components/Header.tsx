import Link from "next/link";

export default function Header() {
  return (
    <header className="px-4 py-3 bg-white border-b flex items-center gap-4">
      <Link href="/" className="font-bold text-blue-600">TOEIC 単語学習アプリ</Link>
      <nav className="flex gap-3 text-sm">
        <Link href="/words/list" className="underline hover:no-underline">単語一覧</Link>
        <Link href="/words/register" className="underline hover:no-underline">単語登録</Link>
        <Link href="/words/review" className="underline hover:no-underline">復習モード</Link>
        <Link href="/words/progress" className="underline hover:no-underline">学習進捗</Link>
        <Link href="/words/contact" className="underline hover:no-underline">お問い合わせ</Link>
        <Link href="/words/privacy" className="underline hover:no-underline">プライバシーポリシー</Link>
        <Link href="/words/terms" className="underline hover:no-underline">利用規約</Link>
      </nav>
      <div className="ml-auto">
        <Link href="/auth/logout" className="text-sm text-gray-500 underline">ログアウト</Link>
      </div>
    </header>
  );
}

// src/components/Header.tsx
