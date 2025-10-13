"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { BookOpen, RefreshCcw, PlusCircle, BarChart } from "lucide-react";

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) setUserId(data.session.user.id);
      setLoading(false);
    })();
  }, []);

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
        <p className="text-gray-600 text-lg animate-pulse">
          ログイン状態を確認中です…
        </p>
      </div>
    );

  const restrictedClass = !userId
    ? "opacity-60 pointer-events-none"
    : "";

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 flex flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-extrabold text-blue-700 mb-4 text-center drop-shadow-sm">
        TOEIC 単語学習アプリ
      </h1>
      <p className="text-gray-600 text-center mb-8 max-w-md">
        効率的に単語を覚えてスコアアップを目指そう！
      </p>

      {!userId && (
        <>
          <div className="mb-5 text-center text-red-600 font-medium">
            ログインすると「単語一覧」「復習モード」「学習進捗」が利用できます。
          </div>
          <Link
            href="/auth/login"
            className="mb-8 inline-block bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold shadow hover:bg-blue-700 transition"
          >
            ログインする
          </Link>
        </>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-3xl">
        {/* 単語一覧 */}
        <Link
          href="/words/list"
          className={`group p-6 bg-white rounded-2xl shadow-md hover:shadow-xl transition transform hover:-translate-y-1 ${restrictedClass}`}
        >
          <div className="flex flex-col items-center">
            <BookOpen className="w-10 h-10 text-blue-500 mb-3 group-hover:scale-110 transition-transform" />
            <h2 className="text-2xl font-bold text-blue-600 mb-1">単語一覧</h2>
            <p className="text-gray-600 text-center text-sm">
              登録済みのTOEIC単語を確認できます。
            </p>
          </div>
        </Link>

        {/* 復習モード */}
        <Link
          href="/words/review"
          className={`group p-6 bg-white rounded-2xl shadow-md hover:shadow-xl transition transform hover:-translate-y-1 ${restrictedClass}`}
        >
          <div className="flex flex-col items-center">
            <RefreshCcw className="w-10 h-10 text-green-500 mb-3 group-hover:rotate-180 transition-transform duration-500" />
            <h2 className="text-2xl font-bold text-green-600 mb-1">復習モード</h2>
            <p className="text-gray-600 text-center text-sm">
              ランダムに単語を出題して学習できます。
            </p>
          </div>
        </Link>

        {/* 単語登録 */}
        <Link
          href="/words/register"
          className="group p-6 bg-white rounded-2xl shadow-md hover:shadow-xl transition transform hover:-translate-y-1"
        >
          <div className="flex flex-col items-center">
            <PlusCircle className="w-10 h-10 text-red-500 mb-3 group-hover:scale-110 transition-transform" />
            <h2 className="text-2xl font-bold text-red-600 mb-1">単語登録</h2>
            <p className="text-gray-600 text-center text-sm">
              学習したい単語を登録して自分専用のリストを作成できます。
            </p>
          </div>
        </Link>

        {/* 学習進捗 */}
        <Link
          href="/words/progress"
          className={`group p-6 bg-white rounded-2xl shadow-md hover:shadow-xl transition transform hover:-translate-y-1 ${restrictedClass}`}
        >
          <div className="flex flex-col items-center">
            <BarChart className="w-10 h-10 text-yellow-500 mb-3 group-hover:scale-110 transition-transform" />
            <h2 className="text-2xl font-bold text-yellow-600 mb-1">学習進捗</h2>
            <p className="text-gray-600 text-center text-sm">
              あなたの学習成果や正答率をグラフで確認できます。
            </p>
          </div>
        </Link>
      </div>

      <footer className="mt-12 text-gray-400 text-sm text-center">
        © 2025 TOEIC単語学習アプリ — すべての学習者を応援しています 📘
      </footer>
    </div>
  );
}
