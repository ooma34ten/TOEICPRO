// src/app/api/words/register/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST(req: NextRequest) {
  const { wordId } = await req.json();

  const { data, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) return NextResponse.json({ error: sessionError.message }, { status: 500 });

  const session = data.session;
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { error } = await supabase
      .from("user_words")
      .insert([{ user_id: session.user.id, word_id: wordId }]);
    if (error) throw error;

    return NextResponse.json({ message: "登録成功" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
