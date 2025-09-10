import { NextResponse } from "next/server";
import nspell from "nspell";
import dictionary from "dictionary-en";

// spell オブジェクトをキャッシュ
let spell: ReturnType<typeof nspell> | null = null;

async function getSpell(): Promise<ReturnType<typeof nspell>> {
  if (spell) return spell;

  // dictionary-en は ESM default export なので await で取得
  const dict = await dictionary;

  // nspell に渡す
  spell = nspell(dict as unknown as Record<string, unknown>);
  return spell;
}

export async function POST(req: Request) {
  const { word } = await req.json();
  const spellInstance = await getSpell();

  let correctedWord = word;
  if (!spellInstance.correct(word)) {
    const suggestions = spellInstance.suggest(word);
    if (suggestions.length > 0) correctedWord = suggestions[0];
  }

  return NextResponse.json({ correctedWord });
}
// src/app/api/spell-check/route.ts
