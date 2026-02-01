import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type ToeicQuestion = {
  id: string;
  question: string;
  translation: string;
  options: string[];
  answer: string;
  explanation: string;
  example_sentence: string;
  part_of_speech: string;
  category: string;
  importance: string;
  synonyms: string[];
  level: string;
};

export async function GET() {
  try {
    // まず全件取得（必要に応じて filter 可能）
    const { data, error } = await supabase
      .from("toeic_questions")
      .select("*");

    if (error || !data || data.length === 0) {
      return NextResponse.json(
        { message: "Failed to fetch questions", details: error },
        { status: 500 }
      );
    }

    // 配列からランダムに1件選択
    const randomIndex = Math.floor(Math.random() * data.length);
    const randomQuestion = data[randomIndex];

    // options が null の場合は空配列
    if (!randomQuestion.options) randomQuestion.options = [];

    return NextResponse.json(randomQuestion as ToeicQuestion);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { message: "Unexpected error", details: err },
      { status: 500 }
    );
  }
}
