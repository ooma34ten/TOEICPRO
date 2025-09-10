declare module "nspell" {
  export interface NSpell {
    correct(word: string): boolean;
    suggest(word: string): string[];
    add(word: string): void;
    remove(word: string): void;
  }

  // default export は関数
  export default function nspell(dict: Record<string, unknown>): NSpell;
}
// src/types/nspell.d.ts
