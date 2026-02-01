import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type QueueRow = {
  id: string;
  level: number;
  category: string | null;
  word_id: string | null;
};

type GeneratedQuestion = {
  question: string;
  translation: string | null;
  options: string[];
  answer: string;
  explanation: string | null;
  example_sentence: string | null;
  part_of_speech: string | null;
  category: string | null;
  importance: number | null;
  synonyms: string[] | null;
  level: number;
};

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// =============================
// Prompt Builder
// =============================
function buildPrompt(item: QueueRow): string {
  return `
TOEIC 四択問題を 1 件だけ JSON のみで生成してください。

- レベル: ${item.level}
- カテゴリ: ${item.category ?? "なし"}
- options は 4 つ
- translation は短く
- explanation と example_sentence も短く
- 前後の文章禁止、JSON のみを返す

出力形式:
{
  "question": "...",
  "translation": "...",
  "options": ["A","B","C","D"],
  "answer": "...",
  "explanation": "...",
  "example_sentence": "...",
  "part_of_speech": "...",
  "category": "${item.category ?? ""}",
  "importance": 3,
  "synonyms": ["..."],
  "level": ${item.level}
}
`;
}

// =============================
// JSON 抽出
// =============================
function extractJson(raw: string): string | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return raw.slice(start, end + 1);
}

// =============================
// Worker main logic
// =============================
async function processOne(item: QueueRow): Promise<GeneratedQuestion | null> {
  try {
    const prompt = buildPrompt(item);
    const model = genAI.getGenerativeModel({ model: "models/gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    const raw = result.response.text();

    const jsonText = extractJson(raw);
    if (!jsonText) return null;

    const parsed = JSON.parse(jsonText) as GeneratedQuestion;

    if (!Array.isArray(parsed.options) || parsed.options.length !== 4) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

// =============================
// Main
// =============================
async function main() {
  const { data: queue } = await supabase
    .from("ai_generated_questions_queue")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(10);

  if (!queue || queue.length === 0) {
    console.log("no queue");
    return;
  }

  let processed = 0;
  let saved = 0;
  const deleteIds: string[] = [];

  for (const raw of queue) {
    const item: QueueRow = raw;
    processed++;

    const generated = await processOne(item);
    if (!generated) continue;

    const insert = await supabase
      .from("toeic_questions")
      .insert(generated)
      .select("id");

    if (!insert.data || insert.data.length === 0) continue;

    saved++;
    deleteIds.push(item.id);
  }

  if (deleteIds.length) {
    await supabase
      .from("ai_generated_questions_queue")
      .delete()
      .in("id", deleteIds);
  }

  console.log("done", { processed, saved });
}

main();
