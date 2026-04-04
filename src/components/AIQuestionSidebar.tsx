"use client";

import { useState, useRef } from "react";
import type { ReactNode } from "react";
import TOEICAIPage from "@/components/TOEICAIPage";
import WordForm, { Row } from "@/components/WordForm";
import { speakText } from "@/lib/speech";
import { Bot, BookOpen, Library, Volume2, X } from "lucide-react";

type SidebarType = "aiQuestion" | "aiDictionary";

export default function UnifiedSidebar() {
  // 初期値を false にしてサイドバーを閉じた状態で開始
  const [isOpen, setIsOpen] = useState<{ [key in SidebarType]: boolean }>({
    aiQuestion: false,
    aiDictionary: false,
  });

  const [width, setWidth] = useState<{ [key in SidebarType]: number }>({
    aiQuestion: 420,
    aiDictionary: 400,
  });

  const isResizing = useRef(false);
  const [rows, setRows] = useState<Row[]>([]);

  const toggleSidebar = (type: SidebarType) => {
    setIsOpen((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  const handleMouseDown = (type: SidebarType) => {
    isResizing.current = true;
    document.body.style.cursor = "col-resize";

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth > 300 && newWidth < window.innerWidth - 80) {
        setWidth((prev) => ({ ...prev, [type]: newWidth }));
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

  const handleAdd = (newRows: Row[]) => {
    setRows((prev) => [...prev, ...newRows]);
  };

  const sidebars: { type: SidebarType; icon: ReactNode; title: string; content: ReactNode }[] = [
    {
      type: "aiQuestion",
      icon: <Bot size={22} className="animate-pulse" />,
      title: "TOEIC AI アシスタント",
      content: <TOEICAIPage />,
    },
    {
      type: "aiDictionary",
      icon: <BookOpen size={22} />,
      title: "単語登録",
      content: (
        <div className="space-y-6">
          <div className="bg-[var(--secondary)] rounded-xl border border-[var(--border)] p-4 shadow-inner">
            <WordForm onAdd={handleAdd} />
          </div>
          {rows.length > 0 && (
            <div>
              <h3 className="text-md font-semibold text-[var(--foreground)] mb-3 border-b border-[var(--border)] pb-1 flex items-center gap-2">
                <Library className="text-[var(--accent)]" size={18} />
                最近追加した単語
              </h3>
              <ul className="space-y-3">
                {rows
                  .slice()
                  .reverse()
                  .map((row, idx) => (
                    <li
                      key={idx}
                      className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 shadow-sm hover:shadow-md transition flex justify-between items-start"
                    >
                      <div className="text-sm space-y-0.5 text-[var(--foreground)]">
                        <p>
                          <span className="font-semibold text-[var(--accent)]">{row.word}</span>
                        </p>
                        <p><strong>品詞:</strong> {row.part_of_speech}</p>
                        <p><strong>意味:</strong> {row.meaning}</p>
                        <p className="italic text-[var(--muted-foreground)]">&quot;{row.example}&quot;</p>
                        <p className="text-[var(--muted-foreground)] text-xs">{row.translation}</p>
                        <p className="text-xs text-yellow-500">
                          <strong>重要度:</strong> {row.importance}
                        </p>
                      </div>
                      <button
                        onClick={() => speakText(row.example)}
                        className="p-2 bg-[var(--secondary)] text-[var(--accent)] rounded-full hover:bg-[var(--accent)]/10 transition"
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
      ),
    },
  ];

  return (
    <>
      {/* ===== フローティングボタン ===== */}
      {sidebars.map((sb, idx) => (
        <button
          key={sb.type}
          onClick={() => toggleSidebar(sb.type)}
          style={{ bottom: `${20 + idx * 70}px` }} // Tailwindの動的クラスではなく style
          className={`fixed right-6 z-[70] flex items-center gap-2 px-4 py-3 rounded-full shadow-lg backdrop-blur-md border border-[var(--border)]
            transition-all duration-300 font-bold ${
              isOpen[sb.type]
                ? "bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] scale-95"
                : "bg-[var(--accent)] text-[var(--accent-foreground)] shadow-[var(--accent)]/20 hover:scale-105"
            }`}
        >
          {isOpen[sb.type] ? <X size={22} className="opacity-80" /> : sb.icon}
          <span className="hidden sm:inline font-medium">
            {isOpen[sb.type] ? "閉じる" : sb.title}
          </span>
        </button>
      ))}

      {/* ===== サイドバー ===== */}
      {sidebars.map((sb) => (
        <div
          key={sb.type}
          className={`fixed top-0 right-0 h-full backdrop-blur-lg bg-[var(--background)]/95 border-l border-[var(--border)] shadow-2xl transform transition-transform duration-300 z-40
            ${isOpen[sb.type] ? "translate-x-0" : "translate-x-full"}`}
          style={{ width: width[sb.type] ?? 400, zIndex: 60 }}
        >
          {/* ヘッダー */}
          <div className="sticky top-0 z-10 flex justify-between items-center border-b border-[var(--border)] bg-[var(--background)]/80 px-4 py-3 shadow-sm backdrop-blur-md">
            <div className="flex items-center gap-2 text-[var(--foreground)]">
              {sb.icon}
              <h2 className="text-lg font-semibold">{sb.title}</h2>
            </div>
          </div>

          {/* コンテンツ */}
          <div className="overflow-y-auto h-[calc(100%-3rem)] p-4">{sb.content}</div>

          {/* リサイズバー */}
          <div
            onMouseDown={() => handleMouseDown(sb.type)}
            className="absolute left-0 top-0 h-full w-2 cursor-col-resize bg-[var(--border)] hover:bg-[var(--accent)]/50 transition"
          />
        </div>
      ))}
    </>
  );
}
