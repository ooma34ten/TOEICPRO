// src/app/words/tokutei/page.tsx
import React from "react";

export const metadata = {
  title: "特定商取引法に基づく表記",
};

export default function TokuteiPage() {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">特定商取引法に基づく表記</h1>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">販売業者の名称</h2>
        <p>大市 将輝</p>
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">所在地</h2>
        <p>請求があったら遅滞なく開示します</p>
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">電話番号</h2>
        <p>請求があったら遅滞なく開示します</p>
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">メールアドレス</h2>
        <p>toeicpro10@gmail.com</p>
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">運営統括責任者</h2>
        <p>大市 将輝</p>
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">拡張機能販売価格</h2>
        <ul className="list-disc list-inside">
          <li>200円/月</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">受け付け可能な決済手段</h2>
        <p>クレジットカード（VISA/MasterCard/American Express/Diners Club/JCB）でのお支払いが可能です。</p>
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">決済期間</h2>
        <p>カード決済が行われたタイミングで課金が発生いたします。</p>
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">サブスクリプション解約方法</h2>
        <p>解約はサブスクリプションページにて行えます。解約後支払い済みの期間はサブスクリプション利用可能です。</p>
      </section>
    </div>
  );
}
