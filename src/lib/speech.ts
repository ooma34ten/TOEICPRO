let cachedVoices: SpeechSynthesisVoice[] = [];

export const initVoices = () => {
  return new Promise<void>((resolve) => {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      cachedVoices = voices;
      resolve();
    } else {
      window.speechSynthesis.onvoiceschanged = () => {
        cachedVoices = window.speechSynthesis.getVoices();
        resolve();
      };
    }
  });
};

export const speakText = async (text: string) => {
  if (!("speechSynthesis" in window)) {
    alert("このブラウザは音声読み上げに対応していません");
    return;
  }
  if (!text.trim()) return;

  // ✅ 最初の読み上げ前に声の準備を保証
  if (cachedVoices.length === 0) {
    await initVoices();
  }

  const utterance = new SpeechSynthesisUtterance(text);

  const enVoice =
    cachedVoices.find(
      (v) =>
        v.lang.startsWith("en-US") &&
        (v.name.includes("Google") || v.name.includes("Microsoft") || v.name.includes("Samantha"))
    ) || cachedVoices.find((v) => v.lang.startsWith("en")) || cachedVoices[0];
  utterance.voice = enVoice;

  utterance.rate = 0.95;
  utterance.pitch = 1.05;

  utterance.onend = () => console.log("読み上げ完了:", text);

  window.speechSynthesis.speak(utterance);
};
// src/lib/speech.ts
