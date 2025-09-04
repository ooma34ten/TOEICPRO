"use client";
import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      await supabase.auth.signOut();
      router.replace("/auth/login");
    })();
  }, [router]);

  return <div className="min-h-screen flex items-center justify-center">ログアウト中…</div>;
}
// src/app/auth/logout/page.tsx