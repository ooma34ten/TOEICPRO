import { NextResponse } from "next/server";
import nspell from "nspell";
import dictionary from "dictionary-en";

let spell: ReturnType<typeof nspell> | null = null;

// 初期化
async function getSpell() {
  if (!spell) {
    // dictionary はすでに Dictionary オブジェクトなので直接渡す
    spell = nspell(dictionary as unknown as Record<string, unknown>);
  }
  return spell;
}

export async function POST(req: Request) {
  const { word } = await req.json();
  const spell = await getSpell();

  let correctedWord = word;
  if (!spell.correct(word)) {
    const suggestions = spell.suggest(word);
    if (suggestions.length > 0) {
      correctedWord = suggestions[0];
    }
  }

  return NextResponse.json({ correctedWord });
}
//src/app/api/spell-check/route.ts
