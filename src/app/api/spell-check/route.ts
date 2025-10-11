import { NextResponse } from "next/server";
import nspell from "nspell";
import dictionary from "dictionary-en";

// spell インスタンスをキャッシュ
let spell: ReturnType<typeof nspell> | null = null;

async function getSpell(): Promise<ReturnType<typeof nspell>> {
  if (spell) return spell;

  const dict = await dictionary;

  // Uint8Array -> 文字列に変換
  const aff = new TextDecoder().decode(dict.aff);
  const dic = new TextDecoder().decode(dict.dic);

  // nspell に文字列として渡す
  spell = nspell(aff, dic);

  return spell;
}

export async function POST(req: Request) {
  try {
    const { word } = (await req.json()) as { word: string };

    if (!word || typeof word !== "string") {
      return NextResponse.json({ error: "Invalid word" }, { status: 400 });
    }

    const spellInstance = await getSpell();

    let correctedWord = word;

    if (!spellInstance.correct(word)) {
      const suggestions = spellInstance.suggest(word);
      if (suggestions.length > 0) correctedWord = suggestions[0];
    }

    return NextResponse.json({ correctedWord });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
