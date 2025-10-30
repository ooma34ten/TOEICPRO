"use client";

import LegalLayout from "../layout";

export default function PrivacyPage() {
  return (
    <LegalLayout>
      <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6 text-center text-gray-800">
        プライバシーポリシー
      </h1>

      <div className="space-y-6 sm:space-y-8 text-gray-800 leading-relaxed text-sm sm:text-base">
        <section>
          <h2 className="text-lg sm:text-xl font-semibold text-blue-700 mb-2 border-l-4 border-blue-500 pl-3">
            1. 収集する情報
          </h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>ユーザー登録情報：メールアドレス、パスワード</li>
            <li>単語学習データ（単語、意味、例文、進捗など）</li>
            <li>問い合わせフォームで送信された内容</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg sm:text-xl font-semibold text-blue-700 mb-2 border-l-4 border-blue-500 pl-3">
            2. 利用目的
          </h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>ユーザー登録情報の管理および認証</li>
            <li>単語学習データの管理</li>
            <li>サービス改善および問い合わせ対応</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg sm:text-xl font-semibold text-blue-700 mb-2 border-l-4 border-blue-500 pl-3">
            3. 第三者提供
          </h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>ユーザーの個人情報は本人の同意なしに第三者に提供しません。</li>
            <li>ただし、法令に基づく場合を除きます。</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg sm:text-xl font-semibold text-blue-700 mb-2 border-l-4 border-blue-500 pl-3">
            4. データの保管
          </h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>データはSupabase上に安全に保管されます。</li>
            <li>パスワードはハッシュ化して管理されます。</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg sm:text-xl font-semibold text-blue-700 mb-2 border-l-4 border-blue-500 pl-3">
            5. Cookie・ログ
          </h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>アクセスログを取得する場合があります。</li>
            <li>個人を特定できる情報として使用しません。</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg sm:text-xl font-semibold text-blue-700 mb-2 border-l-4 border-blue-500 pl-3">
            6. プライバシーポリシーの変更
          </h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>本ポリシーは予告なく変更される場合があります。</li>
            <li>変更後はアプリ内で通知または更新日を表示します。</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg sm:text-xl font-semibold text-blue-700 mb-2 border-l-4 border-blue-500 pl-3">
            お問い合わせ
          </h2>
          <p className="text-gray-600">
            プライバシーに関するお問い合わせは
            <span className="font-medium text-blue-600"> お問い合わせフォーム </span>
            よりご連絡ください。
          </p>
        </section>
      </div>
    </LegalLayout>
  );
}
