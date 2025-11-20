"use client";

import React from "react";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4 sm:py-10 sm:px-6">
      <div className="mx-auto bg-white shadow-lg rounded-2xl border border-gray-100 p-6 sm:p-10 max-w-full sm:max-w-3xl">
        {children}
        <div className="mt-10 text-center text-gray-500 text-xs sm:text-sm">
          © 2025 TOEIC単語学習Webアプリ. All rights reserved.
        </div>
      </div>
    </div>
  );
}
