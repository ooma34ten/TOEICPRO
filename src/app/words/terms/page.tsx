"use client";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-6">
      <div className="max-w-3xl mx-auto bg-white shadow-lg rounded-2xl border border-gray-100 p-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-6 text-center">
          利用規約
        </h1>

        <p className="text-gray-600 mb-8 text-center text-sm">
          最終更新日: 2025年10月13日
        </p>

        <div className="space-y-8 text-gray-800 leading-relaxed">
          {/* 1. 利用条件 */}
          <section>
            <h2 className="text-xl font-semibold text-blue-700 mb-2 border-l-4 border-blue-500 pl-3">
              1. 利用条件
            </h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>ユーザー登録にはメールアドレスとパスワードが必要です。</li>
              <li>登録情報は正確に入力してください。</li>
            </ul>
          </section>

          {/* 2. 禁止事項 */}
          <section>
            <h2 className="text-xl font-semibold text-blue-700 mb-2 border-l-4 border-blue-500 pl-3">
              2. 禁止事項
            </h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>法令に違反する行為</li>
              <li>他ユーザーへの迷惑行為、誹謗中傷</li>
              <li>本アプリのシステムやデータの不正利用</li>
            </ul>
          </section>

          {/* 3. 知的財産権 */}
          <section>
            <h2 className="text-xl font-semibold text-blue-700 mb-2 border-l-4 border-blue-500 pl-3">
              3. 知的財産権
            </h2>
            <p>
              単語・例文等のデータは当アプリおよび提供元に帰属します。無断で商用利用することは禁止します。
            </p>
          </section>

          {/* 4. 免責事項 */}
          <section>
            <h2 className="text-xl font-semibold text-blue-700 mb-2 border-l-4 border-blue-500 pl-3">
              4. 免責事項
            </h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>本アプリは学習支援を目的としています。</li>
              <li>単語や例文の正確性・完全性について保証するものではありません。</li>
              <li>データの損失やサービスの停止等に関して当アプリは責任を負いません。</li>
            </ul>
          </section>

          {/* 5. 規約の変更 */}
          <section>
            <h2 className="text-xl font-semibold text-blue-700 mb-2 border-l-4 border-blue-500 pl-3">
              5. 規約の変更
            </h2>
            <p>
              本規約は予告なく変更されることがあります。変更後はアプリ内で通知または更新日を表示します。
            </p>
          </section>
        </div>

        <div className="mt-10 text-center text-gray-500 text-sm">
          © 2025 TOEIC単語学習Webアプリ. All rights reserved.
        </div>
      </div>
    </div>
  );
}
