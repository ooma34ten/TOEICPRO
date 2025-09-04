import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

interface WordRow {
  part_of_speech: string;
  meaning: string;
  example: string;
  translation: string;
  importance: string;
}

interface RequestBody {
  word: string;
  rows: WordRow[];
  userId: string;
}

export async function POST(req: Request) {
  try {
    const { word, rows, userId }: RequestBody = await req.json();

    if (!word || !rows || !userId) {
      return NextResponse.json(
        { success: false, message: "パラメータ不足です" },
        { status: 400 }
      );
    }

    const insertData = rows.map((r) => ({
      user_id: userId,
      word,
      part_of_speech: r.part_of_speech,
      meaning: r.meaning,
      example_sentence: r.example,
      translation: r.translation,
      importance: r.importance,
      correct_count: 0,
      correct_dates: [],
    }));

    const { data, error } = await supabaseAdmin.from("words").insert(insertData).select("*");

    if (error) {
      console.error("Supabase insert error:", error);
      console.error("Insert payload:", insertData);
      return NextResponse.json(
        { success: false, message: error.message, details: error },
        { status: 500 }
      );
    }

    console.log("Insert success:", data);
    return NextResponse.json({ success: true, results: data || [] });
  } catch (e: any) {
    console.error("Route exception:", e);
    return NextResponse.json(
      { success: false, message: e.message, details: e },
      { status: 500 }
    );
  }
}
//src/app/api/save-word/route.ts