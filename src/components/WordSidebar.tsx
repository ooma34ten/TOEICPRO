"use client";

import { useState, useRef } from "react";
import WordForm, { Row } from "@/components/WordForm";
import { speakText } from "@/lib/speech";

export default function WordSidebar() {
  const [rows, setRows] = useState<Row[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [width, setWidth] = useState(400); // 初期幅(px)
  const isResizing = useRef(false);

  const handleAdd = (newRows: Row[]) => {
    setRows((prev) => [...prev, ...newRows]);
  };

  const handleMouseDown = () => {
    isResizing.current = true;
    document.body.style.cursor = "col-resize";

    const handleMouseMove = (e: MouseEvent) => {
        const newWidth = window.innerWidth - e.clientX;

        if (newWidth > 200) {
            if (newWidth > window.innerWidth - 50) {
            // 画面右端から50px以内なら全画面
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
      {/* 開閉ボタン */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="
          fixed right-4 z-50 bg-blue-500 text-white px-4 py-2 rounded shadow hover:bg-blue-600 transition
          top-32 sm:top-20 md:top-16
        "
      >
        単語登録
      </button>


      {/* サイドバー */}
      <div
        className={`fixed top-0 right-0 h-full bg-white shadow-2xl transform transition-transform duration-300 z-40
          ${isOpen ? "translate-x-0" : "translate-x-full"}`}
        style={{ width: `${width}px` }}
      >
        {/* ヘッダー */}
        <div className="p-4 flex justify-between items-center border-b">
          <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>

        {/* 中身 */}
        <div className="p-4 overflow-y-auto h-[calc(100%-3rem)]">
          <WordForm onAdd={handleAdd} />

          {rows.length > 0 && (
            <div className="mt-6">
              <h3 className="text-md font-semibold mb-2">履歴</h3>
              <ul className="space-y-2">
                {rows.slice().reverse().map((row, idx) => (
                  <li
                    key={idx}
                    className="border p-2 rounded flex items-center justify-between"
                  >
                    <div>
                      <p><strong>品詞:</strong> {row.part_of_speech}</p>
                      <p><strong>意味:</strong> {row.meaning}</p>
                      <p><strong>例文:</strong> {row.example}</p>
                      <p><strong>翻訳:</strong> {row.translation}</p>
                      <p><strong>重要度:</strong> {row.importance}</p>
                    </div>
                    <button
                      onClick={() => speakText(row.example)}
                      className="bg-indigo-300 text-white px-2 py-1 rounded hover:bg-indigo-400 transition text-sm"
                    >
                      🔊
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* リサイズ用のグリップ */}
        <div
            onMouseDown={handleMouseDown}
            className="absolute right-0 top-0 h-full w-2 cursor-col-resize bg-gray-200 hover:bg-gray-400"
        />
        <div
            onMouseDown={handleMouseDown}
            className="absolute left-0 top-0 h-full w-2 cursor-col-resize bg-gray-200 hover:bg-gray-400"
        />
      </div>
    </>
  );
}
// src/components/WordSidebar.tsx
