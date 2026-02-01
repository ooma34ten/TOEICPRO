// src/lib/speech.ts

let cachedVoices: SpeechSynthesisVoice[] = [];
let isWarmedUp = false;

/**
 * 音声リストを確実に初期化
 */
export const initVoices = (): Promise<void> => {
  return new Promise((resolve) => {
    const voices = window.speechSynthesis.getVoices();

    if (voices.length > 0) {
      cachedVoices = voices;
      resolve();
      return;
    }

    const handler = () => {
      cachedVoices = window.speechSynthesis.getVoices();
      window.speechSynthesis.removeEventListener("voiceschanged", handler);
      resolve();
    };

    window.speechSynthesis.addEventListener("voiceschanged", handler);
  });
};

/**
 * 初回のみ実行する無音ウォームアップ
 * （これがないと一発目の先頭が欠けることがある）
 */
const warmUpSpeech = (): Promise<void> => {
  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(" ");
    utterance.volume = 0;

    utterance.onend = () => resolve();
    utterance.onerror = () => resolve(); // ← 重要

    window.speechSynthesis.speak(utterance);
  });
};

/**
 * テキスト読み上げ
 */
export const speakText = async (text: string): Promise<void> => {
  if (!("speechSynthesis" in window)) return;
  if (!text.trim()) return;

  const synth = window.speechSynthesis;

  synth.cancel();
  await new Promise<void>((r) => setTimeout(r, 0));

  if (cachedVoices.length === 0) {
    await initVoices();
  }

  if (!isWarmedUp) {
    await warmUpSpeech();
    isWarmedUp = true;
  }

  if (cachedVoices.length === 0) return;

  const utterance = new SpeechSynthesisUtterance(text);

  const enVoice =
    cachedVoices.find(
      (v) =>
        v.lang.startsWith("en-US") &&
        (v.name.includes("Google") ||
         v.name.includes("Microsoft") ||
         v.name.includes("Samantha"))
    ) ??
    cachedVoices.find((v) => v.lang.startsWith("en")) ??
    cachedVoices[0];

  utterance.voice = enVoice;
  utterance.rate = 0.95;
  utterance.pitch = 1.05;
  utterance.volume = 1;

  utterance.onerror = () => {
    // Web Speech API は理由を返さない
    console.warn("speech synthesis aborted");
  };

  synth.speak(utterance);
};

