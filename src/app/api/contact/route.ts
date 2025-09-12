import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin"; 
// supabaseAdmin は service_role key を使うサーバーサイド用クライアント

export async function POST(req: Request) {
  try {
    const { userId, name, email, message } = await req.json();

    const { error } = await supabaseAdmin.from("inquiries").insert({
      user_id: userId,
      name,
      email,
      message,
    });

    if (error) {
      console.error("Supabase insert error:", error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
//src/app/api/contact/route.ts
