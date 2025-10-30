"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Loader2, PlusCircle } from "lucide-react";

type Invite = {
  id: string;
  code: string;
  inviter_user_id: string;
  created_at: string;
  max_uses: number;
  used_count: number;
};

export default function InviteManager() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(false);
  const [userIdInput, setUserIdInput] = useState(""); // 招待コード発行対象のユーザーID

  // 招待コード一覧取得
  const fetchInvites = async () => {
    const { data, error } = await supabase.from("invites").select("*").order("created_at", { ascending: false });
    if (!error && data) setInvites(data as Invite[]);
  };

  useEffect(() => {
    fetchInvites();
  }, []);

  // ランダム招待コード生成
  const generateCode = (length = 8) => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const createInvite = async () => {
    if (!userIdInput) {
      alert("ユーザーIDを入力してください");
      return;
    }

    const code = generateCode(8); // 8文字の招待コード
    setLoading(true);

    const { error } = await supabase.from("invites").insert([
      {
        code,
        inviter_user_id: userIdInput,
        max_uses: 1000, // 必要に応じて変更可能
      },
    ]);

    setLoading(false);

    if (error) {
      alert("招待コード作成に失敗しました: " + error.message);
    } else {
      alert("招待コードを作成しました: " + code);
      setUserIdInput("");
      fetchInvites();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-2xl font-bold mb-6">招待コード管理画面</h1>

      {/* 招待コード発行 */}
      <div className="mb-6 flex gap-2 items-center">
        <input
          type="text"
          placeholder="ユーザーIDを入力"
          value={userIdInput}
          onChange={(e) => setUserIdInput(e.target.value)}
          className="px-3 py-2 border rounded-lg flex-1 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <button
          className={`flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium transition
            ${loading ? "bg-blue-400 cursor-not-allowed" : "hover:bg-blue-700"}`}
          onClick={createInvite}
          disabled={loading}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
          招待コード発行
        </button>
      </div>

      {/* 招待コード一覧 */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">発行済み招待コード</h2>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b">
              <th className="py-2">コード</th>
              <th className="py-2">発行者ユーザーID</th>
              <th className="py-2">作成日</th>
              <th className="py-2">使用状況</th>
              <th className="py-2">最大使用回数</th>
            </tr>
          </thead>
          <tbody>
            {invites.map((invite) => (
              <tr key={invite.id} className="border-b hover:bg-gray-50">
                <td className="py-2 font-mono">{invite.code}</td>
                <td className="py-2">{invite.inviter_user_id}</td>
                <td className="py-2">{new Date(invite.created_at).toLocaleString()}</td>
                <td className="py-2">{invite.used_count}</td>
                <td className="py-2">{invite.max_uses}</td>
              </tr>
            ))}
            {invites.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-4 text-gray-500">
                  招待コードはまだ発行されていません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
