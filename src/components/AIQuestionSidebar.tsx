"use client";

import { useState, useRef } from "react";
import { X, MessageCircle, Minus } from "lucide-react";
import TOEICAIPage from "@/components/TOEICAIPage";

export default function AIQuestionSidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [width, setWidth] = useState(420);
  const isResizing = useRef(false);

  const handleMouseDown = () => {
    isResizing.current = true;
    document.body.style.cursor = "col-resize";

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth > 300 && newWidth < window.innerWidth - 80) {
        setWidth(newWidth);
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
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed right-6 bottom-24 z-50 flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-full shadow-lg hover:bg-indigo-700 transition"
      >
        {isOpen ? <Minus size={18} /> : <MessageCircle size={18} />}
        {isOpen ? "閉じる" : "AI質問"}
      </button>

      <div
        className={`fixed top-0 right-0 h-full bg-white shadow-2xl border-l transform transition-transform duration-300 z-40 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ width: `${width}px` }}
      >
        <div className="sticky top-0 flex justify-between items-center border-b bg-white px-4 py-3 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-700">TOEIC AI 質問</h2>
          <button onClick={() => setIsOpen(false)} className="p-1 text-gray-500 hover:text-gray-700 transition">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto h-[calc(100%-3rem)] p-4">
          <TOEICAIPage />
        </div>

        <div
          onMouseDown={handleMouseDown}
          className="absolute left-0 top-0 h-full w-2 cursor-col-resize bg-gradient-to-r from-gray-200 to-gray-300 hover:from-indigo-200 hover:to-indigo-300 transition"
        />
      </div>
    </>
  );
}
