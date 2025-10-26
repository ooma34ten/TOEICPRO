"use client";

import { useState, useRef } from "react";
import WordForm, { Row } from "@/components/WordForm";
import { speakText } from "@/lib/speech";
import { Plus, Minus, X, Volume2 } from "lucide-react"; // ← Minus を追加

export default function WordSidebar() {
  const [rows, setRows] = useState<Row[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [width, setWidth] = useState(400);
  const isResizing = useRef(false);

  const handleAdd = (newRows: Row[]) => {
    setRows((prev) => [...prev, ...newRows]);
  };

  const handleMouseDown = () => {
    isResizing.current = true;
    document.body.style.cursor = "col-resize";

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth > 240) {
        if (newWidth > window.innerWidth - 60) {
          setWidth(window.innerWidth);
        } else {
          setWidth(newWidth);
        }
      }
    };

    const handleMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = "default";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <>
      {/* 📘 フローティングボタン */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="
          fixed right-6 bottom-8 z-50 flex items-center gap-2
          bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg hover:bg-blue-700 transition
        "
      >
        {/* ← 状態に応じてアイコン切り替え */}
        {isOpen ? <Minus size={18} /> : <Plus size={18} />}
        {isOpen ? "閉じる" : "単語登録"}
      </button>

      {/* 📘 サイドバー */}
      <div
        className={`fixed top-0 right-0 h-full bg-white shadow-2xl border-l transform transition-transform duration-300 z-40
          ${isOpen ? "translate-x-0" : "translate-x-full"}`}
        style={{ width: `${width}px` }}
      >
        {/* ヘッダー */}
        <div className="sticky top-0 z-10 flex justify-between items-center border-b bg-white px-4 py-3 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-700">単語登録フォーム</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 text-gray-500 hover:text-gray-700 transition"
            aria-label="閉じる"
          >
            <X size={20} />
          </button>
        </div>

        {/* コンテンツ */}
        <div className="p-4 overflow-y-auto h-[calc(100%-3rem)] space-y-6">
          <div className="bg-gray-50 rounded-xl border p-4 shadow-inner">
            <WordForm onAdd={handleAdd} />
          </div>

          {rows.length > 0 && (
            <div>
              <h3 className="text-md font-semibold text-gray-700 mb-3 border-b pb-1">
                最近追加した単語
              </h3>
              <ul className="space-y-3">
                {rows
                  .slice()
                  .reverse()
                  .map((row, idx) => (
                    <li
                      key={idx}
                      className="bg-white border rounded-lg p-3 shadow-sm hover:shadow-md transition flex justify-between items-start"
                    >
                      <div className="text-sm space-y-0.5">
                        <p><span className="font-semibold text-blue-600">{row.word}</span></p>
                        <p><strong>品詞:</strong> {row.part_of_speech}</p>
                        <p><strong>意味:</strong> {row.meaning}</p>
                        <p className="italic text-gray-600">&quot;{row.example}&quot;</p>
                        <p className="text-gray-500 text-xs">{row.translation}</p>
                        <p className="text-xs text-yellow-600"><strong>重要度:</strong> {row.importance}</p>
                      </div>
                      <button
                        onClick={() => speakText(row.example)}
                        className="p-2 bg-blue-100 text-blue-600 rounded-full hover:bg-blue-200 transition"
                        title="例文を再生"
                      >
                        <Volume2 size={16} />
                      </button>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </div>

        {/* リサイズバー */}
        <div
          onMouseDown={handleMouseDown}
          className="absolute left-0 top-0 h-full w-2 cursor-col-resize bg-gradient-to-r from-gray-200 to-gray-300 hover:from-blue-200 hover:to-blue-300 transition"
        />
      </div>
    </>
  );
}
