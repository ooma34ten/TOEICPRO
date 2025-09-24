// src/app/api/self-delete/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin"; // service_role を使う

export async function POST(req: Request) {
  const { userId } = await req.json();

  // 本人確認は middleware や access_token でチェックするのがおすすめ
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
