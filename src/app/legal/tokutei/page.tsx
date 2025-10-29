"use client";

import LegalLayout from "../layout";

export default function TokuteiPage() {
  return (
    <LegalLayout>
      <h1 className="text-3xl font-bold mb-6 text-center text-gray-800">
        特定商取引法に基づく表記
      </h1>

      <div className="space-y-6 text-gray-800 leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold mb-2 border-l-4 border-blue-500 pl-3">
            販売業者の名称
          </h2>
          <p>大市 将輝</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2 border-l-4 border-blue-500 pl-3">
            所在地
          </h2>
          <p>請求があったら遅滞なく開示します</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2 border-l-4 border-blue-500 pl-3">
            電話番号
          </h2>
          <p>請求があったら遅滞なく開示します</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2 border-l-4 border-blue-500 pl-3">
            メールアドレス
          </h2>
          <p>toeicpro10@gmail.com</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2 border-l-4 border-blue-500 pl-3">
            運営統括責任者
          </h2>
          <p>大市 将輝</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2 border-l-4 border-blue-500 pl-3">
            拡張機能販売価格
          </h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>200円/月</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2 border-l-4 border-blue-500 pl-3">
            受け付け可能な決済手段
          </h2>
          <p>クレジットカード（VISA/MasterCard/American Express/Diners Club/JCB）でのお支払いが可能です。</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2 border-l-4 border-blue-500 pl-3">
            決済期間
          </h2>
          <p>カード決済が行われたタイミングで課金が発生いたします。</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2 border-l-4 border-blue-500 pl-3">
            サブスクリプション解約方法
          </h2>
          <p>解約はサブスクリプションページにて行えます。解約後支払い済みの期間はサブスクリプション利用可能です。</p>
        </section>
      </div>
    </LegalLayout>
  );
}
