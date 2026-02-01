import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type QueueInsertRow = {
  level: number;
  category: string;
  status: "pending";
};

export async function POST(_request: Request) {
  const queueRows: QueueInsertRow[] = [
    {
      level: 3,
      category: "形容詞",
      status: "pending",
    },
  ];

  const { error } = await supabase
    .from("ai_generated_questions_queue")
    .insert(queueRows);

  if (error) {
    console.error("insert error", error);
    return NextResponse.json(
      { message: "insert failed" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { success: true },
    { status: 200 }
  );
}
