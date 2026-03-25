"use client";

import LegalLayout from "../layout";

export default function PrivacyPage() {
  return (
    <LegalLayout>
      <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6 text-center text-[var(--foreground)]">
        プライバシーポリシー
      </h1>

      <div className="space-y-6 sm:space-y-8 text-[var(--foreground)] leading-relaxed text-sm sm:text-base">
        <section>
          <h2 className="text-lg sm:text-xl font-semibold text-[var(--accent)] mb-2 border-l-4 border-[var(--accent)] pl-3">
            1. 収集する情報
          </h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>ユーザー登録情報：メールアドレス、パスワード等</li>
            <li>学習データ：単語帳データ、学習進捗、テスト結果、予想スコア等</li>
            <li>AI機能利用時のデータ：入力テキスト、音声データ（発話内容）、およびAIによる分析結果</li>
            <li>決済関連情報（有料プランをご利用の場合、決済は外部サービスStripeを通じて安全に処理され、当アプリはクレジットカード情報を保持しません）</li>
            <li>問い合わせに関する情報</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg sm:text-xl font-semibold text-[var(--accent)] mb-2 border-l-4 border-[var(--accent)] pl-3">
            2. 利用目的
          </h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>本サービスの提供、認証、およびユーザー体験の向上</li>
            <li>AIを用いた学習コンテンツ（例文、解説、英会話応答など）の生成および最適化</li>
            <li>ユーザーの学習定着度やスコア予測の分析</li>
            <li>サービス改善、新機能開発、および問い合わせ対応</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg sm:text-xl font-semibold text-[var(--accent)] mb-2 border-l-4 border-[var(--accent)] pl-3">
            3. 第三者提供・外部サービス連携
          </h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>本サービスでは、学習機能提供のためOpenAI社などの外部AI APIを利用しており、プロンプトとして必要なテキストや音声データを送信する場合があります。送信されたデータはAPI事業者の規約に基づき処理されます。</li>
            <li>有料定額サービス等の決済処理のため、決済代行サービス（Stripe等）に必要な情報を連携します。</li>
            <li>上記および法令に基づく場合を除き、ユーザーの個人情報を本人の同意なしに第三者に提供しません。</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg sm:text-xl font-semibold text-[var(--accent)] mb-2 border-l-4 border-[var(--accent)] pl-3">
            4. データの保管とセキュリティ
          </h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>データはセキュアなクラウドデータベース（Supabase等）上に保管されます。</li>
            <li>ログインパスワードは安全にハッシュ化され管理されます。</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg sm:text-xl font-semibold text-[var(--accent)] mb-2 border-l-4 border-[var(--accent)] pl-3">
            5. Cookieおよびアクセスログ
          </h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>サービスの利用状況把握のため、アクセスログやCookie情報を取得する場合があります。</li>
            <li>これらは個人を特定する目的では使用しません。</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg sm:text-xl font-semibold text-[var(--accent)] mb-2 border-l-4 border-[var(--accent)] pl-3">
            6. プライバシーポリシーの変更
          </h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>本ポリシーは法令の変更やサービスのアップデートに伴い、予告なく変更される場合があります。</li>
            <li>重要な変更がある場合は、アプリ内での通知または更新日の表示をもってお知らせします。</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg sm:text-xl font-semibold text-[var(--accent)] mb-2 border-l-4 border-[var(--accent)] pl-3">
            お問い合わせ
          </h2>
          <p className="text-[var(--muted-foreground)] text-sm">
            プライバシーに関するお問い合わせは<span className="font-medium text-[var(--accent)]"> お問い合わせフォーム </span>よりご連絡ください。
          </p>
        </section>
      </div>
    </LegalLayout>
  );
}
