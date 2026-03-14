"use client";

import LegalLayout from "../layout";

export default function TermsPage() {
  return (
    <LegalLayout>
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4 sm:mb-6 text-center">
        利用規約
      </h1>

      <p className="text-gray-600 mb-6 sm:mb-8 text-center text-xs sm:text-sm">
        最終更新日: 2026年3月15日
      </p>

      <div className="space-y-6 sm:space-y-8 text-gray-800 leading-relaxed text-sm sm:text-base">
        <section>
          <h2 className="text-lg sm:text-xl font-semibold text-blue-700 mb-2 border-l-4 border-blue-500 pl-3">
            1. 利用条件
          </h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>ユーザー登録にはメールアドレスとパスワード等が必要です。</li>
            <li>登録情報は正確に入力し、アカウント情報は厳重に管理してください。</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg sm:text-xl font-semibold text-blue-700 mb-2 border-l-4 border-blue-500 pl-3">
            2. 禁止事項
          </h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>法令または公序良俗に違反する行為</li>
            <li>他ユーザーへの迷惑行為、誹謗中傷</li>
            <li>本アプリのシステムやデータの不正利用（スクレイピング等の自動収集を含む）</li>
            <li>AI機能に対する不正利用（システムに過度な負荷をかけるリクエスト、プロンプトインジェクション等）</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg sm:text-xl font-semibold text-blue-700 mb-2 border-l-4 border-blue-500 pl-3">
            3. 知的財産権
          </h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>アプリ内の単語・例文等のデータに関する権利は当アプリおよび情報提供元に帰属します。</li>
            <li>AI機能によって生成されたコンテンツ（学習用例文、英会話シナリオ等）は、お客様自身の個人的な学習目的にのみ利用可能であり、無断で商用利用、転載、再配布することは禁じられます。</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg sm:text-xl font-semibold text-blue-700 mb-2 border-l-4 border-blue-500 pl-3">
            4. 料金および支払い
          </h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>有料サブスクリプションプランをご利用の場合、明記された利用料金をお支払いいただきます。</li>
            <li>決済処理は外部サービス（Stripe等）を通じて行われます。</li>
            <li>サブスクリプションの解約はアプリ内の設定から可能ですが、利用期間中の途中解約に伴う日割りでの返金は行いません。</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg sm:text-xl font-semibold text-blue-700 mb-2 border-l-4 border-blue-500 pl-3">
            5. 免責事項
          </h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>本アプリは学習支援を目的としており、学習効果を保証するものではありません。</li>
            <li>AI機能が生成する回答（日本語訳、解説、英会話の応答など）はシステムによって自動生成されるため、情報の正確性や完全性、最新性について一切保証するものではありません（いわゆるハルシネーションが含まれる可能性があります）。</li>
            <li>データの損失、システムの停止、通信環境の不具合等に関して当アプリは一切の責任を負いません。</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg sm:text-xl font-semibold text-blue-700 mb-2 border-l-4 border-blue-500 pl-3">
            6. 規約の変更
          </h2>
          <p>本規約は予告なく変更されることがあります。重大な変更がある場合はアプリ内でお知らせし、以降の利用をもって変更に同意したものとみなします。</p>
        </section>
      </div>
    </LegalLayout>
  );
}
