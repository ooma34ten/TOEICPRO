"use client";

import React from "react";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-6">
      <div className="max-w-3xl mx-auto bg-white shadow-lg rounded-2xl border border-gray-100 p-10 space-y-6">
        {children}
        <div className="mt-10 text-center text-gray-500 text-sm">
          © 2025 TOEIC単語学習Webアプリ. All rights reserved.
        </div>
      </div>
    </div>
  );
}
