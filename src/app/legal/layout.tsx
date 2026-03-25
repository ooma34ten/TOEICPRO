"use client";

import React from "react";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--background)] py-6 px-4 sm:py-10 sm:px-6">
      <div className="mx-auto bg-[var(--card)] shadow-lg rounded-2xl border border-[var(--border)] p-6 sm:p-10 max-w-full sm:max-w-3xl">
        {children}
        <div className="mt-10 text-center text-[var(--muted-foreground)] text-xs sm:text-sm">
          © 2025 TOEIC単語学習Webアプリ. All rights reserved.
        </div>
      </div>
    </div>
  );
}
