"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type QueueItem = {
  id: string;
  word_id: string;
  level: string;
  category: string;
  status: "pending" | "processing" | "done" | "error";
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export default function QueueDashboardPage() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [status, setStatus] = useState<string>("all");
  const [loading, setLoading] = useState<boolean>(false);

  const fetchQueue = async (): Promise<void> => {
    setLoading(true);

    const baseQuery = supabase
      .from("ai_generated_questions_queue")
      .select("*")
      .order("created_at", { ascending: false });

    const query =
      status === "all"
        ? baseQuery
        : baseQuery.eq("status", status as NonNullable<QueueItem["status"]>);

    const { data } = await query;

    setItems(data ?? []);
    setLoading(false);
  };

  const deleteItem = async (id: string): Promise<void> => {
    await supabase.from("ai_generated_questions_queue").delete().eq("id", id);
    fetchQueue();
  };

  const retryItem = async (id: string): Promise<void> => {
    await supabase
      .from("ai_generated_questions_queue")
      .update({
        status: "pending",
        error_message: null,
      })
      .eq("id", id);

    fetchQueue();
  };

  useEffect(() => {
    fetchQueue();
  }, [status]);

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">AI キュー管理</h1>

      {/* フィルタ */}
      <div className="mb-4 flex gap-3">
        <select
          className="border px-3 py-2 rounded"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">すべて</option>
          <option value="pending">pending</option>
          <option value="processing">processing</option>
          <option value="done">done</option>
          <option value="error">error</option>
        </select>

        <button
          onClick={fetchQueue}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          更新
        </button>
      </div>

      {/* 一覧 */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 border">ID</th>
              <th className="p-2 border">Word ID</th>
              <th className="p-2 border">Level</th>
              <th className="p-2 border">Category</th>
              <th className="p-2 border">Status</th>
              <th className="p-2 border">Error</th>
              <th className="p-2 border">Created</th>
              <th className="p-2 border">Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="text-center p-4">
                  読み込み中…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center p-4">
                  データがありません
                </td>
              </tr>
            ) : (
              items.map((row) => (
                <tr key={row.id}>
                  <td className="p-2 border">{row.id}</td>
                  <td className="p-2 border">{row.word_id}</td>
                  <td className="p-2 border">{row.level}</td>
                  <td className="p-2 border">{row.category}</td>
                  <td className="p-2 border">{row.status}</td>
                  <td className="p-2 border text-red-600">
                    {row.error_message ?? ""}
                  </td>
                  <td className="p-2 border">
                    {new Date(row.created_at).toLocaleString()}
                  </td>

                  {/* Actions */}
                  <td className="p-2 border space-x-2">
                    {row.status === "error" && (
                      <button
                        className="px-2 py-1 bg-yellow-600 text-white rounded"
                        onClick={() => retryItem(row.id)}
                      >
                        再キュー
                      </button>
                    )}

                    <button
                      className="px-2 py-1 bg-red-600 text-white rounded"
                      onClick={() => deleteItem(row.id)}
                    >
                      削除
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
